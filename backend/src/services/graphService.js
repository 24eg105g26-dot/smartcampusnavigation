const fs = require('fs');
const path = require('path');

class GraphService {
  constructor() {
    this.dataPath = path.join(__dirname, '..', '..', 'data');
    this.buildings = [];
    this.nodes = [];
    this.edges = [];
    this.alerts = [];
    this.nodeMap = new Map();
    this.buildingMap = new Map();
    this.reload();
  }

  reload() {
    try {
      this.buildings = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'buildings.json'), 'utf8'));
      this.nodes = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'nodes.json'), 'utf8'));
      this.edges = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'edges.json'), 'utf8'));
      this.alerts = JSON.parse(fs.readFileSync(path.join(this.dataPath, 'alerts.json'), 'utf8'));

      this.nodeMap.clear();
      this.nodes.forEach(n => this.nodeMap.set(n.id, n));

      this.buildingMap.clear();
      this.buildings.forEach(b => this.buildingMap.set(b.id, b));
    } catch (err) {
      console.error('Error loading campus data:', err);
    }
  }

  getBuildings() {
    return this.buildings;
  }

  getBuilding(id) {
    return this.buildingMap.get(id) || null;
  }

  getNodes() {
    return this.nodes;
  }

  getNode(id) {
    return this.nodeMap.get(id) || null;
  }

  getEdges() {
    return this.edges;
  }

  getAlerts() {
    return this.alerts;
  }

  toggleEdgeStatus(edgeId, status) {
    const edge = this.edges.find(e => e.id === edgeId);
    if (edge) {
      edge.status = status;
      return edge;
    }
    return null;
  }

  // Haversine distance in meters
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  // Calculate bearing in degrees from point 1 to point 2 (0 - 360)
  calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  // Find nearest graph node to given coordinates
  findNearestNode(lat, lng, wheelchair = false) {
    let nearest = null;
    let minDistance = Infinity;

    for (const node of this.nodes) {
      if (wheelchair && node.accessible === false) continue;
      const d = this.calculateDistance(lat, lng, node.lat, node.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = node;
      }
    }

    return nearest;
  }

  // Resolve an input location (which could be a node ID, building ID, room ID, or lat/lng)
  resolveLocationNode(query, wheelchair = false) {
    if (!query) return null;

    // Direct node match
    if (this.nodeMap.has(query)) {
      return this.nodeMap.get(query);
    }

    // Direct building match -> pick primary accessible entrance
    if (this.buildingMap.has(query)) {
      const b = this.buildingMap.get(query);
      if (b.entrances && b.entrances.length > 0) {
        const entrance = wheelchair 
          ? (b.entrances.find(e => e.accessible) || b.entrances[0])
          : b.entrances[0];
        return this.nodeMap.get(entrance.id) || this.findNearestNode(b.coordinates.lat, b.coordinates.lng, wheelchair);
      }
      return this.findNearestNode(b.coordinates.lat, b.coordinates.lng, wheelchair);
    }

    // Check if query is inside building rooms
    for (const b of this.buildings) {
      for (const floor of b.floors) {
        const room = floor.rooms.find(r => r.id === query || r.name.toLowerCase().includes(query.toLowerCase()));
        if (room) {
          const entrance = wheelchair 
            ? (b.entrances.find(e => e.accessible) || b.entrances[0])
            : b.entrances[0];
          const node = this.nodeMap.get(entrance.id);
          if (node) {
            return {
              ...node,
              resolvedTarget: {
                building: b.name,
                buildingCode: b.code,
                floor: floor.name,
                room: room.name,
                roomType: room.type
              }
            };
          }
        }
      }
    }

    // Check building by name or code
    const qLower = query.toLowerCase();
    const matchedBuilding = this.buildings.find(b => 
      b.code.toLowerCase() === qLower || 
      b.name.toLowerCase().includes(qLower)
    );
    if (matchedBuilding) {
      const entrance = wheelchair 
        ? (matchedBuilding.entrances.find(e => e.accessible) || matchedBuilding.entrances[0])
        : matchedBuilding.entrances[0];
      return this.nodeMap.get(entrance.id) || this.findNearestNode(matchedBuilding.coordinates.lat, matchedBuilding.coordinates.lng, wheelchair);
    }

    return null;
  }

  // Construct adjacency list for pathfinding based on routing constraints
  buildAdjacencyList(options = {}) {
    const { wheelchair = false, avoidClosed = true } = options;
    const adj = new Map();

    for (const node of this.nodes) {
      adj.set(node.id, []);
    }

    for (const edge of this.edges) {
      if (avoidClosed && edge.status === 'closed') {
        continue;
      }
      if (wheelchair && edge.wheelchairAccessible === false) {
        continue;
      }

      const weight = edge.distance;

      if (adj.has(edge.from)) {
        adj.get(edge.from).push({
          neighbor: edge.to,
          edgeId: edge.id,
          name: edge.name,
          distance: weight,
          pathType: edge.pathType,
          wheelchairAccessible: edge.wheelchairAccessible
        });
      }

      if (edge.bidirectional && adj.has(edge.to)) {
        adj.get(edge.to).push({
          neighbor: edge.from,
          edgeId: edge.id,
          name: edge.name,
          distance: weight,
          pathType: edge.pathType,
          wheelchairAccessible: edge.wheelchairAccessible
        });
      }
    }

    return adj;
  }
}

module.exports = new GraphService();
