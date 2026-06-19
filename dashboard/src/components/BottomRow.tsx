import { useEffect, useState } from 'react';
import { fetchWeeklySnapshot, type WeeklySnapshot } from '../api';
import type { AgentHealth, TeamMemberState } from '../types';

const STATUS_CHIP: Record<AgentHealth['status'], { label: string; cls: string }> = {
  active:      { label: 'active',      cls: 'bg-emerald-50 text-emerald-600' },
  negotiating: { label: 'negotiating', cls: 'bg-amber-50 text-amber-600' },
  waiting:     { label: 'waiting',     cls: 'bg-slate-100 text-slate-500' },
};

const WORKLOAD_CHIP: Record<TeamMemberState['workloadLabel'], { label: string; cls: string }> = {
  overwhelmed: { label: 'blocked',    cls: 'bg-red-50 text-red-500' },
  heavy:       { label: 'watch',      cls: 'bg-amber-50 text-amber-600' },
  normal:      { label: 'on track',   cls: 'bg-emerald-50 text-emerald-600' },
  light:       { label: 'available',  cls: 'bg-emerald-50 text-emerald-600' },
  unknown:     { label: '—',          cls: 'bg-slate-100 text-slate-400' },
};

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-[12px] font-semibold">{children}</span>
    </div>
  );
}

interface Props {
  agents: AgentHealth[];
  teamHealth: TeamMemberState[];
}

export default function BottomRow({ agents, teamHealth }: Props) {
  const [snap, setSnap] = useState<WeeklySnapshot | null>(null);

  useEffect(() => {
    fetchWeeklySnapshot().then(setSnap).catch(() => null);
  }, []);

  const KNOWN_AGENT_NAMES = ['risk_analyzer', 'reporter', 'resource_balancer'];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* Weekly snapshot */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          This week's snapshot
        </div>
        <Row label="Check-ins processed">{snap?.total_check_ins ?? '—'}</Row>
        <Row label="Risk flags"><Chip label={snap ? `${snap.risk_flags}` : '—'} cls="bg-emerald-50 text-emerald-600" /></Row>
        <Row label="Total events">{snap?.total_events ?? '—'}</Row>
        <Row label="Period">{snap ? `${snap.period_days}d` : '—'}</Row>
      </div>

      {/* Agent health */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          Agent health
        </div>
        {KNOWN_AGENT_NAMES.map((name) => {
          const agent = agents.find((a) => a.name === name);
          const label = name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const chip = agent ? STATUS_CHIP[agent.status] : { label: 'idle', cls: 'bg-slate-100 text-slate-400' };
          return (
            <Row key={name} label={label}>
              <Chip label={chip.label} cls={chip.cls} />
            </Row>
          );
        })}
        <Row label="Active agents">{agents.filter(a => KNOWN_AGENT_NAMES.includes(a.name)).length}</Row>
      </div>

      {/* Resource allocations */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          Resource allocations
        </div>
        {teamHealth.map((m) => {
          const chip = WORKLOAD_CHIP[m.workloadLabel];
          return (
            <Row key={m.name} label={m.name}>
              <Chip label={chip.label} cls={chip.cls} />
            </Row>
          );
        })}
      </div>
    </div>
  );
}
