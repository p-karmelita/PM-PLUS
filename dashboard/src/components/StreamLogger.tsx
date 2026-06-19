import { useEffect, useRef } from 'react';
import type { LogLine } from '../types';

// Color-code by agent (matches the "color-coded by agent" requirement).
const AGENT_COLOR: Record<string, string> = {
  collector: 'text-sky-400',
  risk_analyzer: 'text-red-400',
  reporter: 'text-violet-400',
  resource_balancer: 'text-amber-400',
  pm: 'text-emerald-400',
  system: 'text-slate-500'
};

const LOOP_LABEL: Record<string, string> = {
  collect: 'COLLECT',
  loop1: 'LOOP 1 · HISTORY',
  loop2: 'LOOP 2 · NEGOTIATE',
  loop3: 'LOOP 3 · HITL',
  real: 'BAND'
};

function color(agent: string): string {
  return AGENT_COLOR[agent] || 'text-slate-300';
}

export default function StreamLogger({ log }: { log: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="h-full flex flex-col rounded-lg border border-slate-800 bg-[#0c1320]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Live Event Stream</h2>
        <span className="text-xs font-mono text-slate-500">{log.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3 font-mono text-[13px] leading-relaxed">
        {log.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            Waiting for agent activity… run the Mock Data Generator to start the loop.
          </div>
        ) : (
          log.map((line) => (
            <div key={line.id} className="py-1 border-b border-slate-900/60 last:border-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-600 text-[11px]">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                {line.loop && LOOP_LABEL[line.loop] && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {LOOP_LABEL[line.loop]}
                  </span>
                )}
                <span className={`font-semibold ${color(line.from)}`}>{line.from}</span>
                {line.to && (
                  <>
                    <span className="text-slate-600">→</span>
                    <span className={`font-semibold ${color(line.to)}`}>{line.to}</span>
                  </>
                )}
              </div>
              <div className="text-slate-300 mt-0.5 pl-1">{line.text}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
