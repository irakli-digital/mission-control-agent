import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiFetch } from '@/lib/fetch';

export function useAgentConfig() {
  const [agents, setAgents] = useState([]);
  const [cardsByAgent, setCardsByAgent] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [pendingHistory, setPendingHistory] = useState([]);

  // Keep a ref to the "original" (last-saved) state for diffing
  const savedStateRef = useRef({});

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiGet('/api/agent-config/agents');
      setAgents(data);
      return data;
    } catch (err) {
      console.error('[agent-config] Failed to fetch agents:', err);
      setError(err.message);
      return [];
    }
  }, []);

  const fetchAllCards = useCallback(async (agentList) => {
    const results = {};
    await Promise.all(agentList.map(async (agent) => {
      try {
        results[agent.id] = await apiGet(`/api/agent-config/agents/${agent.id}/cards`);
      } catch {
        results[agent.id] = [];
      }
    }));
    setCardsByAgent(results);
    savedStateRef.current = JSON.parse(JSON.stringify(results));
    setIsDirty(false);
    setUndoStack([]);
    setPendingHistory([]);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const agentList = await fetchAgents();
      if (agentList.length > 0) {
        await fetchAllCards(agentList);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchAgents, fetchAllCards]);

  useEffect(() => { refresh(); }, [refresh]);

  // Push current state to undo stack before mutation
  const pushUndo = useCallback(() => {
    setUndoStack(prev => {
      const snapshot = JSON.parse(JSON.stringify(cardsByAgent));
      const next = [...prev, snapshot];
      if (next.length > 20) next.shift();
      return next;
    });
  }, [cardsByAgent]);

  // Apply a local mutation (no save to server)
  const mutateCards = useCallback((newCardsByAgent, historyEntries = []) => {
    pushUndo();
    setCardsByAgent(newCardsByAgent);
    setIsDirty(true);
    if (historyEntries.length > 0) {
      setPendingHistory(prev => [...prev, ...historyEntries]);
    }
  }, [pushUndo]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop();
      setCardsByAgent(snapshot);
      // Check if we're back to saved state
      const isSame = JSON.stringify(snapshot) === JSON.stringify(savedStateRef.current);
      setIsDirty(!isSame);
      return next;
    });
  }, []);

  // Save all pending changes to server
  const saveAll = useCallback(async () => {
    // Determine which agents have changed
    const changes = {};
    for (const [agentId, cards] of Object.entries(cardsByAgent)) {
      const saved = savedStateRef.current[agentId];
      if (JSON.stringify(cards) !== JSON.stringify(saved)) {
        changes[agentId] = cards;
      }
    }

    if (Object.keys(changes).length === 0 && pendingHistory.length === 0) {
      setIsDirty(false);
      return;
    }

    const res = await apiFetch('/api/agent-config/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes, history: pendingHistory }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);

    savedStateRef.current = JSON.parse(JSON.stringify(cardsByAgent));
    setIsDirty(false);
    setUndoStack([]);
    setPendingHistory([]);
  }, [cardsByAgent, pendingHistory]);

  // Local-only card operations (no server save)
  const updateCardsLocal = useCallback((agentId, cards, historyEntries = []) => {
    const newState = { ...cardsByAgent, [agentId]: cards };
    mutateCards(newState, historyEntries);
  }, [cardsByAgent, mutateCards]);

  const moveCardLocal = useCallback((card, fromAgentId, toAgentId, insertIndex = -1) => {
    const fromCards = (cardsByAgent[fromAgentId] || []).filter(c => c.id !== card.id);
    const toCards = [...(cardsByAgent[toAgentId] || [])];
    const newCard = { ...card, agentId: toAgentId, id: `${toAgentId}--${card.file}--${Date.now()}`, index: toCards.length };
    if (insertIndex >= 0 && insertIndex < toCards.length) {
      toCards.splice(insertIndex, 0, newCard);
    } else {
      toCards.push(newCard);
    }
    const newState = { ...cardsByAgent, [fromAgentId]: fromCards, [toAgentId]: toCards };
    const hist = [{
      agent_id: toAgentId,
      file_name: card.file,
      card_title: card.title,
      action: 'move',
      moved_from_agent: fromAgentId,
      moved_to_agent: toAgentId,
    }];
    mutateCards(newState, hist);
  }, [cardsByAgent, mutateCards]);

  const reorderCardLocal = useCallback((agentId, cardId, newIndex) => {
    const cards = [...(cardsByAgent[agentId] || [])];
    const oldIndex = cards.findIndex(c => c.id === cardId);
    if (oldIndex < 0 || oldIndex === newIndex) return;
    const [card] = cards.splice(oldIndex, 1);
    // Adjust index if needed after removal
    const adjustedIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
    cards.splice(adjustedIndex, 0, card);
    // Update indices
    cards.forEach((c, i) => c.index = i);
    const hist = [{
      agent_id: agentId,
      file_name: card.file,
      card_title: card.title,
      action: 'reorder',
    }];
    const newState = { ...cardsByAgent, [agentId]: cards };
    mutateCards(newState, hist);
  }, [cardsByAgent, mutateCards]);

  const fetchHistory = useCallback(async (agent, limit = 50) => {
    const params = new URLSearchParams();
    if (agent) params.set('agent', agent);
    params.set('limit', limit);
    return apiGet(`/api/agent-config/history?${params}`);
  }, []);

  return {
    agents, cardsByAgent, loading, error, isDirty, undoStack,
    updateCardsLocal, moveCardLocal, reorderCardLocal,
    saveAll, undo, refresh, fetchHistory,
    mutateCards, pushUndo,
  };
}
