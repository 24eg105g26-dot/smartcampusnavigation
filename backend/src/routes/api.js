const express = require('express');
const router = express.Router();
const graphService = require('../services/graphService');
const pathfindingService = require('../services/pathfinding');

// Health check & statistics
router.get('/health', (req, res) => {
  const buildings = graphService.getBuildings();
  const nodes = graphService.getNodes();
  const edges = graphService.getEdges();
  const alerts = graphService.getAlerts();

  res.json({
    status: 'healthy',
    system: 'Campus Navigation System API',
    version: '1.0.0',
    stats: {
      buildingsCount: buildings.length,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      alertsCount: alerts.length
    }
  });
});

// Get all buildings with optional category or query filter
router.get('/buildings', (req, res) => {
  const { category, q } = req.query;
  let list = graphService.getBuildings();

  if (category && category !== 'All') {
    list = list.filter(b => b.category.toLowerCase() === category.toLowerCase());
  }

  if (q) {
    const query = q.toLowerCase();
    list = list.filter(b => 
      b.name.toLowerCase().includes(query) ||
      b.code.toLowerCase().includes(query) ||
      b.description.toLowerCase().includes(query) ||
      b.floors.some(f => f.rooms.some(r => r.name.toLowerCase().includes(query)))
    );
  }

  res.json(list);
});

// Get single building by ID or code
router.get('/buildings/:id', (req, res) => {
  const { id } = req.params;
  const building = graphService.getBuilding(id) || 
    graphService.getBuildings().find(b => b.code.toLowerCase() === id.toLowerCase());

  if (!building) {
    return res.status(404).json({ error: `Building '${id}' not found.` });
  }

  res.json(building);
});

// Categories list with counts
router.get('/categories', (req, res) => {
  const buildings = graphService.getBuildings();
  const categoryMap = new Map();

  for (const b of buildings) {
    const current = categoryMap.get(b.category) || { count: 0, color: b.color, icon: b.icon };
    current.count += 1;
    categoryMap.set(b.category, current);
  }

  const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    color: data.color,
    icon: data.icon
  }));

  res.json(categories);
});

// Get all navigation nodes
router.get('/nodes', (req, res) => {
  res.json(graphService.getNodes());
});

// Get all navigation edges
router.get('/edges', (req, res) => {
  res.json(graphService.getEdges());
});

// Quick search across buildings, rooms, amenities, and nodes
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json([]);
  }

  const query = q.trim().toLowerCase();
  const results = [];

  // Match buildings
  for (const b of graphService.getBuildings()) {
    if (b.name.toLowerCase().includes(query) || b.code.toLowerCase().includes(query)) {
      results.push({
        type: 'building',
        id: b.id,
        code: b.code,
        name: b.name,
        subtitle: `${b.category} • ${b.floors.length} Floors`,
        coordinates: b.coordinates,
        color: b.color,
        icon: b.icon
      });
    }

    // Match rooms inside building
    for (const floor of b.floors) {
      for (const room of floor.rooms) {
        if (room.name.toLowerCase().includes(query)) {
          results.push({
            type: 'room',
            id: room.id,
            name: room.name,
            buildingId: b.id,
            buildingName: b.name,
            subtitle: `${b.name} (${floor.name})`,
            coordinates: b.coordinates,
            color: b.color,
            icon: 'door-open'
          });
        }
      }
    }
  }

  // Match nodes/entrances/landmarks
  for (const node of graphService.getNodes()) {
    if (node.name.toLowerCase().includes(query)) {
      const alreadyAdded = results.some(r => r.name === node.name);
      if (!alreadyAdded) {
        results.push({
          type: 'node',
          id: node.id,
          name: node.name,
          subtitle: node.type.toUpperCase(),
          coordinates: { lat: node.lat, lng: node.lng },
          color: '#64748B',
          icon: node.type === 'landmark' ? 'monument' : 'location-dot'
        });
      }
    }
  }

  res.json(results.slice(0, 15));
});

// Route Calculation
router.post('/route', (req, res) => {
  const { start, destination, wheelchair = false, avoidClosed = true } = req.body;

  if (!start || !destination) {
    return res.status(400).json({ error: 'Both start and destination are required.' });
  }

  const startNode = graphService.resolveLocationNode(start, wheelchair);
  const endNode = graphService.resolveLocationNode(destination, wheelchair);

  if (!startNode) {
    return res.status(404).json({ error: `Could not resolve start location '${start}'` });
  }
  if (!endNode) {
    return res.status(404).json({ error: `Could not resolve destination location '${destination}'` });
  }

  const routeResult = pathfindingService.findShortestPath(startNode.id, endNode.id, {
    wheelchair: Boolean(wheelchair),
    avoidClosed: Boolean(avoidClosed)
  });

  if (!routeResult) {
    return res.status(404).json({ 
      error: 'No accessible route found between the selected locations.',
      startResolved: startNode,
      destinationResolved: endNode
    });
  }

  // Attach indoor destination context if user searched for a specific room
  if (endNode.resolvedTarget) {
    routeResult.indoorTarget = endNode.resolvedTarget;
    routeResult.instructions.push({
      step: routeResult.instructions.length + 1,
      type: 'indoor',
      icon: 'door-open',
      instruction: `Inside ${endNode.resolvedTarget.building}, head to ${endNode.resolvedTarget.floor} for ${endNode.resolvedTarget.room}.`,
      distance: 0,
      pathType: 'indoor',
      coordinates: { lat: endNode.lat, lng: endNode.lng }
    });
  }

  res.json(routeResult);
});

// Popular destinations for instant one-click navigation
router.get('/popular', (req, res) => {
  const popularIds = ['b-lib', 'b-eng', 'b-caf', 'b-adm', 'b-spo', 'b-med'];
  const popular = popularIds
    .map(id => graphService.getBuilding(id))
    .filter(Boolean)
    .map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      category: b.category,
      color: b.color,
      icon: b.icon,
      lat: b.coordinates.lat,
      lng: b.coordinates.lng
    }));

  res.json(popular);
});

// Campus Alerts & Notices
router.get('/alerts', (req, res) => {
  res.json(graphService.getAlerts());
});

// Dynamic toggle edge status (e.g. simulate pathway closure / maintenance)
router.post('/edges/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'open' | 'closed'

  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'open' or 'closed'." });
  }

  const edge = graphService.toggleEdgeStatus(id, status);
  if (!edge) {
    return res.status(404).json({ error: `Edge '${id}' not found.` });
  }

  res.json({ message: `Edge ${id} status set to ${status}`, edge });
});

module.exports = router;
