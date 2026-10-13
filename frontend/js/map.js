/**
 * Leaflet Map Controller for Campus Navigation
 */
const CampusMap = {
  map: null,
  center: [12.9732, 77.5952],
  zoom: 17,
  
  // Layer Groups
  layers: {
    tiles: null,
    satelliteTiles: null,
    campusBoundary: null,
    buildings: null,
    pathways: null,
    markers: null,
    amenities: null,
    route: null,
    simulation: null,
    esriTiles: null
  },

  currentTileIndex: 0,
  showPathways: true,
  showAmenities: true,
  currentRouteLine: null,
  startMarker: null,
  destMarker: null,
  simMarker: null,

  init() {
    this.map = L.map('campusMap', {
      center: this.center,
      zoom: this.zoom,
      minZoom: 15,
      maxZoom: 19,
      zoomControl: false
    });

    // Custom Zoom Control top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Standard Street Tile Layer (OpenStreetMap - 100% Free, No Watermark, No API Key Required)
    this.layers.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Clean Subdued Street Map (Esri - Free, No Watermark)
    this.layers.esriTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    // Satellite Imagery Layer (Esri - Free, No Watermark)
    this.layers.satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    // Initialize Feature Groups
    this.layers.campusBoundary = L.featureGroup().addTo(this.map);
    this.layers.buildings = L.featureGroup().addTo(this.map);
    this.layers.pathways = L.featureGroup().addTo(this.map);
    this.layers.markers = L.featureGroup().addTo(this.map);
    this.layers.amenities = L.featureGroup().addTo(this.map);
    this.layers.route = L.featureGroup().addTo(this.map);
    this.layers.simulation = L.featureGroup().addTo(this.map);

    this.renderCampusPerimeter();
    this.renderAmenities();
  },

  renderCampusPerimeter() {
    // Campus grounds boundary
    const campusBounds = [
      [12.9772, 77.5925],
      [12.9772, 77.5985],
      [12.9692, 77.5985],
      [12.9692, 77.5925]
    ];

    L.polygon(campusBounds, {
      color: '#4f46e5',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#f1f5f9',
      fillOpacity: 0.15,
      interactive: false
    }).addTo(this.layers.campusBoundary);

    // Central Quad Garden Lawns
    const centralLawn = [
      [12.9733, 77.5950],
      [12.9733, 77.5958],
      [12.9723, 77.5958],
      [12.9723, 77.5950]
    ];

    L.polygon(centralLawn, {
      color: '#10b981',
      weight: 1,
      fillColor: '#86efac',
      fillOpacity: 0.35,
      interactive: false
    }).addTo(this.layers.campusBoundary);
  },

  renderBuildings(buildings, onBuildingClick) {
    this.layers.buildings.clearLayers();
    this.layers.markers.clearLayers();

    buildings.forEach(bldg => {
      // Draw building footprint polygon
      if (bldg.polygon && bldg.polygon.length > 0) {
        const poly = L.polygon(bldg.polygon, {
          color: bldg.color || '#4f46e5',
          weight: 2,
          fillColor: bldg.color || '#4f46e5',
          fillOpacity: 0.55
        }).addTo(this.layers.buildings);

        poly.bindTooltip(`<strong>${bldg.code}</strong>: ${bldg.name}`, {
          permanent: false,
          direction: 'top',
          className: 'map-tooltip'
        });

        poly.on('mouseover', () => {
          poly.setStyle({ fillOpacity: 0.85, weight: 3 });
        });

        poly.on('mouseout', () => {
          poly.setStyle({ fillOpacity: 0.55, weight: 2 });
        });

        poly.on('click', () => {
          if (onBuildingClick) onBuildingClick(bldg);
        });
      }

      // Add custom Pin Marker for building center
      const iconHtml = `
        <div class="campus-marker-pin" style="background-color: ${bldg.color || '#4f46e5'};">
          <i class="fa-solid fa-${bldg.icon || 'building'}"></i>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([bldg.coordinates.lat, bldg.coordinates.lng], { icon: customIcon })
        .addTo(this.layers.markers);

      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 180px;">
          <h4 style="margin: 0 0 4px; font-size: 14px; color: ${bldg.color || '#4f46e5'};">${bldg.name} (${bldg.code})</h4>
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">${bldg.category}</p>
          <div style="display: flex; gap: 4px;">
            <button onclick="window.NavigationController.setDestination('${bldg.id}')" style="background: #4f46e5; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              Directions Here
            </button>
            <button onclick="window.App.openBuildingDrawer('${bldg.id}')" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              Details
            </button>
          </div>
        </div>
      `);
    });
  },

  renderPathways(nodes, edges) {
    this.layers.pathways.clearLayers();
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    edges.forEach(edge => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;

      let color = '#94a3b8';
      let dashArray = '3, 4';
      let weight = 2.5;

      if (edge.pathType === 'ramp') {
        color = '#10b981';
        dashArray = null;
        weight = 3;
      } else if (edge.pathType === 'stairs') {
        color = '#f59e0b';
        dashArray = '2, 4';
      } else if (edge.pathType === 'paved_road') {
        color = '#64748b';
        weight = 4;
        dashArray = null;
      }

      if (edge.status === 'closed') {
        color = '#ef4444';
        dashArray = '5, 5';
      }

      L.polyline([
        [fromNode.lat, fromNode.lng],
        [toNode.lat, toNode.lng]
      ], {
        color,
        weight,
        dashArray,
        opacity: 0.7
      }).addTo(this.layers.pathways);
    });
  },

  drawRoute(routeData) {
    this.layers.route.clearLayers();
    this.layers.simulation.clearLayers();

    if (!routeData || !routeData.path || routeData.path.length === 0) return;

    const latLngs = routeData.path.map(p => [p.lat, p.lng]);

    // Outer glow polyline
    L.polyline(latLngs, {
      color: '#818cf8',
      weight: 8,
      opacity: 0.45,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layers.route);

    // Inner primary polyline
    this.currentRouteLine = L.polyline(latLngs, {
      color: routeData.wheelchairMode ? '#059669' : '#4f46e5',
      weight: 4,
      opacity: 0.95,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layers.route);

    // Start Waypoint Marker (Green)
    const startPoint = latLngs[0];
    const startIcon = L.divIcon({
      className: 'route-start-icon',
      html: `<div style="background:#059669; color:#fff; width:24px; height:24px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-size:12px;"><i class="fa-solid fa-play"></i></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    this.startMarker = L.marker(startPoint, { icon: startIcon }).addTo(this.layers.route);

    // Destination Waypoint Marker (Red)
    const endPoint = latLngs[latLngs.length - 1];
    const endIcon = L.divIcon({
      className: 'route-end-icon',
      html: `<div style="background:#e11d48; color:#fff; width:26px; height:26px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-size:13px;"><i class="fa-solid fa-flag-checkered"></i></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    this.destMarker = L.marker(endPoint, { icon: endIcon }).addTo(this.layers.route);

    // Fit map view to route bounds
    this.map.fitBounds(this.currentRouteLine.getBounds(), { padding: [50, 50] });
  },

  clearRoute() {
    this.layers.route.clearLayers();
    this.layers.simulation.clearLayers();
    this.currentRouteLine = null;
  },

  highlightStep(coordinates) {
    if (!coordinates) return;
    this.map.setView([coordinates.lat, coordinates.lng], 18, { animate: true });
    
    // Pulse highlight ring
    const ring = L.circleMarker([coordinates.lat, coordinates.lng], {
      radius: 14,
      color: '#4f46e5',
      weight: 3,
      fillColor: '#818cf8',
      fillOpacity: 0.4
    }).addTo(this.layers.simulation);

    setTimeout(() => {
      this.layers.simulation.removeLayer(ring);
    }, 2000);
  },

  toggleSatellite() {
    const tileKeys = ['tiles', 'esriTiles', 'satelliteTiles'];
    const currentKey = tileKeys[this.currentTileIndex];
    if (this.layers[currentKey]) {
      this.map.removeLayer(this.layers[currentKey]);
    }
    
    this.currentTileIndex = (this.currentTileIndex + 1) % tileKeys.length;
    const nextKey = tileKeys[this.currentTileIndex];
    if (this.layers[nextKey]) {
      this.layers[nextKey].addTo(this.map);
    }
  },

  togglePathways() {
    if (this.showPathways) {
      this.map.removeLayer(this.layers.pathways);
      this.showPathways = false;
    } else {
      this.layers.pathways.addTo(this.map);
      this.showPathways = true;
    }
  },

  renderAmenities() {
    this.layers.amenities.clearLayers();
    const amenitiesList = [
      { name: 'Campus ATM (HDFC & SBI)', icon: 'money-bill-1', color: '#059669', lat: 12.97235, lng: 77.5946, node: 'n-adm-main' },
      { name: 'Academic Quad Restrooms', icon: 'restroom', color: '#0284c7', lat: 12.9740, lng: 77.5951, node: 'j-central-quad-north' },
      { name: 'Student Plaza Restrooms', icon: 'restroom', color: '#0284c7', lat: 12.9722, lng: 77.5938, node: 'j-caf-fork' },
      { name: 'Library Forecourt Restrooms', icon: 'restroom', color: '#0284c7', lat: 12.9730, lng: 77.5958, node: 'j-lib-front' },
      { name: 'Filtered Drinking Water Station', icon: 'faucet-drip', color: '#06b6d4', lat: 12.9727, lng: 77.5953, node: 'j-central-quad-center' },
      { name: 'First Aid & AED Station', icon: 'kit-medical', color: '#dc2626', lat: 12.9714, lng: 77.5960, node: 'n-spo-main' },
      { name: 'South Visitor Parking (P1)', icon: 'square-parking', color: '#475569', lat: 12.9704, lng: 77.5946, node: 'n-gate-main' },
      { name: 'Smart Bicycle Rental Stand', icon: 'bicycle', color: '#8b5cf6', lat: 12.9762, lng: 77.5952, node: 'n-gate-north' }
    ];

    amenitiesList.forEach(item => {
      const iconHtml = `
        <div class="amenity-marker-pin" style="background-color: ${item.color};">
          <i class="fa-solid fa-${item.icon}"></i>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-amenity-icon',
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
      });

      const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(this.layers.amenities);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px;">
          <strong style="color: ${item.color};">${item.name}</strong>
          <div style="margin-top: 6px;">
            <button onclick="window.NavigationController.setDestination('${item.node}', '${item.name}')" style="background: ${item.color}; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
              Navigate Here
            </button>
          </div>
        </div>
      `);
    });
  },

  toggleAmenities() {
    if (this.showAmenities) {
      this.map.removeLayer(this.layers.amenities);
      this.showAmenities = false;
    } else {
      this.layers.amenities.addTo(this.map);
      this.showAmenities = true;
    }
  },

  resetView() {
    this.map.setView(this.center, this.zoom, { animate: true });
  }
};
