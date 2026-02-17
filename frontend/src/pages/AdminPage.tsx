import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Service } from '../types';
import './AdminPage.css';

interface DashboardData {
  service_count: number;
  user_count: number;
  event_count: number;
  popular_services: { service_name: string; count: number }[];
}

function AdminPage() {
  const [tab, setTab] = useState<'dashboard' | 'services' | 'add'>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'services') loadServices();
  }, [tab]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await fetch('/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('Access denied');
      const data = await res.json();
      setDashboard(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function loadServices() {
    try {
      setLoading(true);
      const res = await fetch('/admin/services', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('Access denied');
      const data = await res.json();
      setServices(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  async function toggleService(id: string) {
    await fetch(`/admin/services/${id}/toggle`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
    });
    loadServices();
  }

  async function createService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      description: form.get('description'),
      category: form.get('category'),
      docker_support: true,
      min_ram_mb: Number(form.get('min_ram_mb')) || 256,
      recommended_ram_mb: Number(form.get('recommended_ram_mb')) || 512,
      min_cpu_cores: Number(form.get('min_cpu_cores')) || 0.5,
      recommended_cpu_cores: Number(form.get('recommended_cpu_cores')) || 1,
      min_storage_gb: Number(form.get('min_storage_gb')) || 1,
      recommended_storage_gb: Number(form.get('recommended_storage_gb')) || 5,
    };

    try {
      await api.createService(body);
      setTab('services');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  }

  if (error && error.includes('denied')) {
    return (
      <div className="admin-page">
        <div className="admin-denied">
          <h2>🔒 Admin Access Required</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>⚙️ Admin Panel</h1>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>Services</button>
        <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>Add Service</button>
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><p>Loading...</p></div>}

      {!loading && tab === 'dashboard' && dashboard && (
        <div className="admin-dashboard">
          <div className="stat-cards">
            <div className="stat-card"><div className="stat-num">{dashboard.service_count}</div><div className="stat-label">Services</div></div>
            <div className="stat-card"><div className="stat-num">{dashboard.user_count}</div><div className="stat-label">Users</div></div>
            <div className="stat-card"><div className="stat-num">{dashboard.event_count}</div><div className="stat-label">Events</div></div>
          </div>

          {dashboard.popular_services && dashboard.popular_services.length > 0 && (
            <div className="popular-section">
              <h3>Most Selected Services</h3>
              <table className="admin-table">
                <thead><tr><th>Service</th><th>Selections</th></tr></thead>
                <tbody>
                  {dashboard.popular_services.map((s) => (
                    <tr key={s.service_name}><td>{s.service_name}</td><td>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'services' && (
        <div className="admin-services">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Category</th><th>RAM</th><th>CPU</th><th>Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className={!s.is_active ? 'inactive' : ''}>
                  <td>{s.name}</td>
                  <td>{s.category}</td>
                  <td>{s.requirements ? `${s.requirements.recommended_ram_mb} MB` : '-'}</td>
                  <td>{s.requirements ? `${s.requirements.recommended_cpu_cores}` : '-'}</td>
                  <td>{s.is_active ? '✅' : '❌'}</td>
                  <td>
                    <button className="btn-sm" onClick={() => toggleService(s.id)}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'add' && (
        <form className="add-service-form" onSubmit={createService}>
          <div className="form-group">
            <label>Name *</label>
            <input name="name" required minLength={2} maxLength={255} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" rows={3} />
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select name="category" required>
              <option value="media">Media</option>
              <option value="networking">Networking</option>
              <option value="monitoring">Monitoring</option>
              <option value="storage">Storage</option>
              <option value="management">Management</option>
              <option value="home_automation">Home Automation</option>
              <option value="gaming">Gaming</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Min RAM (MB)</label><input name="min_ram_mb" type="number" defaultValue={256} /></div>
            <div className="form-group"><label>Rec RAM (MB)</label><input name="recommended_ram_mb" type="number" defaultValue={512} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Min CPU</label><input name="min_cpu_cores" type="number" step="0.5" defaultValue={0.5} /></div>
            <div className="form-group"><label>Rec CPU</label><input name="recommended_cpu_cores" type="number" step="0.5" defaultValue={1} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Min Storage (GB)</label><input name="min_storage_gb" type="number" defaultValue={1} /></div>
            <div className="form-group"><label>Rec Storage (GB)</label><input name="recommended_storage_gb" type="number" defaultValue={5} /></div>
          </div>
          <button type="submit" className="btn-primary">Create Service</button>
        </form>
      )}
    </div>
  );
}

export default AdminPage;
