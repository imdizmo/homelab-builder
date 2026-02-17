import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { RecommendationResponse, Spec } from '../types';
import './RecommendationsPage.css';

function RecommendationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<'minimal' | 'recommended' | 'optimal'>('recommended');

  const serviceIds = (location.state as { serviceIds?: string[] })?.serviceIds;

  useEffect(() => {
    if (!serviceIds || serviceIds.length === 0) {
      navigate('/services');
      return;
    }
    generateRecommendations();
  }, []);

  async function generateRecommendations() {
    try {
      setLoading(true);
      const res = await api.getRecommendations(serviceIds!);
      setRecommendation(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  }

  function getActiveSpec(): Spec | null {
    if (!recommendation) return null;
    switch (activeTier) {
      case 'minimal': return recommendation.minimal_spec;
      case 'recommended': return recommendation.recommended_spec;
      case 'optimal': return recommendation.optimal_spec;
    }
  }

  function goToShoppingList() {
    const spec = getActiveSpec();
    if (spec) {
      navigate('/shopping-list', { state: { spec, tier: activeTier, serviceIds } });
    }
  }

  if (loading) {
    return (
      <div className="recommendations-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Generating hardware recommendations...</p>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="recommendations-page">
        <div className="error-state">
          <p>⚠️ {error || 'No data available'}</p>
          <button className="btn-primary" onClick={() => navigate('/services')}>Back to Services</button>
        </div>
      </div>
    );
  }

  const spec = getActiveSpec()!;

  return (
    <div className="recommendations-page">
      <div className="page-header">
        <h1>Hardware Recommendations</h1>
        <p>{recommendation.summary}</p>
      </div>

      <div className="tier-selector">
        {(['minimal', 'recommended', 'optimal'] as const).map((tier) => {
          const tierSpec = tier === 'minimal' ? recommendation.minimal_spec
            : tier === 'recommended' ? recommendation.recommended_spec
            : recommendation.optimal_spec;
          return (
            <button
              key={tier}
              className={`tier-card ${activeTier === tier ? 'active' : ''}`}
              onClick={() => setActiveTier(tier)}
            >
              <span className="tier-icon">
                {tier === 'minimal' ? '💡' : tier === 'recommended' ? '⚡' : '🚀'}
              </span>
              <span className="tier-name">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
              <span className="tier-price">
                {tierSpec.estimated_cost_min} – {tierSpec.estimated_cost_max} PLN
              </span>
            </button>
          );
        })}
      </div>

      <div className="spec-details">
        <div className="spec-grid">
          <SpecCard label="CPU" value={spec.cpu_suggestion} icon="🖥️" />
          <SpecCard label="RAM" value={spec.ram_suggestion} icon="🧠" />
          <SpecCard label="Storage" value={spec.storage_suggestion} icon="💾" />
          <SpecCard label="Network" value={spec.network_suggestion} icon="🌐" />
        </div>

        <div className="spec-resources">
          <h3>Resource Requirements</h3>
          <ResourceBar
            label="RAM"
            value={spec.total_ram_mb}
            max={recommendation.optimal_spec.total_ram_mb}
            unit="MB"
          />
          <ResourceBar
            label="CPU Cores"
            value={spec.total_cpu_cores}
            max={recommendation.optimal_spec.total_cpu_cores}
            unit=""
          />
          <ResourceBar
            label="Storage"
            value={spec.total_storage_gb}
            max={recommendation.optimal_spec.total_storage_gb}
            unit="GB"
          />
        </div>

        <div className="spec-rationale">
          <h3>About this tier</h3>
          <p>{spec.rationale}</p>
        </div>
      </div>

      <div className="selected-services-summary">
        <h3>Selected Services ({recommendation.selected_services.length})</h3>
        <div className="selected-services-list">
          {recommendation.selected_services.map((s) => (
            <span key={s.id} className="service-chip">{s.name}</span>
          ))}
        </div>
      </div>

      <div className="rec-actions">
        <button className="btn-secondary" onClick={() => navigate('/services')}>
          ← Change Services
        </button>
        <button className="btn-primary btn-large" onClick={goToShoppingList}>
          Generate Shopping List 🛒
        </button>
      </div>
    </div>
  );
}

function SpecCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="spec-card">
      <span className="spec-card-icon">{icon}</span>
      <span className="spec-card-label">{label}</span>
      <span className="spec-card-value">{value}</span>
    </div>
  );
}

function ResourceBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="resource-bar">
      <div className="resource-bar-header">
        <span>{label}</span>
        <span>{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value} {unit}</span>
      </div>
      <div className="resource-bar-track">
        <div className="resource-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default RecommendationsPage;
