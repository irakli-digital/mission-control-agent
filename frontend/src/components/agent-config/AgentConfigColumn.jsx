import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { AgentConfigCard } from './AgentConfigCard';
import { cn } from '@/lib/utils';

export function AgentConfigColumn({
  agent,
  cards,
  onCardClick,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCardType,
  onAddCard,
  agents,
  dragOverAgent,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dropIndicator,
  onCardDragOver,
  onCardDragLeave,
}) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(agent.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop?.(agent.id);
  };

  return (
    <div
      className={cn(
        'flex-shrink-0 w-[280px] md:w-[300px] flex flex-col rounded-lg transition-colors',
        dragOverAgent === agent.id && 'bg-primary/5 ring-1 ring-primary/20'
      )}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          onDragOver?.(null);
          onCardDragLeave?.();
        }
      }}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-base">{agent.emoji}</span>
        <span className="text-sm font-medium text-foreground">{agent.name}</span>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-muted text-muted-foreground">
          {cards.length}
        </Badge>
      </div>

      <div className="flex-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        <div className="space-y-2">
          {cards.map((card, index) => (
            <div key={card.id}>
              {/* Drop indicator before this card */}
              {dropIndicator?.agentId === agent.id && dropIndicator?.index === index && (
                <div className="h-0.5 bg-blue-500 rounded-full mx-1 mb-1" />
              )}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', card.id);
                  e.dataTransfer.effectAllowed = 'move';
                  if (e.target) {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                  onDragStart?.(card);
                }}
                onDragEnd={() => onDragEnd?.()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  const dropIndex = e.clientY < midY ? index : index + 1;
                  onCardDragOver?.(agent.id, dropIndex);
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <AgentConfigCard
                  card={card}
                  onClick={onCardClick}
                  onEdit={onEditCard}
                  onDelete={onDeleteCard}
                  onDuplicate={onDuplicateCard}
                  onUpdateType={onUpdateCardType}
                  agents={agents}
                />
              </div>
              {/* Drop indicator after last card */}
              {index === cards.length - 1 && dropIndicator?.agentId === agent.id && dropIndicator?.index === cards.length && (
                <div className="h-0.5 bg-blue-500 rounded-full mx-1 mt-1" />
              )}
            </div>
          ))}
          {cards.length === 0 && (
            <div className={cn(
              'text-xs text-muted-foreground/50 text-center py-8 border border-dashed rounded-lg',
              dragOverAgent === agent.id ? 'border-primary/50 bg-primary/5' : 'border-border'
            )}>
              {dragOverAgent === agent.id ? 'Drop here' : 'No cards'}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onAddCard?.(agent.id)}
        className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground py-2 rounded-lg border border-dashed border-transparent hover:border-border transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add card</span>
      </button>
    </div>
  );
}
