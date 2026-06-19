import { useState } from 'react';
import { respondApproval } from '../api';
import type { ApprovalRequest } from '../types';

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'text-slate-300 border-slate-600',
  MEDIUM: 'text-amber-400 border-amber-700',
  HIGH: 'text-orange-400 border-orange-700',
  CRITICAL: 'text-red-400 border-red-700'
};

function ApprovalCard({
  req,
  onResolved
}: {
  req: ApprovalRequest;
  onResolved: (requestId: string) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = req.context || {};
  const severity = (ctx.severity as string) || 'MEDIUM';

  async function decide(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await respondApproval({
        requestId: req.requestId,
        approved,
        reason: note || (approved ? 'Approved by PM' : 'Rejected by PM'),
        flag_id: ctx.flag_id,
        pm_notes: note || undefined
      });
      onResolved(req.requestId); // optimistic removal
    } catch (e: any) {
      setError(e.message || 'Failed to submit decision');
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">{req.action}</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[severity] || SEVERITY_STYLE.MEDIUM}`}>
          {severity}
        </span>
      </div>
      {ctx.description && <p className="mt-1 text-xs text-slate-400">{ctx.description}</p>}
      {ctx.recommended_action && (
        <p className="mt-1 text-xs text-slate-500">
          <span className="text-slate-400">Recommended:</span> {ctx.recommended_action}
        </p>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="PM notes (optional)…"
        rows={2}
        className="mt-2 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
      />

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default function DecisionPanel({
  approvals,
  onResolved
}: {
  approvals: ApprovalRequest[];
  onResolved: (requestId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">HITL Decision Panel</h2>
        {approvals.length > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-orange-950/60 text-orange-400">
            {approvals.length} pending
          </span>
        )}
      </div>
      <div className="p-3 space-y-3">
        {approvals.length === 0 ? (
          <p className="text-sm text-slate-600">No decisions awaiting approval.</p>
        ) : (
          approvals.map((req) => (
            <ApprovalCard key={req.requestId} req={req} onResolved={onResolved} />
          ))
        )}
      </div>
    </div>
  );
}
