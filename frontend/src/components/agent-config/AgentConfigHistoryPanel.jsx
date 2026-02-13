import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACTION_COLORS = {
  create: 'bg-green-500/20 text-green-400',
  update: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
  move: 'bg-purple-500/20 text-purple-400',
  reorder: 'bg-orange-500/20 text-orange-400',
};

export function AgentConfigHistoryPanel({ open, onOpenChange, fetchHistory, agents }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAgent, setFilterAgent] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchHistory(filterAgent || undefined, 100)
      .then(setHistory)
      .catch(err => console.error('[agent-config] Failed to fetch history:', err))
      .finally(() => setLoading(false));
  }, [open, filterAgent, fetchHistory]);

  const agentName = (id) => {
    const a = agents?.find(a => a.id === id);
    return a ? `${a.emoji} ${a.name}` : id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Change History</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 flex-wrap mb-3">
          <Button
            variant={!filterAgent ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setFilterAgent('')}
          >
            All
          </Button>
          {agents?.map(a => (
            <Button
              key={a.id}
              variant={filterAgent === a.id ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs"
              onClick={() => setFilterAgent(a.id)}
            >
              {a.emoji} {a.name}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="p-2.5 rounded-lg border border-border bg-card text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn('text-[10px] px-1.5 py-0 h-4', ACTION_COLORS[h.action])}>
                  {h.action}
                </Badge>
                <span className="font-medium text-foreground">{h.card_title || h.file_name}</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {new Date(h.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {agentName(h.agent_id)}
                {h.action === 'move' && h.moved_from_agent && (
                  <span> — from {agentName(h.moved_from_agent)} → {agentName(h.moved_to_agent)}</span>
                )}
              </div>
              {h.old_content && (
                <pre className="mt-1 text-xs text-red-400/70 whitespace-pre-wrap line-clamp-3">- {h.old_content.slice(0, 200)}</pre>
              )}
              {h.new_content && (
                <pre className="mt-1 text-xs text-green-400/70 whitespace-pre-wrap line-clamp-3">+ {h.new_content.slice(0, 200)}</pre>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
