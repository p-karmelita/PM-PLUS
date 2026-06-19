import { useState } from 'react';
import { respondApproval } from '../api';
import type { ApprovalRequest } from '../types';

interface Props {
  approval: ApprovalRequest;
  onResolved: (requestId: string) => void;
}

export default function AttentionStrip({ approval, onResolved }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);

  const ctx = approval.context || {};
  const severity = (ctx.severity as string) || 'HIGH';
  const employeeName = ctx.employee_name || approval.action;
  const description = ctx.description || '';
  const recommended = ctx.recommended_action || '';
  const ts = new Date(approval.requestedAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  async function decide(approved: boolean) {
    setBusy(true);
    try {
      await respondApproval({
        requestId: approval.requestId,
        approved,
        reason: note || (approved ? 'Approved by PM' : 'Rejected by PM'),
        flag_id: ctx.flag_id,
        pm_notes: note || undefined
      });
      onResolved(approval.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border-l-4 border border-red-200 border-l-red-500 bg-red-50 px-4 py-3 flex gap-3 items-start">
      <span className="text-xl flex-shrink-0 pt-0.5">⏸</span>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-red-800">
          {employeeName} — Overload Risk ({severity})
        </div>
        {description && (
          <div className="text-[12px] text-red-500 mt-0.5 leading-relaxed">
            {description}
            {recommended && (
              <> Recommendation: <strong>{recommended}</strong>.</>
            )}
          </div>
        )}

        {expanded && (
          <div className="mt-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="PM notes (optional)…"
              rows={2}
              className="w-full rounded border border-red-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-red-400"
            />
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-1 text-[12px] font-semibold text-white"
          >
            ✓ Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="rounded bg-white hover:bg-red-50 disabled:opacity-50 border border-red-200 px-3 py-1 text-[12px] font-semibold text-red-500"
          >
            ✗ Reject
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-red-200 bg-transparent px-3 py-1 text-[12px] font-semibold text-red-800 hover:bg-red-100"
          >
            {expanded ? 'Hide' : 'Full context →'}
          </button>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[10px] font-bold text-red-400">{severity}</div>
        <div className="text-[10px] text-red-400 mt-0.5">{ts}</div>
        <div className="text-[10px] mt-1.5 bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-semibold">
          Loop 3 · HITL
        </div>
      </div>
    </div>
  );
}
