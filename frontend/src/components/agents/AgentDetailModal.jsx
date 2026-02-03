import { useState } from 'react';
import { X, RefreshCw, ClipboardList, Eye, CheckCircle2, Activity } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentAvatar } from './AgentAvatar';
import { AGENT_STATUS_CONFIG } from '@/lib/constants';
import { useAgentTasks, useAgentActivities } from '@/hooks/useAgents';
import { timeAgo } from '@/hooks/useApi';
import { LoadingState } from '@/components/common';
import { cn } from '@/lib/utils';

export function AgentDetailModal({ agent, open, onOpenChange, onTaskClick }) {
  const [tab, setTab] = useState('tasks');
  const { tasks, loading: tasksLoading } = useAgentTasks(agent?.name);
  const { activities, loading: activitiesLoading } = useAgentActivities(agent?.name);

  if (!agent) return null;

  const statusConfig = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.idle;

  const tasksByStatus = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    assigned: tasks.filter((t) => t.status === 'assigned'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  const handleTaskClick = (taskId) => {
    onTaskClick?.(taskId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 bg-background border-border">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <AgentAvatar agent={agent} size="lg" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                {agent.name}
                <div
                  className={cn('w-2.5 h-2.5 rounded-full', statusConfig.color)}
                  title={statusConfig.label}
                />
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{agent.role}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{agent.total_tasks}</div>
              <div className="text-xs text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">{agent.active_tasks}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{agent.unread || 0}</div>
              <div className="text-xs text-muted-foreground">Unread</div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList className="mx-6 bg-muted/50">
            <TabsTrigger value="tasks" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="w-4 h-4" />
              Activity ({activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-0 p-6 pt-4">
            <ScrollArea className="h-[300px] pr-4">
              {tasksLoading ? (
                <LoadingState type="activity" count={3} />
              ) : (
                <div className="space-y-4">
                  {tasksByStatus.in_progress.length > 0 && (
                    <TaskSection
                      title="In Progress"
                      icon={RefreshCw}
                      color="text-amber-400"
                      tasks={tasksByStatus.in_progress}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {tasksByStatus.assigned.length > 0 && (
                    <TaskSection
                      title="Assigned"
                      icon={ClipboardList}
                      color="text-blue-400"
                      tasks={tasksByStatus.assigned}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {tasksByStatus.review.length > 0 && (
                    <TaskSection
                      title="Review"
                      icon={Eye}
                      color="text-purple-400"
                      tasks={tasksByStatus.review}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {tasksByStatus.done.length > 0 && (
                    <TaskSection
                      title="Done (recent)"
                      icon={CheckCircle2}
                      color="text-green-400"
                      tasks={tasksByStatus.done.slice(0, 5)}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {tasks.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No tasks assigned
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="mt-0 p-6 pt-4">
            <ScrollArea className="h-[300px] pr-4">
              {activitiesLoading ? (
                <LoadingState type="activity" count={5} />
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-2 text-xs py-2 border-b border-border last:border-0"
                    >
                      <span className="text-muted-foreground flex-1">{a.message}</span>
                      <span className="text-muted-foreground/60 shrink-0">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No activity yet
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function TaskSection({ title, icon: Icon, color, tasks, onTaskClick }) {
  return (
    <div>
      <h3 className={cn('text-xs font-semibold mb-2 flex items-center gap-1.5', color)}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      <div className="space-y-2">
        {tasks.map((t) => (
          <div
            key={t.id}
            onClick={() => onTaskClick(t.id)}
            className="bg-muted/50 p-3 rounded-md cursor-pointer hover:bg-muted transition-colors"
          >
            <div className="text-sm text-foreground">{t.title}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {timeAgo(t.updated_at || t.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
