import { AgentMessage } from '../types';

interface AllEventsViewProps {
  log: AgentMessage[];
}

export default function AllEventsView({ log }: AllEventsViewProps) {
  const sortedLog = [...log].sort((a, b) => 
    new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  const getAgentColor = (agentId?: string) => {
    const colors: Record<string, string> = {
      collector: 'bg-blue-100 text-blue-700',
      risk_analyzer: 'bg-red-100 text-red-700',
      resource_balancer: 'bg-purple-100 text-purple-700',
      reporter: 'bg-green-100 text-green-700',
      pm: 'bg-slate-100 text-slate-700',
      unknown: 'bg-gray-100 text-gray-700',
    };
    if (!agentId) return colors.unknown;
    return colors[agentId] || colors.unknown;
  };

  const getLoopBadge = (loop?: string) => {
    if (!loop) return null;
    const loopColors: Record<string, string> = {
      collect: 'bg-blue-500',
      loop1: 'bg-amber-500',
      loop2: 'bg-purple-500',
      loop3: 'bg-red-500',
      real: 'bg-emerald-500'
    };
    return (
      <span className={`inline-block w-2 h-2 rounded-full ${loopColors[loop] || 'bg-gray-500'}`} />
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">All Events</h2>
          <span className="text-sm text-slate-500">{log.length} events</span>
        </div>

        {log.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-sm">No events yet</div>
            <div className="text-xs mt-1">Run a demo to see agent activity</div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedLog.map((msg) => (
              <div
                key={msg.messageId}
                className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getLoopBadge(msg.content?.loop)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${getAgentColor(msg.fromAgentId)}`}>
                        {msg.fromAgentId}
                      </span>
                      <span className="text-xs text-slate-400">→</span>
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${getAgentColor(msg.toAgentId)}`}>
                        {msg.toAgentId}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(msg.sentAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-700">
                      {msg.content?.text || JSON.stringify(msg.content)}
                    </p>
                    
                    {msg.content?.employee && (
                      <div className="mt-1 text-xs text-slate-500">
                        Employee: {msg.content.employee}
                      </div>
                    )}
                  </div>
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
