import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Service } from '../types';
import './ServicesPage.css';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  media: 'Media',
  networking: 'Networking',
  monitoring: 'Monitoring',
  storage: 'Storage',
  management: 'Management',
  home_automation: 'Home Automation',
  gaming: 'Gaming',
};

const CATEGORY_ICONS: Record<string, string> = {
  media: '🎬',
  networking: '🌐',
  monitoring: '📊',
  storage: '💾',
  management: '⚙️',
  home_automation: '🏠',
  gaming: '🎮',
};

function ServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      const res = await api.getServices();
      setServices(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function getRecommendations() {
    const ids = Array.from(selectedIds);
    navigate('/recommendations', { state: { serviceIds: ids } });
  }

  const categories = ['all', ...new Set(services.map((s) => s.category))];

  const filtered = services.filter((s) => {
    const matchesSearch =
      search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="services-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="services-page">
        <div className="error-state">
          <p>⚠️ {error}</p>
          <button className="btn-primary" onClick={loadServices}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="services-page">
      <div className="page-header">
        <h1>Service Catalog</h1>
        <p>Select the services you want to run in your homelab.</p>
      </div>

      <div className="services-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-filters">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_ICONS[cat] && <span>{CATEGORY_ICONS[cat]}</span>}
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="services-grid">
        {filtered.map((service) => (
          <div
            key={service.id}
            className={`service-card ${selectedIds.has(service.id) ? 'selected' : ''}`}
            onClick={() => toggleSelection(service.id)}
          >
            <div className="service-card-header">
              <span className="service-icon">{CATEGORY_ICONS[service.category] || '📦'}</span>
              <div className="service-card-check">
                {selectedIds.has(service.id) ? '✓' : ''}
              </div>
            </div>
            <h3 className="service-name">{service.name}</h3>
            <p className="service-description">{service.description}</p>
            <span className="service-category-badge">{service.category}</span>
            {service.requirements && (
              <div className="service-requirements">
                <div className="req-item">
                  <span className="req-label">RAM</span>
                  <span className="req-value">
                    {service.requirements.min_ram_mb >= 1024
                      ? `${(service.requirements.min_ram_mb / 1024).toFixed(0)} GB`
                      : `${service.requirements.min_ram_mb} MB`}
                    {' → '}
                    {service.requirements.recommended_ram_mb >= 1024
                      ? `${(service.requirements.recommended_ram_mb / 1024).toFixed(0)} GB`
                      : `${service.requirements.recommended_ram_mb} MB`}
                  </span>
                </div>
                <div className="req-item">
                  <span className="req-label">CPU</span>
                  <span className="req-value">
                    {service.requirements.min_cpu_cores} → {service.requirements.recommended_cpu_cores} cores
                  </span>
                </div>
                <div className="req-item">
                  <span className="req-label">Storage</span>
                  <span className="req-value">
                    {service.requirements.min_storage_gb} → {service.requirements.recommended_storage_gb} GB
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <div className="selection-info">
            <span className="selection-count">{selectedIds.size}</span>
            <span>service{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="selection-actions">
            <button className="btn-secondary" onClick={clearSelection}>Clear</button>
            <button className="btn-primary" onClick={getRecommendations}>
              Get Recommendations →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServicesPage;
