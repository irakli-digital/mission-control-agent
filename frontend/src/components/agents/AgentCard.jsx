import { ClipboardList, RefreshCw, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AgentAvatar } from './AgentAvatar';
import { AGENT_STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function AgentCard({ agent, onClick }) {
  const statusConfig = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.idle;

  return (
    <Card
      onClick={() => onClick?.(agent)}
      className={cn(
        'p-4 cursor-pointer transition-all duration-200',
        'hover:border-primary/50 hover:bg-card/80',
        'active:scale-[0.98]',
        'card-hover'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <AgentAvatar agent={agent} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{agent.name}</div>
          <div className="text-xs text-muted-foreground truncate">{agent.role}</div>
        </div>
        <div
          className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusConfig.color)}
          title={statusConfig.label}
        />
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          {agent.total_tasks} tasks
        </span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {agent.active_tasks} active
        </span>
        {agent.unread > 0 && (
          <span className="flex items-center gap-1.5 text-primary">
            <Bell className="w-3.5 h-3.5" />
            {agent.unread}
          </span>
        )}
      </div>
    </Card>
  );
}
