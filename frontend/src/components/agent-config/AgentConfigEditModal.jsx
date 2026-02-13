import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const TYPE_COLORS = {
  rule: 'bg-blue-500/20 text-blue-400',
  reference: 'bg-purple-500/20 text-purple-400',
  tool: 'bg-green-500/20 text-green-400',
  persona: 'bg-orange-500/20 text-orange-400',
  constraint: 'bg-red-500/20 text-red-400',
};

export function AgentConfigEditModal({ card, open, onOpenChange, onSave, mdFiles, isNew }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState('');

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setContent(card.content || '');
      setFile(card.file || (mdFiles?.[0] || ''));
    } else if (isNew) {
      setTitle('');
      setContent('');
      setFile(mdFiles?.[0] || 'AGENTS.md');
    }
  }, [card, isNew, mdFiles]);

  const detectedType = (() => {
    const text = (content + ' ' + title).toLowerCase();
    if (/don't|never|avoid|must not/.test(text)) return 'constraint';
    if (/https?:\/\//.test(text)) return 'reference';
    if (/\b(tool|cli|api|command|endpoint)\b/.test(text)) return 'tool';
    if (/\b(identity|personality|tone|voice|persona)\b/.test(text)) return 'persona';
    return 'rule';
  })();

  const handleSave = () => {
    onSave?.({ ...card, title, content, file, type: detectedType });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Card' : 'Edit Card'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Section heading" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Content</label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Card content (markdown)"
              className="font-mono text-sm min-h-[200px]"
            />
          </div>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">File</label>
              <select
                value={file}
                onChange={e => setFile(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {mdFiles?.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <Badge className={TYPE_COLORS[detectedType]}>{detectedType}</Badge>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
