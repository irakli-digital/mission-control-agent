import { Calendar, ExternalLink, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ContentCard({
  item,
  onClick,
  onDragStart,
  onDragEnd,
  dragging,
}) {
  const platform = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.youtube;

  const handleDragStart = (e) => {
    onDragStart?.(e, item);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(item)}
      className={cn(
        'bg-card border border-l-[3px] border-border rounded-lg p-3 cursor-pointer',
        item.priority === 'urgent' ? 'border-l-red-500' :
        item.priority === 'high' ? 'border-l-orange-500' :
        item.priority === 'low' ? 'border-l-gray-500' : 'border-l-blue-500',
        'hover:border-primary/40 hover:bg-card/80',
        'transition-all duration-200 group',
        'active:scale-[0.98]',
        dragging === item.id && 'opacity-50 scale-95'
      )}
    >
      <div className="space-y-2">
        {/* Title */}
        <div className="text-sm font-medium text-foreground group-hover:text-white line-clamp-2">
          {item.title}
        </div>

        {/* Angle */}
        {item.angle && (
          <div className="text-xs text-muted-foreground line-clamp-1 italic">
            "{item.angle}"
          </div>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 bg-primary/20 text-primary border-0"
              >
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 bg-muted text-muted-foreground border-0"
              >
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {/* Platform */}
          <span className="text-xs" title={platform.label}>
            {platform.emoji}
          </span>

          {/* Scheduled date */}
          {item.scheduled_date && (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <Calendar className="w-3 h-3" />
              {formatDate(item.scheduled_date)}
            </span>
          )}

          {/* Thumbnail status */}
          {item.thumbnail_status && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                item.thumbnail_status === 'done' ? 'text-green-400' : 'text-muted-foreground'
              )}
              title={`Thumbnail: ${item.thumbnail_status}`}
            >
              <Image className="w-3 h-3" />
            </span>
          )}

          {/* Published link */}
          {item.published_url && (
            <a
              href={item.published_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
