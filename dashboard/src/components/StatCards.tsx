import type { ApprovalRequest, LogLine, TeamMemberState } from '../types';

interface Props {
  approvals: ApprovalRequest[];
  log: LogLine[];
  teamHealth: TeamMemberState[];
}

export default function StatCards({ approvals, log, teamHealth }: Props) {
  const pendingCount = approvals.length;
  const firstApproval = approvals[0];
  const firstCtx = firstApproval?.context || {};

  const onTrackCount = teamHealth.filter(
    (m) => m.workloadLabel !== 'overwhelmed' && m.workloadLabel !== 'heavy'
  ).length;

  const checkInCount = log.filter(
    (l) => l.kind !== 'approval' && l.kind !== 'error' && l.from !== 'system'
  ).length;

  const lastCheckIn = log
    .filter((l) => l.kind !== 'error' && l.from !== 'system')
    .at(-1);

  const riskCount = log.filter((l) => l.kind === 'approval').length;

  const lastTs = lastCheckIn
    ? new Date(lastCheckIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {/* Needs approval */}
      <div className={`rounded-xl border p-3.5 ${pendingCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
        <div className={`text-3xl font-extrabold leading-none ${pendingCount > 0 ? 'text-red-500' : 'text-slate-700'}`}>
          {pendingCount}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          {pendingCount > 0 ? '⚠ Needs your approval' : 'No pending approvals'}
        </div>
        {pendingCount > 0 && firstCtx.employee_name && (
          <div className="text-[11px] font-semibold mt-1 text-red-500">
            ↑ {firstCtx.employee_name.split(' ')[0]} · {firstCtx.severity || 'HIGH'} risk
          </div>
        )}
      </div>

      {/* Team members */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="text-3xl font-extrabold leading-none text-slate-700">4</div>
        <div className="text-[11px] text-slate-400 mt-1">Team members tracked</div>
        <div className="text-[11px] font-semibold mt-1 text-emerald-500">
          ● {onTrackCount} on track
        </div>
      </div>

      {/* Check-ins */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="text-3xl font-extrabold leading-none text-slate-700">{checkInCount}</div>
        <div className="text-[11px] text-slate-400 mt-1">Messages today</div>
        <div className="text-[11px] font-medium mt-1 text-slate-400">
          {lastTs ? `last: ${lastTs}` : 'none yet'}
        </div>
      </div>

      {/* Risks flagged */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="text-3xl font-extrabold leading-none text-slate-700">{riskCount}</div>
        <div className="text-[11px] text-slate-400 mt-1">Risks flagged</div>
        {riskCount > 0 && (
          <div className="text-[11px] font-semibold mt-1 text-red-500">↑ this session</div>
        )}
      </div>
    </div>
  );
}
