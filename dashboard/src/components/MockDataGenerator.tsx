import { useState } from 'react';
import { runSimulation, triggerReal } from '../api';

type Mode = 'sim' | 'real';

export default function MockDataGenerator({ sessionId }: { sessionId: string | null }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function run(mode: Mode) {
    if (!sessionId) return;
    setBusy(mode);
    setNote(null);
    try {
      if (mode === 'sim') {
        await runSimulation(sessionId);
        setNote({ kind: 'ok', text: 'Simulation started — watch the stream.' });
      } else {
        const res = await triggerReal(sessionId);
        const summary = res.posted?.map((p) => `${p.employee}:${p.status}`).join('  ') || 'posted';
        setNote({ kind: 'ok', text: `Real check-ins posted → ${summary}` });
      }
    } catch (e: any) {
      setNote({ kind: 'err', text: e.message || 'Request failed' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Mock Data Generator</h2>
      </div>
      <div className="p-3 space-y-2">
        <button
          disabled={!sessionId || busy !== null}
          onClick={() => run('sim')}
          className="w-full rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white"
        >
          {busy === 'sim' ? 'Running…' : '▶ Run Simulated Demo'}
        </button>
        <button
          disabled={!sessionId || busy !== null}
          onClick={() => run('real')}
          className="w-full rounded border border-slate-600 hover:border-slate-400 disabled:opacity-50 px-3 py-2 text-sm font-medium text-slate-200"
        >
          {busy === 'real' ? 'Posting…' : '⚡ Trigger Real Pipeline (Band)'}
        </button>

        <p className="text-[11px] text-slate-500">
          Simulated runs fully offline. Real mode posts Alice/Bob/Carol check-ins to Band and needs
          agent keys configured.
        </p>

        {note && (
          <p className={`text-xs ${note.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
