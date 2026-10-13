/**
 * Main Application Controller
 */
const App = {
  allBuildings: [],
  allNodes: [],
  allEdges: [],
  allAlerts: [],
  currentSelectedBuilding: null,
  isClosureActive: false,

  async init() {
    CampusMap.init();
    NavigationController.init();
    this.bindGlobalEvents();

    try {
      await this.loadInitialData();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  },

  async loadInitialData() {
    // Parallel fetch of initial campus data
    const [buildings, nodes, edges, alerts] = await Promise.all([
      API.getBuildings(),
      API.getNodes(),
      API.getEdges(),
      API.getAlerts()
    ]);

    this.allBuildings = buildings;
    this.allNodes = nodes;
    this.allEdges = edges;
    this.allAlerts = alerts;

    // Render on Map
    CampusMap.renderBuildings(this.allBuildings, (bldg) => this.openBuildingDrawer(bldg.id));
    CampusMap.renderPathways(this.allNodes, this.allEdges);

    // Render UI lists
    this.renderExploreBuildings(this.allBuildings);
    this.populateIndoorDropdown(this.allBuildings);
    this.renderAlerts(this.allAlerts);
  },

  bindGlobalEvents() {
    // Sidebar Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.currentTarget.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Sidebar Toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Global Search Autocomplete
    const searchInput = document.getElementById('globalSearchInput');
    const searchClear = document.getElementById('clearGlobalSearch');
    let searchDebounce = null;

    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      searchClear.style.display = val ? 'block' : 'none';

      clearTimeout(searchDebounce);
      if (val.length < 2) {
        document.getElementById('searchResultsDropdown').classList.add('hidden');
        return;
      }

      searchDebounce = setTimeout(async () => {
        const results = await API.search(val);
        this.renderSearchResults(results);
      }, 250);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      document.getElementById('searchResultsDropdown').classList.add('hidden');
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        document.getElementById('searchResultsDropdown').classList.add('hidden');
      }
    });

    // Explore Category Filter Pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cat = e.currentTarget.dataset.category;
        const filtered = (cat === 'All') 
          ? this.allBuildings 
          : this.allBuildings.filter(b => b.category.toLowerCase().includes(cat.toLowerCase()));
        this.renderExploreBuildings(filtered);
      });
    });

    // Indoor Building Selector Dropdown
    document.getElementById('buildingSelect').addEventListener('change', (e) => {
      this.renderIndoorDetails(e.target.value);
    });

    // Map Floating Controls
    document.getElementById('btnMapReset').addEventListener('click', () => CampusMap.resetView());
    document.getElementById('btnMapLocate').addEventListener('click', () => {
      CampusMap.map.setView([12.9702, 77.5950], 18);
      alert('Simulated your location at: Main University Gate');
    });
    document.getElementById('btnMapSatellite').addEventListener('click', () => CampusMap.toggleSatellite());
    document.getElementById('btnToggleGraphOverlay').addEventListener('click', () => CampusMap.togglePathways());
    document.getElementById('btnToggleAmenities').addEventListener('click', () => CampusMap.toggleAmenities());

    // Drawer Close
    document.getElementById('btnCloseDrawer').addEventListener('click', () => {
      document.getElementById('buildingDetailDrawer').classList.add('hidden');
    });

    // Dynamic Rerouting Simulator Button
    document.getElementById('btnToggleClosure').addEventListener('click', async () => {
      const edgeId = 'e-29'; // East Athletic Crossway
      this.isClosureActive = !this.isClosureActive;
      const newStatus = this.isClosureActive ? 'closed' : 'open';

      await API.toggleEdgeStatus(edgeId, newStatus);
      
      const btn = document.getElementById('btnToggleClosure');
      const text = document.getElementById('closureBtnText');
      if (this.isClosureActive) {
        btn.classList.add('closed');
        text.textContent = 'Reopen Pathway';
        alert('Pathway is now BLOCKED for construction! Any active route will automatically reroute.');
      } else {
        btn.classList.remove('closed');
        text.textContent = 'Block Pathway';
        alert('Pathway reopened for pedestrians.');
      }

      // Refresh edge visual
      const updatedEdges = await API.getEdges();
      this.allEdges = updatedEdges;
      CampusMap.renderPathways(this.allNodes, this.allEdges);

      // Recalculate route if one is displayed
      if (NavigationController.currentRoute) {
        NavigationController.findRoute();
      }
    });

    // Help Modal
    document.getElementById('btnHelpModal').addEventListener('click', () => {
      document.getElementById('helpModal').classList.remove('hidden');
    });
    document.getElementById('btnCloseModal').addEventListener('click', () => {
      document.getElementById('helpModal').classList.add('hidden');
    });
    document.getElementById('btnCloseModalBtn').addEventListener('click', () => {
      document.getElementById('helpModal').classList.add('hidden');
    });

    // Shuttle info button
    document.getElementById('btnQuickShuttle').addEventListener('click', () => {
      this.switchTab('alertsTab');
    });
  },

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    // If switching to explore or directory, make sure sidebar is expanded
    document.getElementById('sidebar').classList.remove('collapsed');
  },

  renderSearchResults(results) {
    const dropdown = document.getElementById('searchResultsDropdown');
    dropdown.innerHTML = '';

    if (results.length === 0) {
      dropdown.innerHTML = `<div style="padding:12px 16px; font-size:13px; color:#64748b;">No locations found matching your search.</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    results.forEach(item => {
      const el = document.createElement('div');
      el.className = 'search-item';
      el.innerHTML = `
        <div class="search-item-icon" style="background-color: ${item.color || '#4f46e5'};">
          <i class="fa-solid fa-${item.icon || 'location-dot'}"></i>
        </div>
        <div class="search-item-info">
          <strong>${item.name} ${item.code ? `(${item.code})` : ''}</strong>
          <span>${item.subtitle}</span>
        </div>
        <button style="background:transparent; border:none; color:#4f46e5; font-size:14px; cursor:pointer;" title="Navigate Here">
          <i class="fa-solid fa-diamond-turn-right"></i>
        </button>
      `;

      el.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        if (item.type === 'building') {
          this.openBuildingDrawer(item.id);
          NavigationController.setDestination(item.id, item.name);
        } else if (item.type === 'room') {
          NavigationController.setDestination(item.id, `${item.name} (${item.subtitle})`);
        } else {
          NavigationController.setDestination(item.id, item.name);
        }
      });

      dropdown.appendChild(el);
    });

    dropdown.classList.remove('hidden');
  },

  renderExploreBuildings(buildings) {
    const container = document.getElementById('buildingsList');
    container.innerHTML = '';

    buildings.forEach(b => {
      const card = document.createElement('div');
      card.className = 'building-item-card';
      card.innerHTML = `
        <div class="bldg-card-header">
          <div class="bldg-icon" style="background-color: ${b.color || '#4f46e5'};">
            <i class="fa-solid fa-${b.icon || 'building'}"></i>
          </div>
          <div class="bldg-header-text">
            <h4>${b.name} <span class="bldg-code-chip">${b.code}</span></h4>
            <span class="bldg-category">${b.category}</span>
          </div>
        </div>
        <p class="bldg-desc">${b.description}</p>
        <div class="bldg-meta-row">
          <span><i class="fa-solid fa-stairs"></i> ${b.floors.length} Floors</span>
          <div class="bldg-actions">
            <button class="btn-card-action btn-direct" data-id="${b.id}">
              <i class="fa-solid fa-diamond-turn-right"></i> Direct
            </button>
            <button class="btn-card-action btn-inspect" data-id="${b.id}">
              <i class="fa-solid fa-eye"></i> View
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-direct').addEventListener('click', (e) => {
        e.stopPropagation();
        NavigationController.setDestination(b.id, b.name);
      });

      card.querySelector('.btn-inspect').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBuildingDrawer(b.id);
      });

      card.addEventListener('click', () => {
        CampusMap.map.setView([b.coordinates.lat, b.coordinates.lng], 18, { animate: true });
        this.openBuildingDrawer(b.id);
      });

      container.appendChild(card);
    });
  },

  openBuildingDrawer(buildingId) {
    const b = this.allBuildings.find(item => item.id === buildingId);
    if (!b) return;

    this.currentSelectedBuilding = b;
    const drawer = document.getElementById('buildingDetailDrawer');
    const content = document.getElementById('drawerContent');

    const amenitiesHtml = (b.amenities || [])
      .map(a => `<span class="amenity-chip"><i class="fa-solid fa-check"></i> ${a}</span>`)
      .join('');

    content.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-icon" style="background-color: ${b.color || '#4f46e5'};">
          <i class="fa-solid fa-${b.icon || 'building'}"></i>
        </div>
        <div>
          <h3>${b.name} (${b.code})</h3>
          <span style="font-size: 12px; color: #64748b;">${b.category} • ${b.openingHours || 'Open Daily'}</span>
        </div>
      </div>
      <p style="font-size: 13px; color: #475569; line-height: 1.45; margin-bottom: 10px;">${b.description}</p>
      
      <div style="font-size: 12px; font-weight: 700; margin-bottom: 6px;">Available Amenities:</div>
      <div class="drawer-tags">${amenitiesHtml}</div>

      <div class="drawer-actions">
        <button id="drawerBtnNavigate" class="btn-primary" style="padding: 8px 12px; font-size: 13px;">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate Here
        </button>
        <button id="drawerBtnIndoor" class="btn-secondary" style="padding: 8px 12px; font-size: 13px;">
          <i class="fa-solid fa-layer-group"></i> View Floors
        </button>
      </div>
    `;

    document.getElementById('drawerBtnNavigate').addEventListener('click', () => {
      NavigationController.setDestination(b.id, b.name);
    });

    document.getElementById('drawerBtnIndoor').addEventListener('click', () => {
      this.switchTab('directoryTab');
      document.getElementById('buildingSelect').value = b.id;
      this.renderIndoorDetails(b.id);
    });

    drawer.classList.remove('hidden');
    CampusMap.map.setView([b.coordinates.lat, b.coordinates.lng], 18, { animate: true });
  },

  populateIndoorDropdown(buildings) {
    const select = document.getElementById('buildingSelect');
    select.innerHTML = '';
    buildings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.code})`;
      select.appendChild(opt);
    });

    if (buildings.length > 0) {
      this.renderIndoorDetails(buildings[0].id);
    }
  },

  renderIndoorDetails(buildingId) {
    const b = this.allBuildings.find(item => item.id === buildingId);
    const container = document.getElementById('buildingIndoorDetails');
    if (!b) return;

    container.innerHTML = `
      <div style="margin-bottom: 12px;">
        <h4 style="font-size: 14px; font-weight: 800; color: ${b.color};">${b.name}</h4>
        <p style="font-size: 12px; color: #64748b;">${b.floors.length} Floors • Total ${b.floors.reduce((acc, f) => acc + f.rooms.length, 0)} Key Rooms</p>
      </div>
    `;

    b.floors.forEach(floor => {
      const floorCard = document.createElement('div');
      floorCard.className = 'floor-card';
      
      let roomsList = '';
      floor.rooms.forEach(room => {
        roomsList += `
          <div class="room-item">
            <div>
              <strong>${room.name}</strong>
              <div style="margin-top: 2px;"><span class="room-type-tag">${room.type}</span></div>
            </div>
            <button class="btn-room-nav" data-room-id="${room.id}" data-room-name="${room.name}" data-bldg="${b.name}" title="Navigate to this room">
              <i class="fa-solid fa-diamond-turn-right"></i>
            </button>
          </div>
        `;
      });

      floorCard.innerHTML = `
        <div class="floor-header">
          <i class="fa-solid fa-layer-group"></i> ${floor.name} (Level ${floor.level})
        </div>
        <div class="floor-rooms">${roomsList}</div>
      `;

      floorCard.querySelectorAll('.btn-room-nav').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const rId = e.currentTarget.dataset.roomId;
          const rName = e.currentTarget.dataset.roomName;
          const bldgName = e.currentTarget.dataset.bldg;
          NavigationController.setDestination(rId, `${rName} (${bldgName})`);
        });
      });

      container.appendChild(floorCard);
    });
  },

  renderAlerts(alerts) {
    const list = document.getElementById('alertsList');
    list.innerHTML = '';
    alerts.forEach(a => {
      const item = document.createElement('div');
      item.className = `alert-feed-item ${a.severity}`;
      item.innerHTML = `
        <h5>${a.title}</h5>
        <p>${a.description}</p>
      `;
      list.appendChild(item);
    });
  }
};

window.App = App;

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
