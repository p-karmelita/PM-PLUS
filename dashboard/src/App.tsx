import { useEffect, useState } from 'react';
import { createSession, runSimulation, triggerReal } from './api';
import { useEventStream } from './hooks/useEventStream';
import Sidebar from './components/Sidebar';
import StatCards from './components/StatCards';
import AttentionStrip from './components/AttentionStrip';
import TeamHealthGrid from './components/TeamHealthGrid';
import AgentGraph from './components/AgentGraph';
import BottomRow from './components/BottomRow';
import WeeklySummaryView from './components/WeeklySummaryView';

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
});

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [realBusy, setRealBusy] = useState(false);
  const [activeView, setActiveView] = useState<'briefing' | 'weekly'>('briefing');

  const { status, log, approvals, agents, metrics: _metrics, teamHealth, removeApproval } =
    useEventStream(sessionId);

  useEffect(() => {
    let cancelled = false;
    createSession()
      .then((res) => { if (!cancelled) setSessionId(res.sessionId); })
      .catch((err) => { if (!cancelled) setBootError(err.message || 'Failed to create session'); });
    return () => { cancelled = true; };
  }, []);

  async function runDemo() {
    if (!sessionId || demoBusy) return;
    setDemoBusy(true);
    try { await runSimulation(sessionId); } finally { setDemoBusy(false); }
  }

  async function runReal() {
    if (!sessionId || realBusy) return;
    setRealBusy(true);
    try { await triggerReal(sessionId); } finally { setRealBusy(false); }
  }

  const statusDot =
    status === 'connected'    ? 'bg-emerald-400' :
    status === 'connecting'   ? 'bg-amber-400 animate-pulse' :
    status === 'reconnecting' ? 'bg-amber-400 animate-pulse' :
    'bg-slate-400';

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>
      <Sidebar approvals={approvals} activeView={activeView} onNavigate={setActiveView} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <div>
            <div className="text-[15px] font-bold text-slate-800">
              {activeView === 'weekly' ? 'Weekly Summary' : "Today's Briefing"}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{TODAY}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-full px-3 py-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot}`} />
              <span className="text-[11px] font-semibold text-violet-600">
                {agents.filter(a => ['risk_analyzer','reporter','resource_balancer'].includes(a.name)).length} agent{agents.filter(a => ['risk_analyzer','reporter','resource_balancer'].includes(a.name)).length !== 1 ? 's' : ''} running
              </span>
            </div>
            {/* Session pill */}
            {sessionId && (
              <span className="hidden lg:inline text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                {sessionId.slice(0, 8)}…
              </span>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-500"
            >
              ↻ Refresh
            </button>
            <button
              disabled={!sessionId || demoBusy}
              onClick={runDemo}
              className="rounded-md bg-slate-900 hover:bg-slate-700 disabled:opacity-50 px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              {demoBusy ? 'Running…' : '▶ Run Demo'}
            </button>
            <button
              disabled={!sessionId || realBusy}
              onClick={runReal}
              className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
            >
              {realBusy ? 'Posting…' : '⚡ Trigger Real Pipeline'}
            </button>
          </div>
        </header>

        {/* Error banner */}
        {bootError && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            Could not reach the API ({bootError}). Make sure the backend is running:{' '}
            <code className="font-mono">npm run dev</code> on port 3000.
          </div>
        )}

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto scroll-thin p-5 flex flex-col gap-4">
          {activeView === 'weekly' ? (
            <WeeklySummaryView />
          ) : (
            <>
              <StatCards approvals={approvals} log={log} teamHealth={teamHealth} />

              {approvals[0] && (
                <AttentionStrip approval={approvals[0]} onResolved={removeApproval} />
              )}

              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
                <TeamHealthGrid teamHealth={teamHealth} />
                <AgentGraph log={log} agents={agents} approvals={approvals} />
              </div>

              <BottomRow agents={agents} teamHealth={teamHealth} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
