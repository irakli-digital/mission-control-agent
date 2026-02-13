import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TaskCard } from './TaskCard';
import { STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { CheckSquare, Plus } from 'lucide-react';

const MOBILE_LIMIT = 5;

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOver,
  dragging,
  selectedTaskIds,
  onToggleSelect,
  onSelectAll,
  onAddTask,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const config = STATUS_CONFIG[status];
  const Icon = config?.icon;
  const taskIds = tasks.map((t) => t.id);
  const allSelected = taskIds.length > 0 && taskIds.every((id) => selectedTaskIds?.has(id));

  // Mobile: limit cards unless expanded
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const shouldLimit = isMobile && !mobileExpanded && tasks.length > MOBILE_LIMIT;
  const visibleTasks = shouldLimit ? tasks.slice(0, MOBILE_LIMIT) : tasks;
  const hiddenCount = tasks.length - MOBILE_LIMIT;

  const handleDragOver = (e) => {
    e.preventDefault();
    onDragOver?.(e, status);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    onDrop?.(e, status);
  };

  return (
    <div
      className={cn(
        'w-full sm:flex-1 sm:min-w-[200px] md:min-w-[240px] transition-colors duration-200 rounded-lg',
        dragOver === status && 'bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => onDragOver?.(null, null)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn('flex items-center gap-1.5', config?.color)}>
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-sm font-medium">{config?.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-muted text-muted-foreground">
          {tasks.length}
        </Badge>
        {onSelectAll && taskIds.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 ml-auto', allSelected && 'text-primary')}
            onClick={() => onSelectAll(taskIds)}
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-2 min-h-[60px] sm:min-h-[100px]">
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={dragging}
            selected={selectedTaskIds?.has(task.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}

        {shouldLimit && (
          <button
            onClick={() => setMobileExpanded(true)}
            className="w-full text-xs text-primary py-2 text-center hover:bg-primary/5 rounded-lg transition-colors"
          >
            Show more ({hiddenCount})
          </button>
        )}

        {tasks.length === 0 && (
          <div
            className={cn(
              'text-xs text-muted-foreground/50 text-center py-6 sm:py-8',
              'border border-dashed border-border rounded-lg',
              dragOver === status && 'border-primary/50 bg-primary/5'
            )}
          >
            Drop here
          </div>
        )}
      </div>

      {/* Add task button per column */}
      {onAddTask && (
        <button
          onClick={() => onAddTask(status)}
          className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground py-2 rounded-lg border border-dashed border-transparent hover:border-border transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
}
