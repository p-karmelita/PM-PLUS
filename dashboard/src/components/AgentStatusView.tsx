import type { AgentHealth } from '../types';

const ALL_AGENTS = ['collector', 'risk_analyzer', 'reporter', 'resource_balancer'];

const DOT: Record<AgentHealth['status'], string> = {
  active: 'bg-emerald-400',
  waiting: 'bg-slate-600',
  negotiating: 'bg-amber-400 animate-pulse'
};

const LABEL: Record<string, string> = {
  collector: 'Collector',
  risk_analyzer: 'Risk Analyzer',
  reporter: 'Reporter',
  resource_balancer: 'Resource Balancer'
};

export default function AgentStatusView({ agents }: { agents: AgentHealth[] }) {
  const byName = new Map(agents.map((a) => [a.name, a]));

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Agent Status</h2>
      </div>
      <ul className="p-3 space-y-2">
        {ALL_AGENTS.map((name) => {
          const a = byName.get(name);
          const statusLabel = a ? a.status : 'waiting';
          return (
            <li key={name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[a?.status ?? 'waiting']}`} />
                <span className="text-slate-300">{LABEL[name]}</span>
              </span>
              <span className="text-xs font-mono text-slate-500 capitalize">{statusLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
