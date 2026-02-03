import { useState } from 'react';
import { ChevronDown, Repeat, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { cn } from '@/lib/utils';

export function RecurringJobs({ tasks, agents, onTaskClick }) {
  const [expanded, setExpanded] = useState(false);
  const recurring = tasks.filter((t) => t.recurrence);

  if (recurring.length === 0) return null;

  // Group recurring tasks by agent
  const tasksByAgent = {};
  agents.forEach((a) => {
    tasksByAgent[a.id] = { agent: a, tasks: [] };
  });
  tasksByAgent['unassigned'] = { agent: { id: 'unassigned', name: 'Unassigned' }, tasks: [] };

  recurring.forEach((t) => {
    const assignee = t.assignees?.find((a) => a.id);
    if (assignee && tasksByAgent[assignee.id]) {
      tasksByAgent[assignee.id].tasks.push(t);
    } else {
      tasksByAgent['unassigned'].tasks.push(t);
    }
  });

  return (
    <Card className="mb-6 overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Repeat className="w-3.5 h-3.5" />
          Recurring Jobs
          <span className="text-muted-foreground/60">({recurring.length})</span>
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 border-t border-border pt-4">
          {agents.map((agent) => {
            const agentTasks = tasksByAgent[agent.id]?.tasks || [];
            if (agentTasks.length === 0) return null;

            return (
              <div key={agent.id} className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <AgentAvatar agent={agent} size="sm" />
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {agent.name}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {agentTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className={cn(
                        'bg-muted/50 border border-border rounded-md px-2.5 py-2',
                        'cursor-pointer hover:border-primary/40 hover:bg-muted transition-colors'
                      )}
                    >
                      <div className="text-xs text-foreground truncate">
                        {t.title.replace(/\s*\([^)]*\)\s*$/, '')}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <Repeat className="w-3 h-3" />
                        {t.recurrence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {tasksByAgent['unassigned'].tasks.length > 0 && (
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Unassigned</span>
              </div>
              <div className="space-y-1.5">
                {tasksByAgent['unassigned'].tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t.id)}
                    className={cn(
                      'bg-muted/50 border border-border rounded-md px-2.5 py-2',
                      'cursor-pointer hover:border-primary/40 hover:bg-muted transition-colors'
                    )}
                  >
                    <div className="text-xs text-foreground truncate">
                      {t.title.replace(/\s*\([^)]*\)\s*$/, '')}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <Repeat className="w-3 h-3" />
                      {t.recurrence}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
