import { Clock, Coins, Archive } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatTime, formatTokens } from '@/hooks/useApi';
import { LoadingState } from '@/components/common';
import { cn } from '@/lib/utils';

export function StatsBar({ stats, loading, filterStatus, onFilterStatus }) {
  if (loading) {
    return <LoadingState type="stats" />;
  }

  if (!stats) return null;

  const items = [
    { label: 'Total', value: stats.total, color: 'text-foreground', status: null },
    { label: 'In Progress', value: stats.in_progress, color: 'text-blue-400', status: 'in_progress' },
    { label: 'Review', value: stats.review, color: 'text-purple-400', status: 'review' },
    { label: 'Done', value: stats.done, color: 'text-green-400', status: 'done' },
    { label: 'Blocked', value: stats.blocked, color: 'text-destructive', status: 'blocked' },
  ];

  return (
    <div className="flex gap-4 sm:gap-6 mb-6 px-1 overflow-x-auto">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => onFilterStatus?.(filterStatus === item.status ? null : item.status)}
          className={cn(
            'text-center shrink-0 rounded-lg px-2 py-1 transition-colors cursor-pointer',
            filterStatus === item.status && item.status !== null && 'bg-primary/10 ring-1 ring-primary/30',
          )}
        >
          <div className={cn('text-lg sm:text-xl font-bold', item.color)}>{item.value}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</div>
        </button>
      ))}

      {stats.total_time > 0 && (
        <>
          <Separator orientation="vertical" className="h-10 hidden sm:block" />
          <div className="text-center shrink-0">
            <div className="flex items-center justify-center gap-1 text-lg sm:text-xl font-bold text-blue-400">
              <Clock className="w-4 h-4" />
              {formatTime(stats.total_time)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Time</div>
          </div>
        </>
      )}

      {stats.total_tokens > 0 && (
        <div className="text-center shrink-0">
          <div className="flex items-center justify-center gap-1 text-lg sm:text-xl font-bold text-green-400">
            <Coins className="w-4 h-4" />
            {formatTokens(stats.total_tokens)}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Tokens</div>
        </div>
      )}

      {stats.archived > 0 && (
        <>
          <Separator orientation="vertical" className="h-10 hidden sm:block" />
          <div className="text-center shrink-0">
            <div className="flex items-center justify-center gap-1 text-lg sm:text-xl font-bold text-muted-foreground">
              <Archive className="w-4 h-4" />
              {stats.archived}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Archived</div>
          </div>
        </>
      )}
    </div>
  );
}
