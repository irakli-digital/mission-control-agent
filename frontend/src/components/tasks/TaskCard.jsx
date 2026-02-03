import { MessageSquare, Clock, Coins, Calendar, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { timeAgo, formatTime, formatTokens } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

export function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  dragging,
  showProject = true,
}) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;

  const handleDragStart = (e) => {
    onDragStart?.(e, task);
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(task.id)}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer',
        'hover:border-primary/40 hover:bg-card/80',
        'transition-all duration-200 group',
        'active:scale-[0.98]',
        dragging === task.id && 'opacity-50 scale-95'
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', priorityConfig.dotColor)}
          title={priorityConfig.label}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground group-hover:text-white line-clamp-2">
            {task.title}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5 bg-primary/20 text-primary border-0"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Project */}
          {showProject && task.project && (
            <div className="flex items-center gap-1 text-[10px] text-purple-400 mt-1.5">
              <FolderOpen className="w-3 h-3" />
              {task.project}
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Assignees */}
            {task.assignees?.filter((a) => a.id).length > 0 && (
              <div className="flex -space-x-1">
                {task.assignees
                  .filter((a) => a.id)
                  .map((a) => (
                    <span
                      key={a.id}
                      className="text-xs"
                      title={a.name}
                    >
                      {a.emoji}
                    </span>
                  ))}
              </div>
            )}

            {task.comment_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                {task.comment_count}
              </span>
            )}

            {task.time_spent_minutes > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <Clock className="w-3 h-3" />
                {formatTime(task.time_spent_minutes)}
              </span>
            )}

            {task.token_spend > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <Coins className="w-3 h-3" />
                {formatTokens(task.token_spend)}
              </span>
            )}

            {task.due_date && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  isOverdue ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}

            <span className="text-xs text-muted-foreground/60 ml-auto">
              {timeAgo(task.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
