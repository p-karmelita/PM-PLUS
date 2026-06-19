import { useEffect, useState } from 'react';
import { createSession } from './api';
import { useEventStream } from './hooks/useEventStream';
import StreamLogger from './components/StreamLogger';
import DecisionPanel from './components/DecisionPanel';
import AgentStatusView from './components/AgentStatusView';
import ProjectContextViewer from './components/ProjectContextViewer';
import MockDataGenerator from './components/MockDataGenerator';
import type { ConnectionStatus } from './types';

const STATUS_STYLE: Record<ConnectionStatus, { dot: string; label: string }> = {
  idle: { dot: 'bg-slate-500', label: 'Idle' },
  connecting: { dot: 'bg-amber-400 animate-pulse', label: 'Connecting' },
  connected: { dot: 'bg-emerald-400', label: 'Connected' },
  reconnecting: { dot: 'bg-amber-400 animate-pulse', label: 'Reconnecting' }
};

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const { status, log, approvals, agents, metrics, removeApproval } = useEventStream(sessionId);

  // Bootstrap a session on mount so the SSE connection has something to attach to.
  useEffect(() => {
    let cancelled = false;
    createSession()
      .then((res) => {
        if (!cancelled) setSessionId(res.sessionId);
      })
      .catch((err) => {
        if (!cancelled) setBootError(err.message || 'Failed to create session');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const s = STATUS_STYLE[status];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0c1320]">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            PM <span className="text-emerald-400">PLUS</span>
          </h1>
          <span className="text-xs text-slate-500 font-mono">Autonomous Multi-Agent Project Intelligence</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-500">
            session: <span className="text-slate-300">{sessionId ?? '—'}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className="text-slate-300">{s.label}</span>
          </span>
        </div>
      </header>

      {bootError && (
        <div className="m-4 rounded border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Could not reach the API ({bootError}). Make sure the backend is running:{' '}
          <code className="font-mono">npm run dev</code> on port 3000.
        </div>
      )}

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Live event stream — the centerpiece */}
        <section className="lg:col-span-2 min-h-[60vh]">
          <StreamLogger log={log} />
        </section>

        {/* Right rail */}
        <aside className="flex flex-col gap-4">
          <MockDataGenerator sessionId={sessionId} />
          <AgentStatusView agents={agents} />
          <ProjectContextViewer metrics={metrics} />
          <DecisionPanel approvals={approvals} onResolved={removeApproval} />
        </aside>
      </main>
    </div>
  );
}
