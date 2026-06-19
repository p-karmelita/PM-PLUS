import type { AgentHealth, ApprovalRequest, LogLine } from '../types';

interface LoopStates {
  loop1: 'idle' | 'active' | 'done';
  loop2: 'idle' | 'active' | 'done';
  loop3: 'idle' | 'waiting' | 'done';
}

function deriveLoopStates(log: LogLine[], approvals: ApprovalRequest[]): LoopStates {
  const l1any  = log.some((l) => l.loop === 'loop1');
  const l1done = log.some((l) => l.loop === 'loop1' && l.kind === 'response');
  const l2any  = log.some((l) => l.loop === 'loop2');
  const l2done = log.some((l) => l.loop === 'loop2' && l.kind === 'response');
  const l3waiting = approvals.length > 0;
  const l3done = log.some((l) => l.kind === 'approval') && !l3waiting;
  return {
    loop1: l1done ? 'done' : l1any ? 'active' : 'idle',
    loop2: l2done ? 'done' : l2any ? 'active' : 'idle',
    loop3: l3done ? 'done' : l3waiting ? 'waiting' : 'idle',
  };
}

function headerBadge(ls: LoopStates) {
  if (ls.loop3 === 'waiting') return { text: '● Loop 3 waiting', color: '#f87171', pulse: true };
  if (ls.loop3 === 'done' && ls.loop2 === 'done' && ls.loop1 === 'done')
    return { text: '✓ All loops done', color: '#34d399', pulse: false };
  if (ls.loop2 === 'active') return { text: '● Loop 2 active', color: '#fbbf24', pulse: true };
  if (ls.loop1 === 'active') return { text: '● Loop 1 active', color: '#34d399', pulse: true };
  return { text: '○ Idle', color: '#475569', pulse: false };
}

interface Props {
  log: LogLine[];
  agents: AgentHealth[];
  approvals: ApprovalRequest[];
}

