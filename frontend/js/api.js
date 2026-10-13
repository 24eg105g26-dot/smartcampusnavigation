/**
 * Campus Navigation API Client
 */
const API = {
  baseUrl: (window.location.protocol === 'file:' || (window.location.port !== '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')))
    ? 'http://localhost:3000/api'
    : '/api',

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/health`);
    return await res.json();
  },

  async getBuildings(category = '', q = '') {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (q) params.append('q', q);
    const res = await fetch(`${this.baseUrl}/buildings?${params.toString()}`);
    return await res.json();
  },

  async getBuilding(id) {
    const res = await fetch(`${this.baseUrl}/buildings/${encodeURIComponent(id)}`);
    return await res.json();
  },

  async getCategories() {
    const res = await fetch(`${this.baseUrl}/categories`);
    return await res.json();
  },

  async getNodes() {
    const res = await fetch(`${this.baseUrl}/nodes`);
    return await res.json();
  },

  async getEdges() {
    const res = await fetch(`${this.baseUrl}/edges`);
    return await res.json();
  },

  async search(query) {
    if (!query || query.trim() === '') return [];
    const res = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
    return await res.json();
  },

  async calculateRoute(start, destination, wheelchair = false, avoidClosed = true) {
    const res = await fetch(`${this.baseUrl}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, destination, wheelchair, avoidClosed })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Routing failed' }));
      throw new Error(errData.error || 'Failed to find route');
    }
    return await res.json();
  },

  async getPopularDestinations() {
    const res = await fetch(`${this.baseUrl}/popular`);
    return await res.json();
  },

  async getAlerts() {
    const res = await fetch(`${this.baseUrl}/alerts`);
    return await res.json();
  },

  async toggleEdgeStatus(edgeId, status) {
    const res = await fetch(`${this.baseUrl}/edges/${encodeURIComponent(edgeId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await res.json();
  }
};
