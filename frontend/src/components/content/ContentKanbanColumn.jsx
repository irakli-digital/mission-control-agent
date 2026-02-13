import { Badge } from '@/components/ui/badge';
import { ContentCard } from './ContentCard';
import { CONTENT_STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ContentKanbanColumn({
  status,
  items,
  onItemClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOver,
  dragging,
}) {
  const config = CONTENT_STATUS_CONFIG[status];
  const Icon = config?.icon;

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
        'flex-1 min-w-[180px] sm:min-w-[200px] transition-colors duration-200 rounded-lg',
        dragOver === status && 'bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => onDragOver?.(null, null)}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn('flex items-center gap-1.5', config?.color)}>
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-sm font-medium">{config?.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-muted text-muted-foreground">
          {items.length}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-2 min-h-[100px]">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onClick={onItemClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={dragging}
          />
        ))}

        {/* Drop zone placeholder */}
        {items.length === 0 && (
          <div
            className={cn(
              'text-xs text-muted-foreground/50 text-center py-8',
              'border border-dashed border-border rounded-lg',
              dragOver === status && 'border-primary/50 bg-primary/5'
            )}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
