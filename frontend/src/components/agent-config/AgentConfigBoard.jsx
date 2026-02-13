import { useState, useCallback, useMemo } from 'react';
import { useAgentConfig } from '@/hooks/useAgentConfig';
import { AgentConfigColumn } from './AgentConfigColumn';
import { AgentConfigEditModal } from './AgentConfigEditModal';
import { AgentConfigHistoryPanel } from './AgentConfigHistoryPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Undo2, Save, History } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AgentConfigBoard() {
  const {
    agents, cardsByAgent, loading, isDirty, undoStack,
    updateCardsLocal, moveCardLocal, reorderCardLocal,
    saveAll, undo, refresh, fetchHistory, mutateCards, pushUndo,
  } = useAgentConfig();

  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('All');
  const [editingCard, setEditingCard] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isNewCard, setIsNewCard] = useState(false);
  const [draggingCard, setDraggingCard] = useState(null);
  const [dragOverAgent, setDragOverAgent] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null); // { agentId, index }
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const allFileNames = useMemo(() => {
    const names = new Set();
    for (const cards of Object.values(cardsByAgent)) {
      for (const card of cards) {
        if (card.file) names.add(card.file);
      }
    }
    return ['All', ...Array.from(names).sort()];
  }, [cardsByAgent]);

  const filteredCardsByAgent = useMemo(() => {
    const result = {};
    for (const [agentId, cards] of Object.entries(cardsByAgent)) {
      let filtered = cards;
      if (fileFilter !== 'All') {
        filtered = filtered.filter(c => c.file === fileFilter);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c =>
          c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q)
        );
      }
      result[agentId] = filtered;
    }
    return result;
  }, [cardsByAgent, searchQuery, fileFilter]);

  const handleCardClick = useCallback((card) => {
    setEditingCard(card);
    setIsNewCard(false);
    setEditModalOpen(true);
  }, []);

  const handleAddCard = useCallback((agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setEditingCard({ agentId, file: agent?.mdFiles?.[0] || 'AGENTS.md' });
    setIsNewCard(true);
    setEditModalOpen(true);
  }, [agents]);

  const handleSaveCard = useCallback((updatedCard) => {
    const agentId = updatedCard.agentId;
    const currentCards = [...(cardsByAgent[agentId] || [])];
    const historyEntries = [];

    if (isNewCard) {
      const newCard = {
        ...updatedCard,
        id: `${agentId}--${updatedCard.file}--${Date.now()}`,
        agentId,
        index: currentCards.length,
      };
      currentCards.push(newCard);
      historyEntries.push({
        agent_id: agentId,
        file_name: updatedCard.file,
        card_title: updatedCard.title,
        action: 'create',
        new_content: updatedCard.content,
      });
    } else {
      const idx = currentCards.findIndex(c => c.id === updatedCard.id);
      if (idx >= 0) {
        historyEntries.push({
          agent_id: agentId,
          file_name: updatedCard.file,
          card_title: updatedCard.title,
          action: 'update',
          old_content: currentCards[idx].content,
          new_content: updatedCard.content,
        });
        currentCards[idx] = updatedCard;
      }
    }

    updateCardsLocal(agentId, currentCards, historyEntries);
  }, [cardsByAgent, isNewCard, updateCardsLocal]);

  const handleDeleteCard = useCallback((card) => {
    const currentCards = (cardsByAgent[card.agentId] || []).filter(c => c.id !== card.id);
    updateCardsLocal(card.agentId, currentCards, [{
      agent_id: card.agentId,
      file_name: card.file,
      card_title: card.title,
      action: 'delete',
      old_content: card.content,
    }]);
  }, [cardsByAgent, updateCardsLocal]);

  const handleDuplicateCard = useCallback((card, toAgentId) => {
    const targetCards = [...(cardsByAgent[toAgentId] || [])];
    targetCards.push({
      ...card,
      id: `${toAgentId}--${card.file}--${Date.now()}`,
      agentId: toAgentId,
      index: targetCards.length,
    });
    updateCardsLocal(toAgentId, targetCards, [{
      agent_id: toAgentId,
      file_name: card.file,
      card_title: card.title,
      action: 'create',
      new_content: card.content,
    }]);
  }, [cardsByAgent, updateCardsLocal]);

  const handleUpdateCardType = useCallback((card, newType) => {
    const currentCards = [...(cardsByAgent[card.agentId] || [])];
    const idx = currentCards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      currentCards[idx] = { ...currentCards[idx], type: newType, customType: newType };
      updateCardsLocal(card.agentId, currentCards, [{
        agent_id: card.agentId,
        file_name: card.file,
        card_title: card.title,
        action: 'update',
        old_content: `type: ${card.type}`,
        new_content: `type: ${newType}`,
      }]);
    }
  }, [cardsByAgent, updateCardsLocal]);

  const handleDrop = useCallback((toAgentId) => {
    if (!draggingCard) {
      setDragOverAgent(null);
      setDropIndicator(null);
      return;
    }

    const dropIdx = dropIndicator?.agentId === toAgentId ? dropIndicator.index : -1;

    if (draggingCard.agentId === toAgentId) {
      // Same column reorder
      if (dropIdx >= 0) {
        reorderCardLocal(toAgentId, draggingCard.id, dropIdx);
      }
    } else {
      // Cross-column move
      moveCardLocal(draggingCard, draggingCard.agentId, toAgentId, dropIdx);
    }

    setDragOverAgent(null);
    setDraggingCard(null);
    setDropIndicator(null);
  }, [draggingCard, dropIndicator, moveCardLocal, reorderCardLocal]);

  const handleCardDragOver = useCallback((agentId, index) => {
    setDropIndicator({ agentId, index });
    setDragOverAgent(agentId);
  }, []);

  const handleCardDragLeave = useCallback(() => {
    setDropIndicator(null);
  }, []);

  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    try {
      await saveAll();
    } catch (err) {
      console.error('[agent-config] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [saveAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading agent configs...
      </div>
    );
  }

  const currentAgent = editingCard ? agents.find(a => a.id === editingCard.agentId) : null;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="pl-9"
          />
        </div>

        {undoStack.length > 0 && (
          <Button variant="outline" size="sm" onClick={undo} className="gap-1.5">
            <Undo2 className="w-4 h-4" />
            Undo
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="gap-1.5"
        >
          <History className="w-4 h-4" />
          History
        </Button>

        <Button
          size="sm"
          onClick={handleSaveAll}
          disabled={!isDirty || saving}
          className={cn(
            'gap-1.5 transition-all',
            isDirty && !saving && 'bg-green-600 hover:bg-green-700 text-white animate-pulse'
          )}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>

        {isDirty && (
          <span className="text-xs text-amber-400">Unsaved changes</span>
        )}
      </div>

      {/* File filter buttons */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {allFileNames.map((name) => (
          <Button
            key={name}
            variant={fileFilter === name ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-7 text-xs px-2.5',
              fileFilter === name
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setFileFilter(name)}
          >
            {name}
          </Button>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {agents.map((agent) => (
          <AgentConfigColumn
            key={agent.id}
            agent={agent}
            cards={filteredCardsByAgent[agent.id] || []}
            onCardClick={handleCardClick}
            onEditCard={handleCardClick}
            onDeleteCard={handleDeleteCard}
            onDuplicateCard={handleDuplicateCard}
            onUpdateCardType={handleUpdateCardType}
            onAddCard={handleAddCard}
            agents={agents}
            dragOverAgent={dragOverAgent}
            onDragStart={setDraggingCard}
            onDragEnd={() => { setDraggingCard(null); setDragOverAgent(null); setDropIndicator(null); }}
            onDragOver={setDragOverAgent}
            onDrop={handleDrop}
            dropIndicator={dropIndicator}
            onCardDragOver={handleCardDragOver}
            onCardDragLeave={handleCardDragLeave}
          />
        ))}
      </div>

      <AgentConfigEditModal
        card={editingCard}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSaveCard}
        mdFiles={currentAgent?.mdFiles || []}
        isNew={isNewCard}
      />

      <AgentConfigHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        fetchHistory={fetchHistory}
        agents={agents}
      />
    </div>
  );
}
