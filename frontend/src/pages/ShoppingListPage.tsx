import { useLocation, useNavigate } from 'react-router-dom';
import type { Service, Spec, ShoppingListItem as ShoppingItemType } from '../types';
import './ShoppingListPage.css';

const CATEGORY_ORDER = ['cpu', 'ram', 'storage', 'case', 'network', 'accessories'];
const CATEGORY_LABELS: Record<string, string> = {
  cpu: 'Processor',
  ram: 'Memory',
  storage: 'Storage',
  case: 'Case & Power',
  network: 'Networking',
  accessories: 'Accessories',
};

function ShoppingListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { spec?: Spec; tier?: string; services?: Service[] } | undefined;

  if (!state?.spec) {
    return (
      <div className="shopping-page">
        <div className="error-state">
          <p>⚠️ No recommendation data. Please generate recommendations first.</p>
          <button className="btn-primary" onClick={() => navigate('/services')}>Select Services</button>
        </div>
      </div>
    );
  }

  const spec = state.spec;
  const items = generateLocalItems(spec);

  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof items>>((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  const totalCost = items.reduce((sum, item) => sum + item.estimated_price, 0);

  return (
    <div className="shopping-page">
      <div className="page-header">
        <h1>Shopping List</h1>
        <p>
          {state.tier?.charAt(0).toUpperCase()}{state.tier?.slice(1)} tier —
          Estimated total: <strong>{totalCost} PLN</strong>
        </p>
      </div>

      <div className="shopping-groups">
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="shopping-group">
            <h3 className="group-title">{CATEGORY_LABELS[category] || category}</h3>
            <div className="group-items">
              {catItems.map((item, idx) => (
                <div key={idx} className={`shopping-item priority-${item.priority}`}>
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    {item.priority === 'optional' && (
                      <span className="item-badge optional">Optional</span>
                    )}
                  </div>
                  <div className="item-price">{item.estimated_price} PLN</div>
                  <div className="item-links">
                    {item.purchase_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="purchase-link"
                      >
                        {link.store} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="shopping-summary">
        <div className="summary-row">
          <span>Essential items</span>
          <span>{items.filter(i => i.priority === 'essential').reduce((s, i) => s + i.estimated_price, 0)} PLN</span>
        </div>
        <div className="summary-row">
          <span>Optional items</span>
          <span>{items.filter(i => i.priority === 'optional').reduce((s, i) => s + i.estimated_price, 0)} PLN</span>
        </div>
        <div className="summary-row total">
          <span>Total Estimated Cost</span>
          <span>{totalCost} PLN</span>
        </div>
      </div>

      <div className="shopping-actions">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          ← Back to Recommendations
        </button>
        <button className="btn-secondary" onClick={() => window.print()}>
          🖨️ Print List
        </button>
        <button
          className="btn-primary btn-large"
          onClick={() =>
            navigate('/checklist', {
              state: { services: state?.services || [], tier: state?.tier },
            })
          }
        >
          What's Next? → Setup Guide
        </button>
      </div>
    </div>
  );
}

// Generate items client-side from spec (avoids requiring a saved recommendation in DB)
function generateLocalItems(spec: Spec): (ShoppingItemType & { purchase_links: { store: string; url: string }[] })[] {
  const items: (ShoppingItemType & { purchase_links: { store: string; url: string }[] })[] = [];

  // CPU
  items.push({
    name: spec.cpu_suggestion || 'CPU (see recommendation)',
    category: 'cpu',
    estimated_price: estimateCPUPrice(spec.total_cpu_cores),
    priority: 'essential',
    purchase_links: [
      { store: 'Amazon', url: `https://www.amazon.pl/s?k=${encodeURIComponent(spec.cpu_suggestion)}` },
      { store: 'Allegro', url: `https://allegro.pl/listing?string=${encodeURIComponent(spec.cpu_suggestion)}` },
      { store: 'x-kom', url: `https://www.x-kom.pl/szukaj?q=${encodeURIComponent(spec.cpu_suggestion)}` },
    ],
  });

  // RAM
  const ramGB = nextPow2(Math.ceil(spec.total_ram_mb / 1024));
  items.push({
    name: `${ramGB} GB DDR4 RAM`,
    category: 'ram',
    estimated_price: ramGB * 80,
    priority: 'essential',
    purchase_links: [
      { store: 'Amazon', url: `https://www.amazon.pl/s?k=${ramGB}GB+DDR4+RAM` },
      { store: 'Allegro', url: `https://allegro.pl/listing?string=${ramGB}GB+DDR4` },
    ],
  });

  // Storage
  const storageGB = nextPow2(Math.max(spec.total_storage_gb, 128));
  items.push({
    name: `${storageGB} GB NVMe SSD`,
    category: 'storage',
    estimated_price: Math.round(storageGB * 0.6),
    priority: 'essential',
    purchase_links: [
      { store: 'Amazon', url: `https://www.amazon.pl/s?k=${storageGB}GB+NVMe+SSD` },
      { store: 'Allegro', url: `https://allegro.pl/listing?string=${storageGB}GB+NVMe+SSD` },
    ],
  });

  // Case
  items.push({
    name: spec.total_cpu_cores <= 4 ? 'Mini PC Case (compact)' : 'Micro-ATX Case + 450W PSU',
    category: 'case',
    estimated_price: spec.total_cpu_cores <= 4 ? 200 : 350,
    priority: 'essential',
    purchase_links: [
      { store: 'Amazon', url: 'https://www.amazon.pl/s?k=obudowa+mini+ITX' },
      { store: 'Allegro', url: 'https://allegro.pl/listing?string=obudowa+mini+ITX' },
    ],
  });

  // Network cable
  items.push({
    name: 'Ethernet Cable CAT6 (2m)',
    category: 'network',
    estimated_price: 20,
    priority: 'essential',
    purchase_links: [
      { store: 'Amazon', url: 'https://www.amazon.pl/s?k=kabel+ethernet+cat6' },
      { store: 'Allegro', url: 'https://allegro.pl/listing?string=kabel+ethernet+cat6+2m' },
    ],
  });

  // USB for OS
  items.push({
    name: 'USB Flash Drive 16GB (for OS installation)',
    category: 'accessories',
    estimated_price: 25,
    priority: 'optional',
    purchase_links: [
      { store: 'Amazon', url: 'https://www.amazon.pl/s?k=pendrive+16GB' },
      { store: 'Allegro', url: 'https://allegro.pl/listing?string=pendrive+16GB' },
    ],
  });

  return items;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function estimateCPUPrice(cores: number): number {
  if (cores <= 2) return 400;
  if (cores <= 4) return 600;
  if (cores <= 8) return 900;
  return 1200;
}

export default ShoppingListPage;
