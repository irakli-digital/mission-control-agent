import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiPost } from '@/lib/fetch';

export function TaskCreateModal({ open, onOpenChange, agents = [], onCreated, defaultStatus }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setAssigneeIds([]);
  };

  const handleClose = (open) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const toggleAssignee = (id) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      };
      if (defaultStatus) body.status = defaultStatus;
      await apiPost('/api/tasks', body);
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error('[TaskCreateModal] Failed to create task:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSave()}
            />
          </div>

          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔴 Urgent</SelectItem>
                <SelectItem value="high">🟠 High</SelectItem>
                <SelectItem value="normal">⚪ Normal</SelectItem>
                <SelectItem value="low">🔵 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAssignee(agent.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    assigneeIds.includes(agent.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {agent.emoji} {agent.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
