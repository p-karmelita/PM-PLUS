import type { ProjectMetrics } from '../types';

const RISK_STYLE: Record<string, string> = {
  low: 'text-emerald-400 border-emerald-700 bg-emerald-950/40',
  medium: 'text-amber-400 border-amber-700 bg-amber-950/40',
  high: 'text-orange-400 border-orange-700 bg-orange-950/40',
  critical: 'text-red-400 border-red-700 bg-red-950/40'
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-slate-900/60 px-3 py-2">
      <div className="text-lg font-semibold text-slate-200">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export default function ProjectContextViewer({ metrics }: { metrics: ProjectMetrics | null }) {
  const risk = metrics?.riskLevel ?? 'low';

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Project Context</h2>
        <span className={`text-xs font-mono px-2 py-0.5 rounded border ${RISK_STYLE[risk]}`}>
          RISK: {risk.toUpperCase()}
        </span>
      </div>
      {metrics ? (
        <div className="p-3 grid grid-cols-2 gap-2">
          <Stat label="Total tasks" value={metrics.totalTasks} />
          <Stat label="Blocked" value={metrics.blockedTasks} />
          <Stat label="Active agents" value={metrics.activeAgents} />
          <Stat label="Utilization" value={`${Math.round(metrics.resourceUtilization)}%`} />
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-600">No metrics yet — risk context appears once data flows.</div>
      )}
    </div>
  );
}
