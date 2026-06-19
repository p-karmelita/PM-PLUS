import { ApprovalRequest } from '../types';

interface RisksViewProps {
  approvals: ApprovalRequest[];
  onResolved: (requestId: string) => void;
}

export default function RisksView({ approvals, onResolved }: RisksViewProps) {
  const handleApprove = async (request: ApprovalRequest) => {
    try {
      await fetch('/human/approval-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.requestId,
          approved: true,
          reason: 'Approved by PM'
        })
      });
      onResolved(request.requestId);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (request: ApprovalRequest) => {
    try {
      await fetch('/human/approval-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.requestId,
          approved: false,
          reason: 'Rejected by PM'
        })
      });
      onResolved(request.requestId);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Risk Flags & Approvals</h2>
        
        {approvals.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">✓</div>
            <div className="text-sm">No pending approvals</div>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div
                key={approval.requestId}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded">
                        {approval.context?.severity || 'HIGH'}
                      </span>
                      <span className="text-xs text-slate-500">
                        from {approval.agentId}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800 mb-2">
                      {approval.action}
                    </h3>
                    {approval.context?.description && (
                      <p className="text-sm text-slate-600 mb-2">
                        {approval.context.description}
                      </p>
                    )}
                    {approval.context?.recommended_action && (
                      <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                        <strong>Recommended:</strong> {approval.context.recommended_action}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleApprove(approval)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-semibold"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(approval)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-semibold"
                  >
                    ✗ Reject
                  </button>
                </div>
                
                <div className="text-xs text-slate-400 mt-3">
                  Requested: {new Date(approval.requestedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
