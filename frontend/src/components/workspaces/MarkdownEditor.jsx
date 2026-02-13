import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { GripVertical, Save, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Parse markdown into sections by top-level headings (# and ##)
function parseSections(markdown) {
  if (!markdown) return [{ id: 'section-0', heading: '', body: '', raw: markdown || '' }];
  
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,2})\s+(.+)/);
    
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        id: `section-${sections.length}`,
        headingLevel: headingMatch[1].length,
        heading: headingMatch[2],
        headingRaw: line,
        bodyLines: [],
      };
    } else {
      if (!current) {
        current = {
          id: `section-${sections.length}`,
          headingLevel: 0,
          heading: '',
          headingRaw: '',
          bodyLines: [],
        };
      }
      current.bodyLines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections.map((s, i) => ({
    ...s,
    id: `section-${i}`,
    body: s.bodyLines.join('\n'),
    raw: s.headingRaw ? s.headingRaw + '\n' + s.bodyLines.join('\n') : s.bodyLines.join('\n'),
  }));
}

// Reconstruct markdown from sections
function sectionsToMarkdown(sections) {
  return sections.map(s => {
    if (s.headingRaw || s.heading) {
      const prefix = '#'.repeat(s.headingLevel || 1);
      const heading = `${prefix} ${s.heading}`;
      return heading + '\n' + s.body;
    }
    return s.body;
  }).join('\n');
}

function SortableCard({ section, onUpdate, id }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleHeadingBlur = useCallback((e) => {
    const newHeading = e.target.textContent.trim();
    if (newHeading !== section.heading) {
      onUpdate(section.id, { heading: newHeading });
    }
  }, [section.id, section.heading, onUpdate]);

  const handleBodyBlur = useCallback((e) => {
    // Get the text from contentEditable, preserving line breaks
    const newBody = e.target.innerText;
    if (newBody !== section.body) {
      onUpdate(section.id, { body: newBody });
    }
  }, [section.id, section.body, onUpdate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.dataset.role === 'heading') {
      e.preventDefault();
      e.target.blur();
    }
  }, []);

  const hasHeading = section.heading && section.headingLevel > 0;
  const bodyTrimmed = section.body.trim();

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className={`rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors ${isDragging ? 'ring-2 ring-primary shadow-lg' : ''}`}>
        <div className="flex items-start gap-1">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="pt-3 pl-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0 p-3 pl-1">
            {hasHeading && (
              <div
                contentEditable
                suppressContentEditableWarning
                data-role="heading"
                onBlur={handleHeadingBlur}
                onKeyDown={handleKeyDown}
                className={`font-semibold outline-none rounded px-1 -mx-1 hover:bg-muted/50 focus:bg-muted/50 focus:ring-1 focus:ring-ring cursor-text ${
                  section.headingLevel === 1 ? 'text-lg' : 'text-base'
                }`}
              >
                {section.heading}
              </div>
            )}
            {bodyTrimmed && (
              <div className={hasHeading ? 'mt-2' : ''}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <RenderedBody body={bodyTrimmed} sectionId={section.id} onUpdate={onUpdate} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Rendered body with inline editing on click
function RenderedBody({ body, sectionId, onUpdate }) {
  const [editingBody, setEditingBody] = useState(false);
  const textareaRef = useRef(null);
  const [localBody, setLocalBody] = useState(body);

  useEffect(() => { setLocalBody(body); }, [body]);

  const startEdit = useCallback(() => {
    setEditingBody(true);
    setLocalBody(body);
  }, [body]);

  const finishEdit = useCallback(() => {
    setEditingBody(false);
    if (localBody !== body) {
      onUpdate(sectionId, { body: localBody });
    }
  }, [localBody, body, sectionId, onUpdate]);

  useEffect(() => {
    if (editingBody && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [editingBody]);

  if (editingBody) {
    return (
      <textarea
        ref={textareaRef}
        value={localBody}
        onChange={(e) => {
          setLocalBody(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        onBlur={finishEdit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); finishEdit(); }
        }}
        className="w-full bg-muted/30 text-sm font-mono text-foreground rounded p-2 resize-none border border-border focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px]"
        spellCheck={false}
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className="cursor-text rounded px-1 -mx-1 hover:bg-muted/30 transition-colors min-h-[1.5em]"
      title="Click to edit"
    >
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}

export function MarkdownEditor({ content, onContentChange, onSave, saving }) {
  const [sections, setSections] = useState(() => parseSections(content));
  const [dirty, setDirty] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync sections when content prop changes externally
  const contentRef = useRef(content);
  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content;
      setSections(parseSections(content));
      setDirty(false);
    }
  }, [content]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateMarkdown = useCallback((newSections) => {
    const md = sectionsToMarkdown(newSections);
    contentRef.current = md;
    onContentChange(md);
    setDirty(true);
  }, [onContentChange]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      const newSections = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, id: `section-${i}` }));
      updateMarkdown(newSections);
      return newSections;
    });
  }, [updateMarkdown]);

  const handleSectionUpdate = useCallback((sectionId, updates) => {
    setSections(prev => {
      const newSections = prev.map(s => {
        if (s.id !== sectionId) return s;
        const updated = { ...s, ...updates };
        if (updates.heading !== undefined) {
          const prefix = '#'.repeat(updated.headingLevel || 1);
          updated.headingRaw = `${prefix} ${updates.heading}`;
        }
        updated.raw = updated.headingRaw
          ? updated.headingRaw + '\n' + updated.body
          : updated.body;
        return updated;
      });
      updateMarkdown(newSections);
      return newSections;
    });
  }, [updateMarkdown]);

  const handleSave = useCallback(async () => {
    await onSave();
    setDirty(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  }, [onSave]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, handleSave]);

  const sectionIds = useMemo(() => sections.map(s => s.id), [sections]);

  return (
    <div className="relative">
      {/* Save button */}
      {(dirty || savedFeedback) && (
        <div className="sticky top-0 z-10 flex justify-end mb-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || savedFeedback || !dirty}
            className={`gap-1.5 transition-all ${savedFeedback ? 'bg-green-600 hover:bg-green-600' : ''}`}
          >
            {savedFeedback ? (
              <><Check className="w-3.5 h-3.5" /> Saved</>
            ) : saving ? (
              'Saving…'
            ) : (
              <><Save className="w-3.5 h-3.5" /> Save</>
            )}
          </Button>
        </div>
      )}

      <ScrollArea className="h-[450px]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pr-2">
              {sections.map(section => (
                <SortableCard
                  key={section.id}
                  id={section.id}
                  section={section}
                  onUpdate={handleSectionUpdate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>
    </div>
  );
}
