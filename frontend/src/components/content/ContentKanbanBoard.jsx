import { useState, useCallback } from 'react';
import { ContentKanbanColumn } from './ContentKanbanColumn';
import { CONTENT_STATUS_COLS } from '@/lib/constants';
import { LoadingState } from '@/components/common';

export function ContentKanbanBoard({ content, loading, onItemClick, onMoveContent }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = useCallback((e, item) => {
    setDragging(item.id);
    e.dataTransfer.setData('contentId', item.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDragOver(null);
  }, []);

  const handleDragOver = useCallback((e, status) => {
    if (status) {
      setDragOver(status);
    }
  }, []);

  const handleDrop = useCallback(async (e, status) => {
    e.preventDefault();
    const contentId = e.dataTransfer.getData('contentId');
    setDragOver(null);
    setDragging(null);

    if (contentId) {
      await onMoveContent?.(parseInt(contentId, 10), status);
    }
  }, [onMoveContent]);

  if (loading) {
    return <LoadingState type="kanban" />;
  }

  const columns = CONTENT_STATUS_COLS.map((status) => ({
    status,
    items: content.filter((c) => c.status === status),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <ContentKanbanColumn
          key={col.status}
          status={col.status}
          items={col.items}
          onItemClick={onItemClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          dragOver={dragOver}
          dragging={dragging}
        />
      ))}
    </div>
  );
}
