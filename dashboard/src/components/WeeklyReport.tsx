import { useState } from 'react';
import { fetchWeeklySnapshot, type WeeklySnapshot } from '../api';

export default function WeeklyReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<WeeklySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchWeeklySnapshot());
    } catch (e: any) {
      setError(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Weekly Report</h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-2 py-1 text-xs font-medium text-slate-200"
        >
          {loading ? 'Loading…' : '↻ Generate'}
        </button>
      </div>

      {error && (
        <p className="px-4 py-3 text-xs text-red-400">{error}</p>
      )}

      {!report && !error && (
        <p className="px-4 py-3 text-xs text-slate-500">
          Click Generate to pull the 7-day snapshot.
        </p>
      )}

      {report && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-slate-800 py-2">
              <div className="text-lg font-bold text-slate-100">{report.total_check_ins}</div>
              <div className="text-[10px] text-slate-500">check-ins</div>
            </div>
            <div className="rounded bg-slate-800 py-2">
              <div className={`text-lg font-bold ${report.risk_flags > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {report.risk_flags}
              </div>
              <div className="text-[10px] text-slate-500">risk flags</div>
            </div>
            <div className="rounded bg-slate-800 py-2">
              <div className="text-lg font-bold text-slate-100">{report.total_events}</div>
              <div className="text-[10px] text-slate-500">events</div>
            </div>
          </div>

          {Object.keys(report.by_employee).length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-slate-500 font-semibold tracking-wide">By team member</p>
              {Object.entries(report.by_employee).map(([name, data]) => (
                <div key={name} className="flex items-center justify-between text-xs rounded px-2 py-1.5 bg-slate-800/60">
                  <span className="text-slate-300 font-medium">{name}</span>
                  <span className="flex gap-3">
                    <span className="text-slate-400">{data.checkIns.length} check-in{data.checkIns.length !== 1 ? 's' : ''}</span>
                    {data.risks.length > 0 && (
                      <span className="text-amber-400">{data.risks.length} risk{data.risks.length !== 1 ? 's' : ''}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No team activity in the last 7 days.</p>
          )}
        </div>
      )}
    </div>
  );
}
