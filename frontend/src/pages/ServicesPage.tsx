import { useState, useEffect, useMemo } from 'react';
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

  // Real-time resource totals
  const resourceTotals = useMemo(() => {
    const totals = { ram: 0, cpu: 0, storage: 0, costMin: 0, costMax: 0 };
    for (const svc of services) {
      if (selectedIds.has(svc.id) && svc.requirements) {
        totals.ram += svc.requirements.recommended_ram_mb;
        totals.cpu += svc.requirements.recommended_cpu_cores;
        totals.storage += svc.requirements.recommended_storage_gb;
      }
    }
    // Add system overhead
    if (selectedIds.size > 0) {
      totals.ram += 1024;   // 1 GB OS/Docker
      totals.cpu += 0.5;    // OS overhead
      totals.storage += 20; // OS
    }
    // Rough cost estimate (PLN)
    if (selectedIds.size > 0) {
      const base = (totals.ram / 1024) * 80 + totals.cpu * 150 + totals.storage * 0.5 + 200;
      totals.costMin = Math.round(base * 0.8 / 50) * 50;
      totals.costMax = Math.round(base * 1.2 / 50) * 50;
    }
    return totals;
  }, [selectedIds, services]);

  // Max values for bar fill percentages (typical homelab ceiling)
  const maxRAM = 32768;   // 32 GB
  const maxCPU = 16;
  const maxStorage = 1000; // 1 TB

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
        <p>Click on services to add them to your homelab plan. Resource requirements update in real-time.</p>
      </div>

      <div className="services-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
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
              <div className={`service-card-check ${selectedIds.has(service.id) ? 'checked' : ''}`}>
                {selectedIds.has(service.id) && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <h3 className="service-name">{service.name}</h3>
            <p className="service-description">{service.description}</p>
            <div className="service-card-footer">
              <span className="service-category-badge">{service.category}</span>
              {service.requirements && (
                <span className="service-ram-badge">
                  {service.requirements.recommended_ram_mb >= 1024
                    ? `${(service.requirements.recommended_ram_mb / 1024).toFixed(0)} GB`
                    : `${service.requirements.recommended_ram_mb} MB`} RAM
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced selection bar with live resource meters */}
      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <div className="selection-bar-top">
            <div className="selection-info">
              <span className="selection-count">{selectedIds.size}</span>
              <span>service{selectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div className="selection-cost">
              <span className="cost-label">Est. cost:</span>
              <span className="cost-value">{resourceTotals.costMin} – {resourceTotals.costMax} PLN</span>
            </div>
          </div>

          <div className="resource-meters">
            <ResourceMeter
              label="RAM"
              value={resourceTotals.ram}
              max={maxRAM}
              displayValue={
                resourceTotals.ram >= 1024
                  ? `${(resourceTotals.ram / 1024).toFixed(1)} GB`
                  : `${resourceTotals.ram} MB`
              }
              color="var(--color-primary)"
            />
            <ResourceMeter
              label="CPU"
              value={resourceTotals.cpu}
              max={maxCPU}
              displayValue={`${resourceTotals.cpu.toFixed(1)} cores`}
              color="var(--color-accent)"
            />
            <ResourceMeter
              label="Storage"
              value={resourceTotals.storage}
              max={maxStorage}
              displayValue={`${resourceTotals.storage} GB`}
              color="#22c55e"
            />
          </div>

          <div className="selection-actions">
            <button className="btn-secondary" onClick={clearSelection}>Clear All</button>
            <button className="btn-primary" onClick={getRecommendations}>
              Get Recommendations →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceMeter({
  label,
  value,
  max,
  displayValue,
  color,
}: {
  label: string;
  value: number;
  max: number;
  displayValue: string;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const isHigh = pct > 75;
  return (
    <div className="resource-meter">
      <div className="rm-header">
        <span className="rm-label">{label}</span>
        <span className={`rm-value ${isHigh ? 'rm-high' : ''}`}>{displayValue}</span>
      </div>
      <div className="rm-track">
        <div
          className={`rm-fill ${isHigh ? 'rm-fill-high' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: isHigh ? '#ef4444' : color }}
        />
      </div>
    </div>
  );
}

export default ServicesPage;
