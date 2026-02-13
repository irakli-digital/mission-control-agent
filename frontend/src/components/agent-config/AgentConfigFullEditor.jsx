import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const TYPE_COLORS = {
  rule: 'bg-blue-500/20 text-blue-400',
  reference: 'bg-purple-500/20 text-purple-400',
  tool: 'bg-green-500/20 text-green-400',
  persona: 'bg-orange-500/20 text-orange-400',
  constraint: 'bg-red-500/20 text-red-400',
};

const TYPE_OPTIONS = ['rule', 'reference', 'tool', 'persona', 'constraint'];

export function AgentConfigFullEditor({ card, onClose, onSave, mdFiles, isNew }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState('');
  const [type, setType] = useState('rule');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setContent(card.content || '');
      setFile(card.file || (mdFiles?.[0] || ''));
      setType(card.type || card.customType || 'rule');
    }
  }, [card, mdFiles]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [title, content, file, type]);

  const handleSave = useCallback(() => {
    onSave?.({ ...card, title, content, file, type });
    onClose();
  }, [card, title, content, file, type, onSave, onClose]);

  // Line numbers
  const lineCount = content.split('\n').length;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Card title"
          className="max-w-md font-semibold"
        />
        <Badge variant="outline" className="shrink-0 text-xs">{file}</Badge>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={file}
          onChange={e => setFile(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {mdFiles?.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="w-4 h-4" /> Save
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor */}
        <div className="w-1/2 border-r border-border flex min-h-0">
          <div className="w-10 shrink-0 bg-muted/30 text-right pr-2 pt-3 select-none overflow-hidden">
            {Array.from({ length: Math.max(lineCount, 30) }, (_, i) => (
              <div key={i} className="text-xs text-muted-foreground/50 leading-[1.625rem] font-mono">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 bg-background text-foreground font-mono text-sm p-3 resize-none outline-none leading-[1.625rem] overflow-auto"
            placeholder="Write markdown here..."
            spellCheck={false}
          />
        </div>

        {/* Right: Preview */}
        <div className="w-1/2 overflow-auto p-6">
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
