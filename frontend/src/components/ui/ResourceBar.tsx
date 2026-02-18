
import './ResourceBar.css';

interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  formatValue?: (val: number) => string;
  unit?: string;
}

export function ResourceBar({ label, value, max, formatValue, unit }: ResourceBarProps) {
  const percent = Math.min((value / max) * 100, 100);
  const isHigh = percent > 75;
  const isCritical = percent > 90;

  let colorClass = 'bg-primary';
  if (isHigh) colorClass = 'bg-warning';
  if (isCritical) colorClass = 'bg-danger';

  return (
    <div className="resource-bar-container">
      <div className="rb-header">
        <span className="rb-label">{label}</span>
        <span className="rb-value">
          {formatValue ? formatValue(value) : value} 
          <span className="rb-unit">{unit}</span>
        </span>
      </div>
      <div className="rb-track">
        <div 
          className={`rb-fill ${colorClass}`} 
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
