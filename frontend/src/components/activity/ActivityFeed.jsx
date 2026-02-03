import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { timeAgo } from '@/hooks/useApi';
import { LoadingState, EmptyState } from '@/components/common';

export function ActivityFeed({ activities, loading }) {
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
        <Activity className="w-4 h-4" />
        Activity Feed
      </h3>

      {loading ? (
        <LoadingState type="activity" count={8} />
      ) : activities?.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity"
          description="Activity will appear here as agents work on tasks."
        />
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-1 pr-4">
            {activities?.map((a) => (
              <div
                key={a.id}
                className="flex gap-2 text-xs py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-muted-foreground shrink-0">{a.emoji || '•'}</span>
                <span className="text-muted-foreground flex-1">{a.message}</span>
                <span className="text-muted-foreground/60 shrink-0">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
