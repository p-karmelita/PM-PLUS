import type { ApprovalRequest } from '../types';

type View = 'briefing' | 'weekly' | 'risks' | 'team-health' | 'events';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { icon: '⌂', label: 'Today\'s Briefing', key: 'briefing' as View },
      { icon: '⚠', label: 'Risks',             key: 'risks' as View },
      { icon: '◎', label: 'Team Health',        key: 'team-health' as View },
    ]
  },
  {
    label: 'AI Agents',
    items: [
      { icon: '⊛', label: 'Risk Analyzer', key: null },
      { icon: '≡', label: 'Reporter',      key: null },
      { icon: '⇄', label: 'Balancer',      key: null },
    ]
  },
  {
    label: 'Reports',
    items: [
      { icon: '↗', label: 'Weekly Summary', key: 'weekly' as View },
      { icon: '⊞', label: 'All Events',     key: 'events' as View },
    ]
  }
];

export default function Sidebar({
  approvals,
  activeView,
  onNavigate,
}: {
  approvals: ApprovalRequest[];
  activeView: View;
  onNavigate: (v: View) => void;
}) {
  return (
    <nav className="w-[210px] flex-shrink-0 flex flex-col" style={{ background: '#0f172a' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="text-lg font-extrabold text-white leading-tight">
          PM <span className="text-emerald-400">PLUS</span>
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>AI Project Intelligence</div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-2">
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.label} className="px-3 pt-3 pb-1">
            <div
              className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1"
              style={{ color: '#334155' }}
            >
              {sec.label}
            </div>
            {sec.items.map((item) => {
              const isActive = item.key === activeView;
              const isClickable = item.key !== null;
              const badge = item.label === 'Risks' && approvals.length > 0 ? approvals.length : null;
              return (
                <div
                  key={item.label}
                  onClick={() => item.key && onNavigate(item.key)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-px text-[12px] font-medium"
                  style={{
                    background: isActive ? 'rgba(52,211,153,0.1)' : 'transparent',
                    color: isActive ? '#34d399' : isClickable ? '#64748b' : '#374151',
                    cursor: isClickable ? 'pointer' : 'default',
                    opacity: isClickable ? 1 : 0.4,
                  }}
                >
                  <span className="w-4 text-center text-[13px]">{item.icon}</span>
                  <span>{item.label}</span>
                  {badge !== null && (
                    <span className="ml-auto text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                      {badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            TN
          </div>
          <div>
            <div className="text-[12px] font-semibold" style={{ color: '#e2e8f0' }}>Tamara N.</div>
            <div className="text-[10px]" style={{ color: '#475569' }}>Project Manager</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
