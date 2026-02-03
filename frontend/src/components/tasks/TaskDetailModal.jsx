import { useState } from 'react';
import {
  X,
  Archive,
  Clock,
  Coins,
  MessageSquare,
  FolderOpen,
  Plus,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { STATUS_CONFIG, STATUS_COLS } from '@/lib/constants';
import { useTask } from '@/hooks/useTasks';
import { timeAgo, formatTime, formatTokens } from '@/hooks/useApi';
import { LoadingState } from '@/components/common';
import { cn } from '@/lib/utils';

export function TaskDetailModal({ taskId, agents, open, onOpenChange, onRefresh }) {
  const { task, loading, addTime, addTokens, addComment } = useTask(taskId);
  const [comment, setComment] = useState('');
  const [commentBy, setCommentBy] = useState(agents[0]?.id?.toString() || '');
  const [editingTime, setEditingTime] = useState(false);
  const [editingTokens, setEditingTokens] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const handleStatusChange = async (status) => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onRefresh?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleArchive = async () => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}/archive`, { method: 'POST' });
      onRefresh?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleAddTime = async () => {
    const mins = parseInt(timeInput, 10);
    if (mins > 0) {
      await addTime(mins);
      setTimeInput('');
      setEditingTime(false);
      onRefresh?.();
    }
  };

  const handleAddTokens = async () => {
    const tokens = parseInt(tokenInput, 10);
    if (tokens > 0) {
      await addTokens(tokens);
      setTokenInput('');
      setEditingTokens(false);
      onRefresh?.();
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    await addComment(parseInt(commentBy, 10), comment);
    setComment('');
    onRefresh?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 bg-background border-border">
        {loading || !task ? (
          <div className="p-6">
            <LoadingState type="activity" count={5} />
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Task #{task.id}</div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {task.title}
                  </DialogTitle>
                  {task.project && (
                    <div className="flex items-center gap-1.5 text-sm text-purple-400 mt-1.5">
                      <FolderOpen className="w-4 h-4" />
                      {task.project}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleArchive}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Archive className="w-4 h-4" />
                </Button>
              </div>

              {/* Tags */}
              {task.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {task.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="bg-primary/20 text-primary border-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Status buttons */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STATUS_COLS.map((s) => {
                  const config = STATUS_CONFIG[s];
                  const Icon = config?.icon;
                  return (
                    <Button
                      key={s}
                      variant={task.status === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        'gap-1.5',
                        task.status === s && 'bg-primary text-primary-foreground'
                      )}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {config?.label}
                    </Button>
                  );
                })}
              </div>
            </DialogHeader>

            <Separator />

            <div className="p-6 pt-4 space-y-4">
              {/* Description */}
              {task.description && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {task.description}
                </div>
              )}

              {/* Time & Tokens tracking */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Time:</span>
                  <span className="text-sm text-blue-400 font-medium">
                    {formatTime(task.time_spent_minutes)}
                  </span>
                  {editingTime ? (
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="mins"
                        className="w-16 h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTime()}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddTime}>
                        <Check className="w-3 h-3 text-green-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingTime(false)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setEditingTime(true)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Tokens:</span>
                  <span className="text-sm text-green-400 font-medium">
                    {formatTokens(task.token_spend)}
                  </span>
                  {editingTokens ? (
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="tokens"
                        className="w-20 h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTokens()}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddTokens}>
                        <Check className="w-3 h-3 text-green-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingTokens(false)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setEditingTokens(true)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Assignees */}
              {task.assignees?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Assigned:</span>
                  {task.assignees.map((a) => (
                    <Badge key={a.id} variant="secondary" className="gap-1">
                      {a.emoji} {a.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Comments */}
            <div className="p-6 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
                <MessageSquare className="w-4 h-4" />
                Comments ({task.comments?.length || 0})
              </h3>

              <ScrollArea className="h-[150px] mb-4">
                <div className="space-y-3 pr-4">
                  {task.comments?.map((c) => (
                    <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{c.emoji}</span>
                        <span className="text-xs font-medium text-foreground">{c.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">{c.content}</div>
                    </div>
                  ))}
                  {(!task.comments || task.comments.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No comments yet
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Select value={commentBy} onValueChange={setCommentBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.emoji} {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  placeholder="Add a comment..."
                  className="flex-1"
                />
                <Button onClick={handleComment} className="shrink-0">
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