export default function AgentGraph({ log, agents: _agents, approvals }: Props) {
  const ls = deriveLoopStates(log, approvals);
  const badge = headerBadge(ls);

  const riskActive = ls.loop1 !== 'idle' || ls.loop2 !== 'idle' || ls.loop3 !== 'idle';
  const pmActive   = ls.loop3 === 'waiting' || ls.loop3 === 'done';

  // Edge colours
  const l1fwd   = ls.loop1 === 'idle' ? '#1e293b' : '#10b981';
  const l1ret   = ls.loop1 === 'done' ? '#8b5cf6' : '#1e293b';
  const l2fwd   = ls.loop2 === 'idle' ? '#1e293b' : '#f59e0b';
  const l2ret   = ls.loop2 === 'done' ? '#f59e0b' : '#1e293b';
  const l3fwd   = ls.loop3 === 'idle' ? '#1e293b' : '#ef4444';

  // Label box text/colour
  const l1label = ls.loop1 === 'done' ? 'Loop 1 · done ✓' : ls.loop1 === 'active' ? 'Loop 1 · active…' : 'Loop 1 · History';
  const l2label = ls.loop2 === 'done' ? 'Loop 2 · done ✓' : ls.loop2 === 'active' ? 'Loop 2 · active…' : 'Loop 2 · Negotiate';
  const l3label = ls.loop3 === 'waiting' ? 'Loop 3 · ⏸ waiting' : ls.loop3 === 'done' ? 'Loop 3 · done ✓' : 'Loop 3 · HITL';

  const l1labelColor = ls.loop1 === 'done' ? '#34d399' : ls.loop1 === 'active' ? '#34d399' : '#334155';
  const l2labelColor = ls.loop2 !== 'idle' ? '#fbbf24' : '#334155';
  const l3labelColor = ls.loop3 === 'waiting' ? '#f87171' : ls.loop3 === 'done' ? '#34d399' : '#334155';

  const loopStatusItems = [
    {
      label: 'Loop 1 · History',
      labelColor: '#8b5cf6',
      status: ls.loop1 === 'done' ? '✓ done' : ls.loop1 === 'active' ? '● active' : '— idle',
      statusColor: ls.loop1 === 'done' ? '#10b981' : ls.loop1 === 'active' ? '#34d399' : '#334155',
      text: ls.loop1 === 'done' ? 'Risk → Reporter: history fetched' : 'Risk Analyzer queries Reporter',
      pulse: ls.loop1 === 'active',
    },
    {
      label: 'Loop 2 · Negotiate',
      labelColor: '#f59e0b',
      status: ls.loop2 === 'done' ? '✓ done' : ls.loop2 === 'active' ? '● active' : '— idle',
      statusColor: ls.loop2 === 'done' ? '#10b981' : ls.loop2 === 'active' ? '#fbbf24' : '#334155',
      text: ls.loop2 === 'done' ? 'Balancer: resource allocated' : 'Risk → Balancer: resource negotiation',
      pulse: ls.loop2 === 'active',
    },
    {
      label: 'Loop 3 · HITL',
      labelColor: ls.loop3 === 'waiting' ? '#ef4444' : '#ef4444',
      status: ls.loop3 === 'waiting' ? '⏸ waiting' : ls.loop3 === 'done' ? '✓ done' : '— idle',
      statusColor: ls.loop3 === 'waiting' ? '#ef4444' : ls.loop3 === 'done' ? '#10b981' : '#334155',
      text: ls.loop3 === 'waiting' ? 'Risk flag sent — approve or reject above' : 'Risk → PM Dashboard: human decision',
      pulse: ls.loop3 === 'waiting',
      highlight: ls.loop3 === 'waiting',
    },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: '#0f172a', border: '1px solid #1e293b' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '1px solid #1e293b' }}
      >
        <span className="text-[12px] font-bold" style={{ color: '#94a3b8' }}>Agent Collaboration</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{
            color: badge.color,
            background: `${badge.color}20`,
            animation: badge.pulse ? 'graph-pulse 1.1s infinite' : 'none',
          }}
        >
          {badge.text}
        </span>
      </div>

      {/* SVG */}
      <div className="px-3 pt-3 pb-2">
        <svg viewBox="0 0 288 312" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <marker id="ag-gray"   markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#334155"/></marker>
            <marker id="ag-green"  markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#10b981"/></marker>
            <marker id="ag-violet" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#8b5cf6"/></marker>
            <marker id="ag-amber"  markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#f59e0b"/></marker>
            <marker id="ag-amber-r" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto"><path d="M7,0 L0,3.5 L7,7 Z" fill="#f59e0b"/></marker>
            <marker id="ag-red"    markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#ef4444"/></marker>
            <filter id="ag-red-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="ag-green-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Trigger oval */}
          <ellipse cx="38" cy="156" rx="33" ry="20" fill="#0f172a" stroke="#334155" strokeWidth="1.5"/>
          <text x="38" y="151" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">Team</text>
          <text x="38" y="164" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">check-in</text>
          <line x1="71" y1="156" x2="82" y2="156" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ag-gray)"/>

          {/* Risk Analyzer */}
          <rect x="82" y="132" width="92" height="48" rx="9"
            fill="rgba(239,68,68,0.1)"
            stroke={riskActive ? '#ef4444' : '#334155'}
            strokeWidth={riskActive ? 2 : 1.5}
            filter={riskActive ? 'url(#ag-red-glow)' : undefined}
            style={riskActive ? { animation: 'graph-pulse 1.6s infinite' } : undefined}
          />
          <text x="128" y="153" textAnchor="middle" fill="#fca5a5" fontSize="11.5" fontWeight="700">Risk Analyzer</text>
          <text x="128" y="168" textAnchor="middle" fill="#ef4444" fontSize="9.5">
            {ls.loop3 === 'waiting' ? '● Loop 3 active' : ls.loop2 === 'active' ? '● Loop 2 active' : ls.loop1 === 'active' ? '● Loop 1 active' : riskActive ? '✓ processing done' : '○ waiting'}
          </text>

          {/* Loop 1 edges */}
          <path d="M 174,142  C 200,142  200,38  180,38" stroke={l1fwd} strokeWidth="1.8" fill="none" markerEnd={ls.loop1 === 'idle' ? 'url(#ag-gray)' : 'url(#ag-green)'}/>
          <path d="M 180,52  C 202,52  202,154  174,154" stroke={l1ret} strokeWidth="1.5" fill="none" strokeDasharray="5,3" markerEnd={ls.loop1 === 'done' ? 'url(#ag-violet)' : 'url(#ag-gray)'}/>
          <rect x="178" y="82" width="88" height="18" rx="5" fill={ls.loop1 !== 'idle' ? '#0d2818' : '#111827'} stroke={ls.loop1 !== 'idle' ? '#166534' : '#1e293b'} strokeWidth="1"/>
          <text x="222" y="94" textAnchor="middle" fill={l1labelColor} fontSize="9.5" fontWeight="700">{l1label}</text>

          {/* Reporter */}
          <rect x="180" y="14" width="104" height="46" rx="8" fill="rgba(139,92,246,0.12)" stroke={ls.loop1 !== 'idle' ? '#8b5cf6' : '#334155'} strokeWidth="1.6"/>
          <text x="232" y="35" textAnchor="middle" fill="#c4b5fd" fontSize="12" fontWeight="700">Reporter</text>
          <text x="232" y="51" textAnchor="middle" fill="#7c3aed" fontSize="9.5">
            {ls.loop1 === 'done' ? '3 blockers found ✓' : ls.loop1 === 'active' ? 'querying…' : 'waiting'}
          </text>

          {/* Loop 2 edges */}
          <path d="M 174,148  C 177,138  177,138  180,144" stroke={l2fwd} strokeWidth="1.8" fill="none" markerEnd={ls.loop2 === 'idle' ? 'url(#ag-gray)' : 'url(#ag-amber)'}/>
          <path d="M 180,158  C 177,168  177,168  174,162" stroke={l2ret} strokeWidth="1.5" fill="none" strokeDasharray="5,3" markerEnd={ls.loop2 === 'done' ? 'url(#ag-amber-r)' : 'url(#ag-gray)'}/>
          <rect x="160" y="186" width="88" height="18" rx="5" fill={ls.loop2 !== 'idle' ? '#1a1200' : '#111827'} stroke={ls.loop2 !== 'idle' ? '#78350f' : '#1e293b'} strokeWidth="1"/>
          <text x="204" y="198" textAnchor="middle" fill={l2labelColor} fontSize="9.5" fontWeight="700">{l2label}</text>

          {/* Balancer */}
          <rect x="180" y="132" width="104" height="46" rx="8" fill="rgba(245,158,11,0.1)" stroke={ls.loop2 !== 'idle' ? '#f59e0b' : '#334155'} strokeWidth="1.6"/>
          <text x="232" y="153" textAnchor="middle" fill="#fcd34d" fontSize="12" fontWeight="700">Balancer</text>
          <text x="232" y="169" textAnchor="middle" fill="#d97706" fontSize="9.5">
            {ls.loop2 === 'done' ? 'resource allocated ✓' : ls.loop2 === 'active' ? 'negotiating…' : 'waiting'}
          </text>

          {/* Loop 3 forward edge */}
          <path d="M 174,168  C 200,168  200,254  180,254" stroke={l3fwd} strokeWidth="2" fill="none" markerEnd={ls.loop3 === 'idle' ? 'url(#ag-gray)' : 'url(#ag-red)'}
            style={ls.loop3 === 'waiting' ? { animation: 'graph-pulse 1.1s infinite' } : undefined}
          />
          {/* Traveling dot only when waiting */}
          {ls.loop3 === 'waiting' && (
            <path d="M 174,168  C 200,168  200,254  180,254" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeDasharray="9,60"
              style={{ animation: 'dash-travel 1.2s linear infinite' }}
            />
          )}
          <rect x="178" y="210" width="88" height="18" rx="5"
            fill={ls.loop3 !== 'idle' ? '#1f0505' : '#111827'}
            stroke={ls.loop3 !== 'idle' ? '#7f1d1d' : '#1e293b'}
            strokeWidth="1"
            style={ls.loop3 === 'waiting' ? { animation: 'graph-pulse 1.1s infinite' } : undefined}
          />
          <text x="222" y="222" textAnchor="middle" fill={l3labelColor} fontSize="9.5" fontWeight="700">{l3label}</text>

          {/* PM Dashboard */}
          <rect x="180" y="252" width="104" height="46" rx="8"
            fill="rgba(16,185,129,0.1)"
            stroke={pmActive ? '#10b981' : '#334155'}
            strokeWidth={pmActive ? 2 : 1.5}
            filter={pmActive ? 'url(#ag-green-glow)' : undefined}
            style={pmActive ? { animation: 'graph-pulse 1.1s infinite' } : undefined}
          />
          <text x="232" y="273" textAnchor="middle" fill="#6ee7b7" fontSize="12" fontWeight="700">PM Dashboard</text>
          <text x="232" y="289" textAnchor="middle" fill="#10b981" fontSize="9.5">
            {ls.loop3 === 'waiting' ? '⏸ your decision' : ls.loop3 === 'done' ? '✓ decision made' : 'waiting for flag'}
          </text>
        </svg>
      </div>

      {/* Loop status strip */}
      <div style={{ borderTop: '1px solid #1e293b' }}>
        {loopStatusItems.map((item) => (
          <div
            key={item.label}
            className="px-3.5 py-2.5"
            style={{
              borderBottom: '1px solid #1e293b',
              background: item.highlight ? 'rgba(239,68,68,0.04)' : 'transparent',
            }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span
                className="text-[11px] font-bold"
                style={{
                  color: item.labelColor,
                  animation: item.pulse ? 'graph-pulse 1s infinite' : 'none',
                }}
              >
                {item.label}
              </span>
              <span
                className="text-[10px] font-bold"
                style={{
                  color: item.statusColor,
                  animation: item.pulse ? 'graph-pulse 1s infinite' : 'none',
                }}
              >
                {item.status}
              </span>
            </div>
            <div className="text-[11px]" style={{ color: '#475569' }}>{item.text}</div>
          </div>
        ))}
        {/* remove last divider */}
        <style>{`.loop-strip-last { border-bottom: none !important; }`}</style>
      </div>
    </div>
  );
}
