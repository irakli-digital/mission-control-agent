import { useState, useCallback } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { STATUS_COLS } from '@/lib/constants';
import { LoadingState } from '@/components/common';

export function KanbanBoard({ tasks, loading, onTaskClick, onMoveTask }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Filter out recurring tasks - they go in separate section
  const nonRecurring = tasks.filter((t) => !t.recurrence);

  const handleDragStart = useCallback((e, task) => {
    setDragging(task.id);
    e.dataTransfer.setData('taskId', task.id.toString());
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
    const taskId = e.dataTransfer.getData('taskId');
    setDragOver(null);
    setDragging(null);

    if (taskId) {
      await onMoveTask?.(parseInt(taskId, 10), status);
    }
  }, [onMoveTask]);

  if (loading) {
    return <LoadingState type="kanban" />;
  }

  const columns = STATUS_COLS.map((status) => ({
    status,
    tasks: nonRecurring.filter((t) => t.status === status),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          tasks={col.tasks}
          onTaskClick={onTaskClick}
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
