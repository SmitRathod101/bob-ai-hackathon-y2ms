interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan' | 'yellow';
  alert?: boolean;
}

const colorMap = {
  blue: 'border-blue-700/50 bg-blue-900/10',
  green: 'border-green-700/50 bg-green-900/10',
  red: 'border-red-700/50 bg-red-900/10',
  orange: 'border-orange-700/50 bg-orange-900/10',
  purple: 'border-purple-700/50 bg-purple-900/10',
  cyan: 'border-cyan-700/50 bg-cyan-900/10',
  yellow: 'border-yellow-700/50 bg-yellow-900/10',
};

export default function KpiCard({ title, value, subtitle, icon, color = 'blue', alert = false }: KpiCardProps) {
  return (
    <div className={`kpi-card border ${colorMap[color]} ${alert ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}
