const graphService = require('./graphService');

class PathfindingService {
  /**
   * Run Dijkstra's algorithm to find the shortest path
   */
  findShortestPath(startId, endId, options = {}) {
    const { wheelchair = false, avoidClosed = true } = options;
    const adj = graphService.buildAdjacencyList({ wheelchair, avoidClosed });

    if (!adj.has(startId) || !adj.has(endId)) {
      return null;
    }

    if (startId === endId) {
      const node = graphService.getNode(startId);
      return {
        path: [node],
        edges: [],
        totalDistance: 0,
        estimatedDurationMinutes: 0,
        instructions: [
          {
            step: 1,
            instruction: `You are already at ${node.name}.`,
            distance: 0,
            pathType: 'walkway',
            nodeId: node.id,
            lat: node.lat,
            lng: node.lng
          }
        ]
      };
    }

    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    const priorityQueue = [];

    for (const [nodeId] of adj) {
      distances.set(nodeId, Infinity);
    }
    distances.set(startId, 0);
    priorityQueue.push({ id: startId, dist: 0 });

    while (priorityQueue.length > 0) {
      // Sort to get node with smallest distance
      priorityQueue.sort((a, b) => a.dist - b.dist);
      const { id: currentId, dist: currentDist } = priorityQueue.shift();

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId === endId) break;

      const neighbors = adj.get(currentId) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.neighbor)) continue;

        const newDist = currentDist + edge.distance;
        if (newDist < distances.get(edge.neighbor)) {
          distances.set(edge.neighbor, newDist);
          previous.set(edge.neighbor, {
            from: currentId,
            edgeId: edge.edgeId,
            name: edge.name,
            distance: edge.distance,
            pathType: edge.pathType,
            wheelchairAccessible: edge.wheelchairAccessible
          });
          priorityQueue.push({ id: edge.neighbor, dist: newDist });
        }
      }
    }

    if (distances.get(endId) === Infinity) {
      return null; // No path found
    }

    // Reconstruct path
    const pathNodeIds = [];
    const usedEdges = [];
    let curr = endId;

    while (curr && curr !== startId) {
      pathNodeIds.unshift(curr);
      const prevInfo = previous.get(curr);
      if (prevInfo) {
        usedEdges.unshift(prevInfo);
        curr = prevInfo.from;
      } else {
        break;
      }
    }
    pathNodeIds.unshift(startId);

    const pathNodes = pathNodeIds.map(id => graphService.getNode(id));
    const totalDistance = distances.get(endId);

    // Speed: 1.3 m/s (~78 m/min) for walking, 1.0 m/s (~60 m/min) for wheelchair
    const speedMetersPerMinute = wheelchair ? 60 : 78;
    const durationMinutes = Math.max(1, Math.round(totalDistance / speedMetersPerMinute));
    const caloriesBurned = Math.round(totalDistance * 0.042);

    const instructions = this.generateInstructions(pathNodes, usedEdges, wheelchair);

    return {
      startNode: pathNodes[0],
      endNode: pathNodes[pathNodes.length - 1],
      totalDistance,
      durationMinutes,
      caloriesBurned,
      wheelchairMode: wheelchair,
      path: pathNodes,
      edges: usedEdges,
      instructions
    };
  }

  /**
   * Generate human-friendly turn-by-turn instructions
   */
  generateInstructions(nodes, edges, wheelchair) {
    const steps = [];
    if (nodes.length === 0) return steps;

    // First step
    const firstNode = nodes[0];
    const secondNode = nodes[1];
    const firstEdge = edges[0];

    let startText = `Start at ${firstNode.name}`;
    if (firstEdge) {
      startText += `, proceed along ${firstEdge.name} toward ${secondNode.name}`;
    }
    steps.push({
      step: 1,
      type: 'depart',
      instruction: startText,
      distance: firstEdge ? firstEdge.distance : 0,
      pathType: firstEdge ? firstEdge.pathType : 'walkway',
      nodeId: firstNode.id,
      coordinates: { lat: firstNode.lat, lng: firstNode.lng }
    });

    for (let i = 1; i < nodes.length - 1; i++) {
      const prevNode = nodes[i - 1];
      const currNode = nodes[i];
      const nextNode = nodes[i + 1];
      const currentEdge = edges[i];

      const bearing1 = graphService.calculateBearing(prevNode.lat, prevNode.lng, currNode.lat, currNode.lng);
      const bearing2 = graphService.calculateBearing(currNode.lat, currNode.lng, nextNode.lat, nextNode.lng);

      const relAngle = (bearing2 - bearing1 + 360) % 360;
      let turnDescription = 'Continue straight';
      let icon = 'arrow-up';

      if (relAngle > 20 && relAngle <= 60) {
        turnDescription = 'Bear slight right';
        icon = 'arrow-up-right';
      } else if (relAngle > 60 && relAngle <= 120) {
        turnDescription = 'Turn right';
        icon = 'arrow-right';
      } else if (relAngle > 120 && relAngle <= 170) {
        turnDescription = 'Sharp right';
        icon = 'turn-right';
      } else if (relAngle >= 190 && relAngle <= 240) {
        turnDescription = 'Sharp left';
        icon = 'turn-left';
      } else if (relAngle > 240 && relAngle <= 300) {
        turnDescription = 'Turn left';
        icon = 'arrow-left';
      } else if (relAngle > 300 && relAngle < 340) {
        turnDescription = 'Bear slight left';
        icon = 'arrow-up-left';
      }

      let extraContext = '';
      if (currentEdge.pathType === 'ramp') {
        extraContext = ' (accessible ramp)';
      } else if (currentEdge.pathType === 'stairs') {
        extraContext = ' (steps)';
      } else if (currentEdge.pathType === 'indoor') {
        extraContext = ' (indoor corridor)';
      }

      const instruction = `${turnDescription} at ${currNode.name} onto ${currentEdge.name}${extraContext}`;

      steps.push({
        step: steps.length + 1,
        type: 'turn',
        turnAngle: Math.round(relAngle),
        icon,
        instruction,
        distance: currentEdge.distance,
        pathType: currentEdge.pathType,
        nodeId: currNode.id,
        coordinates: { lat: currNode.lat, lng: currNode.lng }
      });
    }

    // Final destination step
    const lastNode = nodes[nodes.length - 1];
    const destinationBuilding = lastNode.buildingId ? graphService.getBuilding(lastNode.buildingId) : null;
    const arrivalName = destinationBuilding ? `${destinationBuilding.name} (${lastNode.name})` : lastNode.name;

    steps.push({
      step: steps.length + 1,
      type: 'arrive',
      icon: 'map-pin',
      instruction: `Arrive at your destination: ${arrivalName}`,
      distance: 0,
      pathType: 'walkway',
      nodeId: lastNode.id,
      coordinates: { lat: lastNode.lat, lng: lastNode.lng }
    });

    return steps;
  }
}

module.exports = new PathfindingService();
