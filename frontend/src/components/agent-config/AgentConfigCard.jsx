import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_COLORS = {
  rule: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  reference: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tool: 'bg-green-500/20 text-green-400 border-green-500/30',
  persona: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  constraint: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ALL_TYPES = ['rule', 'constraint', 'reference', 'tool', 'persona'];

export function AgentConfigCard({ card, onClick, onEdit, onDelete, onDuplicate, onUpdateType, agents, collapsed }) {
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  return (
    <div
      onClick={() => onClick?.(card)}
      className="group p-3 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-2 flex-1">
          {card.title}
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(card); }}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate to...
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {agents?.filter(a => a.id !== card.agentId).map(a => (
                  <DropdownMenuItem key={a.id} onClick={(e) => { e.stopPropagation(); onDuplicate?.(card, a.id); }}>
                    {a.emoji} {a.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              className="text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete?.(card); }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content preview */}
      {!collapsed && card.content && (
        <div className="mt-2 max-h-60 overflow-y-auto">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
            {card.content}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">
          {card.file}
        </Badge>
        {/* Clickable type badge with dropdown */}
        <DropdownMenu open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setTypeDropdownOpen(true); }}
              className="inline-flex"
            >
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:opacity-80 transition-opacity', TYPE_COLORS[card.type] || TYPE_COLORS.rule)}>
                {card.type}
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[120px]">
            {ALL_TYPES.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={(e) => {
                  e.stopPropagation();
                  if (type !== card.type) onUpdateType?.(card, type);
                  setTypeDropdownOpen(false);
                }}
                className={cn(type === card.type && 'bg-accent')}
              >
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 mr-2', TYPE_COLORS[type])}>
                  {type}
                </Badge>
                {type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
