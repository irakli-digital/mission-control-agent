import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export function AgentAvatar({ agent, size = 'md', className }) {
  const initials = agent?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {agent?.avatar_url ? (
        <AvatarImage src={agent.avatar_url} alt={agent.name} />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
        {agent?.emoji || initials || <User className="w-4 h-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
