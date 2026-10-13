/**
 * Navigation & Wayfinding Controller
 */
const NavigationController = {
  currentRoute: null,
  mode: 'walking', // 'walking' | 'wheelchair'
  isSimulating: false,
  simInterval: null,
  simSpeed: 1,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.simSpeed = parseFloat(e.currentTarget.dataset.speed) || 1;
        if (this.isSimulating) {
          this.stopSimulation();
          this.startSimulation();
        }
      });
    });

    // Mode toggle buttons
    document.getElementById('modeWalkBtn').addEventListener('click', () => this.setMode('walking'));
    document.getElementById('modeWheelchairBtn').addEventListener('click', () => this.setMode('wheelchair'));

    // Swap button
    document.getElementById('btnSwapLocations').addEventListener('click', () => this.swapLocations());

    // Calculate Route
    document.getElementById('btnCalculateRoute').addEventListener('click', () => this.findRoute());

    // Clear Route
    document.getElementById('btnClearRoute').addEventListener('click', () => this.clearRoute());
    document.getElementById('btnClearDest').addEventListener('click', () => {
      document.getElementById('routeDestInput').value = '';
      document.getElementById('routeDestInput').dataset.targetId = '';
    });

    // My Location shortcut
    document.getElementById('btnMyCurrentLocation').addEventListener('click', () => {
      const input = document.getElementById('routeStartInput');
      input.value = 'Main University Gate (Current Location)';
      input.dataset.targetId = 'n-gate-main';
    });

    // Quick Pick Pills
    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        this.setDestination(targetId);
      });
    });

    // Virtual Walk Simulation
    document.getElementById('btnStartSimulation').addEventListener('click', () => this.toggleSimulation());
  },

  setMode(newMode) {
    this.mode = newMode;
    document.getElementById('modeWalkBtn').classList.toggle('active', newMode === 'walking');
    document.getElementById('modeWheelchairBtn').classList.toggle('active', newMode === 'wheelchair');

    // Recalculate route if already showing
    if (this.currentRoute) {
      this.findRoute();
    }
  },

  swapLocations() {
    const startInput = document.getElementById('routeStartInput');
    const destInput = document.getElementById('routeDestInput');

    const tempVal = startInput.value;
    const tempId = startInput.dataset.targetId;

    startInput.value = destInput.value;
    startInput.dataset.targetId = destInput.dataset.targetId || '';

    destInput.value = tempVal;
    destInput.dataset.targetId = tempId || '';

    if (startInput.value && destInput.value) {
      this.findRoute();
    }
  },

  setDestination(buildingOrNodeId, name = null) {
    const destInput = document.getElementById('routeDestInput');
    destInput.dataset.targetId = buildingOrNodeId;

    if (name) {
      destInput.value = name;
    } else {
      const b = window.App.allBuildings.find(item => item.id === buildingOrNodeId);
      destInput.value = b ? b.name : buildingOrNodeId;
    }

    // Default start location if empty
    const startInput = document.getElementById('routeStartInput');
    if (!startInput.value) {
      startInput.value = 'Main University Gate';
      startInput.dataset.targetId = 'n-gate-main';
    }

    // Switch to navigation tab
    window.App.switchTab('navTab');

    // Calculate immediately
    this.findRoute();
  },

  async findRoute() {
    const startInput = document.getElementById('routeStartInput');
    const destInput = document.getElementById('routeDestInput');

    const start = startInput.dataset.targetId || startInput.value.trim();
    const destination = destInput.dataset.targetId || destInput.value.trim();

    if (!start || !destination) {
      alert('Please select both a Start location and a Destination.');
      return;
    }

    const calcBtn = document.getElementById('btnCalculateRoute');
    calcBtn.disabled = true;
    calcBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Calculating...`;

    try {
      const isWheelchair = this.mode === 'wheelchair';
      const routeData = await API.calculateRoute(start, destination, isWheelchair);
      this.currentRoute = routeData;

      // Update Map
      CampusMap.drawRoute(routeData);

      // Render Results UI
      this.renderRouteResults(routeData);

      document.getElementById('btnClearRoute').classList.remove('hidden');
    } catch (err) {
      alert(`Routing Notice: ${err.message}`);
    } finally {
      calcBtn.disabled = false;
      calcBtn.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> Find Best Route`;
    }
  },

  renderRouteResults(route) {
    const resultsArea = document.getElementById('routeResultsArea');
    resultsArea.classList.remove('hidden');

    // Summary Metrics
    document.getElementById('metricTime').textContent = `${route.durationMinutes} min`;
    document.getElementById('metricDistance').textContent = `${route.totalDistance} m`;
    document.getElementById('metricCalories').textContent = `${route.caloriesBurned} kcal`;

    // Step Count
    const count = route.instructions.length;
    document.getElementById('stepCountBadge').textContent = `${count} ${count === 1 ? 'step' : 'steps'}`;

    // Timeline Steps
    const stepsList = document.getElementById('instructionStepsList');
    stepsList.innerHTML = '';

    route.instructions.forEach((step, idx) => {
      const stepCard = document.createElement('div');
      stepCard.className = 'step-card';
      stepCard.id = `step-card-${idx}`;

      let iconClass = 'fa-solid fa-arrow-up';
      if (step.type === 'depart') iconClass = 'fa-solid fa-person-walking';
      else if (step.type === 'arrive') iconClass = 'fa-solid fa-flag-checkered';
      else if (step.type === 'indoor') iconClass = 'fa-solid fa-door-open';
      else if (step.icon === 'arrow-left' || step.icon === 'turn-left') iconClass = 'fa-solid fa-arrow-left';
      else if (step.icon === 'arrow-right' || step.icon === 'turn-right') iconClass = 'fa-solid fa-arrow-right';
      else if (step.icon === 'arrow-up-right') iconClass = 'fa-solid fa-arrow-up-right-dots';
      else if (step.icon === 'arrow-up-left') iconClass = 'fa-solid fa-arrow-turn-up';

      stepCard.innerHTML = `
        <div class="step-dot">
          <i class="${iconClass}"></i>
        </div>
        <div class="step-details">
          <div class="step-text">${step.instruction}</div>
          <div class="step-meta">
            ${step.distance > 0 ? `<span><i class="fa-solid fa-ruler"></i> ${step.distance} m</span>` : ''}
            <span class="step-badge">${step.pathType}</span>
          </div>
        </div>
      `;

      stepCard.addEventListener('click', () => {
        document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-step'));
        stepCard.classList.add('active-step');
        if (step.coordinates) {
          CampusMap.highlightStep(step.coordinates);
        }
      });

      stepsList.appendChild(stepCard);
    });
  },

  clearRoute() {
    this.stopSimulation();
    this.currentRoute = null;
    CampusMap.clearRoute();
    document.getElementById('routeResultsArea').classList.add('hidden');
    document.getElementById('btnClearRoute').classList.add('hidden');
  },

  toggleSimulation() {
    if (this.isSimulating) {
      this.stopSimulation();
    } else {
      this.startSimulation();
    }
  },

  startSimulation() {
    if (!this.currentRoute || !this.currentRoute.path || this.currentRoute.path.length === 0) return;

    this.isSimulating = true;
    const simBtn = document.getElementById('btnStartSimulation');
    simBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause Walk`;
    simBtn.style.background = '#e11d48';

    const pathNodes = this.currentRoute.path;
    let currentIndex = 0;

    // Create avatar marker
    if (CampusMap.simMarker) {
      CampusMap.layers.simulation.removeLayer(CampusMap.simMarker);
    }

    const simIcon = L.divIcon({
      className: 'sim-avatar',
      html: `<div class="sim-avatar-marker"><i class="fa-solid fa-person-walking"></i></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    CampusMap.simMarker = L.marker([pathNodes[0].lat, pathNodes[0].lng], { icon: simIcon })
      .addTo(CampusMap.layers.simulation);

    CampusMap.map.setView([pathNodes[0].lat, pathNodes[0].lng], 18);

    const intervalMs = Math.max(250, Math.round(1400 / (this.simSpeed || 1)));
    this.simInterval = setInterval(() => {
      currentIndex++;
      if (currentIndex >= pathNodes.length) {
        this.stopSimulation();
        alert('You have arrived at your destination!');
        return;
      }

      const node = pathNodes[currentIndex];
      CampusMap.simMarker.setLatLng([node.lat, node.lng]);
      CampusMap.map.panTo([node.lat, node.lng]);

      // Highlight step in sidebar
      const matchingStepIndex = this.currentRoute.instructions.findIndex(s => s.nodeId === node.id);
      if (matchingStepIndex !== -1) {
        document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-step'));
        const stepEl = document.getElementById(`step-card-${matchingStepIndex}`);
        if (stepEl) {
          stepEl.classList.add('active-step');
          stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, intervalMs);
  },

  stopSimulation() {
    this.isSimulating = false;
    clearInterval(this.simInterval);
    const simBtn = document.getElementById('btnStartSimulation');
    if (simBtn) {
      simBtn.innerHTML = `<i class="fa-solid fa-play"></i> Start Walk`;
      simBtn.style.background = '#0284c7';
    }
  }
};

window.NavigationController = NavigationController;
