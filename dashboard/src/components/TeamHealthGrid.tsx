import type { TeamMemberState } from '../types';

const WORKLOAD_COLOR: Record<TeamMemberState['workloadLabel'], string> = {
  overwhelmed: '#ef4444',
  heavy:       '#f59e0b',
  normal:      '#3b82f6',
  light:       '#10b981',
  unknown:     '#94a3b8',
};

const BORDER_CLASS: Record<TeamMemberState['workloadLabel'], string> = {
  overwhelmed: 'border-l-red-500',
  heavy:       'border-l-amber-500',
  normal:      'border-l-blue-500',
  light:       'border-l-emerald-500',
  unknown:     'border-l-slate-300',
};

function tagClass(t: string) {
  if (t === 'blocked' || t.includes('blocker')) return 'bg-red-50 text-red-500';
  if (t === 'available' || t === 'on track') return 'bg-emerald-50 text-emerald-600';
  if (t.includes('deadline') || t === 'watch') return 'bg-amber-50 text-amber-600';
  return 'bg-blue-50 text-blue-500';
}

function deriveTags(member: TeamMemberState): string[] {
  const tags: string[] = [];
  if (member.workloadLabel === 'overwhelmed') tags.push('blocked');
  if (member.workloadLabel === 'light') tags.push('available');
  if (member.riskSeverity === 'HIGH' || member.riskSeverity === 'CRITICAL') tags.push('deadline risk');
  if (member.workloadLabel === 'heavy') tags.push('watch closely');
  if (tags.length === 0) tags.push('on track');
  return tags;
}

function MemberCard({ member }: { member: TeamMemberState }) {
  const color = WORKLOAD_COLOR[member.workloadLabel];
  const borderClass = BORDER_CLASS[member.workloadLabel];
  const tags = deriveTags(member);
  const ts = member.lastCheckIn
    ? new Date(member.lastCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderClass} p-3.5`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: member.avatarGradient }}
        >
          {member.initials}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-800">{member.name}</div>
          <div className="text-[11px] text-slate-400">{member.role}</div>
        </div>
      </div>

      {/* Workload bar */}
      <div className="mb-2.5">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Workload</span>
          <span style={{ color, fontWeight: 600 }}>
            {member.workloadLabel === 'unknown' ? '—' : member.workloadLabel}
          </span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${member.workload}%`, background: color }}
          />
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span key={t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tagClass(t)}`}>
            {t}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-slate-400">
        {ts ? `Last check-in: ${ts}` : 'No check-in yet'}
        {member.riskCount > 0 && ` · ${member.riskCount} risk${member.riskCount > 1 ? 's' : ''}`}
      </div>
    </div>
  );
}

export default function TeamHealthGrid({ teamHealth }: { teamHealth: TeamMemberState[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Team Health</span>
        <span className="text-[11px] text-blue-500 cursor-pointer">View all →</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {teamHealth.map((m) => (
          <MemberCard key={m.name} member={m} />
        ))}
      </div>
    </div>
  );
}
