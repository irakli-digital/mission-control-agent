import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import ReactMarkdown from 'react-markdown';
import { FolderOpen, File, ChevronRight, ArrowLeft, X, FileText, FileCode, Pencil, Save, RotateCcw, Eye, Code, Upload, Loader2, Download, ToggleLeft, ToggleRight, CheckSquare, Square, Trash2 } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';

import { apiFetch } from '@/lib/fetch';

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const TEXT_EXTS = ['.md','.txt','.js','.jsx','.ts','.tsx','.py','.json','.sh','.yaml','.yml','.toml','.cfg','.ini','.env','.css','.html','.svg','.xml','.csv','.log'];

function isEditable(name) {
  if (!name) return false;
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return TEXT_EXTS.includes(ext);
}

export function WorkspaceBrowser() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [mdPreview, setMdPreview] = useState(false);
  const textareaRef = useRef(null);

  // Markdown view mode: 'rendered' (new rich editor) or 'raw' (textarea)
  const [mdViewMode, setMdViewMode] = useState('rendered');
  // Rich editor content tracking
  const richContentRef = useRef(null);

  // Download state
  const [downloading, setDownloading] = useState(null); // null or item name or '__folder__'

  // Selection state
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Internal drag-move state
  const [dragOverTarget, setDragOverTarget] = useState(null); // folder name or breadcrumb path being hovered

  const originalContent = useRef(null);
  const hasChanges = editing && editContent !== originalContent.current;

  const uploadFiles = useCallback(async (fileList) => {
    if (!activeAgent || !fileList.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('path', currentPath);
      for (const f of fileList) formData.append('files', f);
      await apiFetch(`/api/workspaces/${activeAgent}/upload`, { method: 'POST', body: formData });
      // Refresh file list
      const r = await apiFetch(`/api/workspaces/${activeAgent}/files?path=${encodeURIComponent(currentPath)}`);
      setFiles(await r.json());
    } catch (e) { console.error('Upload failed', e); }
    setUploading(false);
  }, [activeAgent, currentPath]);

  const moveFile = useCallback(async (fromRel, toRel) => {
    if (!activeAgent) return;
    try {
      const r = await apiFetch(`/api/workspaces/${activeAgent}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromRel, to: toRel }),
      });
      if (r.ok) {
        const res = await apiFetch(`/api/workspaces/${activeAgent}/files?path=${encodeURIComponent(currentPath)}`);
        setFiles(await res.json());
      }
    } catch (e) { console.error('Move failed', e); }
  }, [activeAgent, currentPath]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    // Internal move drops are handled per-item; this is only for external file uploads
    const internalPath = e.dataTransfer.getData('text/x-mc-filepath');
    if (!internalPath && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = (e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); } };

  useEffect(() => {
    apiFetch(`/api/workspaces`).then(r => r.json()).then(setWorkspaces);
  }, []);

  const browse = useCallback(async (agent, path = '') => {
    setActiveAgent(agent);
    setCurrentPath(path);
    setFileContent(null);
    setViewingFile(null);
    setEditing(false);
    setSelected(new Set());
    setLoading(true);
    try {
      const r = await apiFetch(`/api/workspaces/${agent}/files?path=${encodeURIComponent(path)}`);
      setFiles(await r.json());
    } catch { setFiles([]); }
    setLoading(false);
  }, []);

  const openFile = useCallback(async (name) => {
    const path = currentPath ? `${currentPath}/${name}` : name;
    setViewingFile(name);
    setEditing(false);
    try {
      const r = await apiFetch(`/api/workspaces/${activeAgent}/file?path=${encodeURIComponent(path)}`);
      const text = await r.text();
      setFileContent(text);
    } catch { setFileContent('Error loading file'); }
  }, [activeAgent, currentPath]);

  const startEdit = () => {
    setEditContent(fileContent);
    originalContent.current = fileContent;
    setEditing(true);
    setMdPreview(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditContent('');
    setMdPreview(false);
  };

  const saveFile = async () => {
    const path = currentPath ? `${currentPath}/${viewingFile}` : viewingFile;
    setSaving(true);
    try {
      const r = await apiFetch(`/api/workspaces/${activeAgent}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: editContent }),
      });
      if (r.ok) {
        setFileContent(editContent);
        originalContent.current = editContent;
        setEditing(false);
        setMdPreview(false);
      }
    } catch {}
    setSaving(false);
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e) => {
      if (editing && (e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, editContent, viewingFile, activeAgent, currentPath]);

  const downloadItem = useCallback((e, item) => {
    e.stopPropagation();
    const path = currentPath ? `${currentPath}/${item.name}` : item.name;
    const url = `/api/workspaces/${activeAgent}/download?path=${encodeURIComponent(path)}`;
    setDownloading(item.name);
    apiFetch(url).then(r => {
      if (!r.ok) throw new Error('Download failed');
      const disposition = r.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : item.name + (item.type === 'directory' ? '.zip' : '');
      return r.blob().then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
      });
    }).catch(err => console.error('Download failed:', err))
      .finally(() => setDownloading(null));
  }, [activeAgent, currentPath]);

  const handleItemClick = (item) => {
    if (item.type === 'directory') {
      browse(activeAgent, currentPath ? `${currentPath}/${item.name}` : item.name);
    } else {
      openFile(item.name);
    }
  };

  const breadcrumbs = currentPath ? currentPath.split('/') : [];
  const isMarkdown = viewingFile?.endsWith('.md');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {workspaces.map(ws => (
          <Button
            key={ws.id}
            variant={activeAgent === ws.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => browse(ws.id)}
            className="gap-1.5"
          >
            <span>{ws.emoji}</span>
            {ws.name}
          </Button>
        ))}
      </div>

      {activeAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* File list */}
          <Card
            className={`p-4 relative transition-colors ${dragOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            {dragOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary pointer-events-none">
                <div className="text-primary font-medium flex items-center gap-2">
                  <Upload className="w-5 h-5" /> Drop files to upload
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </div>
              </div>
            )}
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} />
            <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground flex-wrap">
              <button
                onClick={() => browse(activeAgent)}
                className={`hover:text-foreground font-medium px-1 rounded ${dragOverTarget === '__root__' ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-mc-filepath')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTarget('__root__'); }}}
                onDragLeave={() => { if (dragOverTarget === '__root__') setDragOverTarget(null); }}
                onDrop={(e) => { const from = e.dataTransfer.getData('text/x-mc-filepath'); if (!from) return; e.preventDefault(); e.stopPropagation(); setDragOverTarget(null); moveFile(from, ''); }}
              >~</button>
              {breadcrumbs.map((part, i) => {
                const bcPath = breadcrumbs.slice(0, i + 1).join('/');
                const bcKey = `__bc__${bcPath}`;
                return (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  <button
                    onClick={() => browse(activeAgent, bcPath)}
                    className={`hover:text-foreground px-1 rounded ${dragOverTarget === bcKey ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-mc-filepath')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTarget(bcKey); }}}
                    onDragLeave={() => { if (dragOverTarget === bcKey) setDragOverTarget(null); }}
                    onDrop={(e) => { const from = e.dataTransfer.getData('text/x-mc-filepath'); if (!from) return; e.preventDefault(); e.stopPropagation(); setDragOverTarget(null); moveFile(from, bcPath); }}
                  >{part}</button>
                </span>
                );
              })}
              <div className="ml-auto flex items-center gap-0.5">
                {selected.size > 0 && <span className="text-[11px] text-muted-foreground mr-1">{selected.size} selected</span>}
                <Button variant="ghost" size="sm" disabled={downloading === '__folder__'} onClick={() => {
                  const path = currentPath || '';
                  setDownloading('__folder__');
                  const query = selected.size > 0
                    ? `/api/workspaces/${activeAgent}/download?path=${encodeURIComponent(path)}&items=${encodeURIComponent([...selected].join(','))}`
                    : `/api/workspaces/${activeAgent}/download?path=${encodeURIComponent(path)}`;
                  apiFetch(query).then(r => {
                    if (!r.ok) throw new Error('Download failed');
                    const disposition = r.headers.get('Content-Disposition') || '';
                    const match = disposition.match(/filename="?([^"]+)"?/);
                    const folderName = currentPath ? currentPath.split('/').pop() : activeAgent;
                    const filename = match ? match[1] : `${folderName}.zip`;
                    return r.blob().then(blob => {
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
                    });
                  }).catch(err => console.error('Download failed:', err))
                    .finally(() => setDownloading(null));
                }} title="Download current folder as ZIP">
                  {downloading === '__folder__' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </Button>
                {selected.size > 0 && (
                  <Button variant="ghost" size="sm" disabled={deleting} onClick={async () => {
                    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
                    setDeleting(true);
                    try {
                      const items = [...selected].map(name => currentPath ? `${currentPath}/${name}` : name);
                      const r = await apiFetch(`/api/workspaces/${activeAgent}/files`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items }),
                      });
                      const data = await r.json();
                      if (data.deleted > 0) {
                        setSelected(new Set());
                        browse(activeAgent, currentPath);
                      }
                    } catch (err) { console.error('Delete failed:', err); }
                    finally { setDeleting(false); }
                  }} title={`Delete ${selected.size} selected item(s)`} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload files">
                  <Upload className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {currentPath && (
              <button
                onClick={() => browse(activeAgent, breadcrumbs.slice(0, -1).join('/'))}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 w-full"
              >
                <ArrowLeft className="w-3.5 h-3.5" />..
              </button>
            )}
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="space-y-0.5">
                  {files.length > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground border-b border-border/30 mb-1">
                      <span
                        role="button"
                        className="shrink-0 cursor-pointer hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selected.size === files.length) setSelected(new Set());
                          else setSelected(new Set(files.map(f => f.name)));
                        }}
                      >
                        {selected.size === files.length && files.length > 0
                          ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                          : <Square className="w-3.5 h-3.5" />}
                      </span>
                      <span className="flex-1">{selected.size === files.length && files.length > 0 ? 'Deselect all' : 'Select all'}</span>
                    </div>
                  )}
                  {files.map(item => {
                    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                    return (
                    <button
                      key={item.name}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/x-mc-filepath', itemPath);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        if (item.type !== 'directory') return;
                        if (e.dataTransfer.types.includes('text/x-mc-filepath')) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverTarget(item.name);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (dragOverTarget === item.name) setDragOverTarget(null);
                      }}
                      onDrop={(e) => {
                        if (item.type !== 'directory') return;
                        const from = e.dataTransfer.getData('text/x-mc-filepath');
                        if (!from) return; // external file, let parent handle
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverTarget(null);
                        const toDir = currentPath ? `${currentPath}/${item.name}` : item.name;
                        if (from !== toDir && !from.startsWith(toDir + '/')) moveFile(from, toDir);
                      }}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors ${viewingFile === item.name ? 'bg-muted' : ''} ${dragOverTarget === item.name ? 'ring-2 ring-primary bg-primary/10' : ''}`}
                    >
                      <span
                        role="button"
                        className="shrink-0 cursor-pointer hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(item.name)) next.delete(item.name); else next.add(item.name);
                            return next;
                          });
                        }}
                      >
                        {selected.has(item.name)
                          ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                          : <Square className="w-3.5 h-3.5 text-muted-foreground/50" />}
                      </span>
                      {item.type === 'directory' ? (
                        <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                      ) : item.name.endsWith('.md') ? (
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline" title={item.modified ? new Date(item.modified).toLocaleString() : ''}>{formatDate(item.modified)}</span>
                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{formatSize(item.size)}</span>
                      <span
                        role="button"
                        title={item.type === 'directory' ? 'Download as ZIP' : 'Download'}
                        onClick={(e) => { if (downloading !== item.name) downloadItem(e, item); else e.stopPropagation(); }}
                        className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {downloading === item.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                    );
                  })}
                  {!loading && files.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Empty directory</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* File preview / editor */}
          <Card className="p-4">
            {viewingFile ? (
              <>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium truncate">{viewingFile}</h3>
                    {editing && hasChanges && (
                      <span className="shrink-0 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">unsaved</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Markdown view mode toggle */}
                    {isMarkdown && !editing && (
                      <div className="flex items-center gap-1 mr-1">
                        <button
                          onClick={() => setMdViewMode('rendered')}
                          className={`text-xs px-2 py-1 rounded-l border border-border transition-colors ${mdViewMode === 'rendered' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                        >
                          Rendered
                        </button>
                        <button
                          onClick={() => setMdViewMode('raw')}
                          className={`text-xs px-2 py-1 rounded-r border border-l-0 border-border transition-colors ${mdViewMode === 'raw' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:text-foreground'}`}
                        >
                          Raw
                        </button>
                      </div>
                    )}
                    {editing ? (
                      <>
                        {isMarkdown && (
                          <Button variant="ghost" size="sm" onClick={() => setMdPreview(!mdPreview)} title={mdPreview ? 'Edit' : 'Preview'}>
                            {mdPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={saveFile} disabled={saving || !hasChanges} title="Save (Ctrl+S)">
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit} title="Cancel">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {isEditable(viewingFile) && (
                          <Button variant="ghost" size="sm" onClick={startEdit} title="Edit raw">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { setViewingFile(null); setFileContent(null); setEditing(false); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editing ? (
                  isMarkdown && mdPreview ? (
                    <ScrollArea className="h-[470px]">
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{editContent}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  ) : (
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-[470px] bg-muted/30 text-sm font-mono text-foreground rounded p-3 resize-none border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                      spellCheck={false}
                    />
                  )
                ) : (
                  fileContent === null ? (
                    <Skeleton className="h-40 w-full" />
                  ) : isMarkdown && mdViewMode === 'rendered' ? (
                    <MarkdownEditor
                      content={fileContent}
                      onContentChange={(md) => { richContentRef.current = md; }}
                      onSave={async () => {
                        const path = currentPath ? `${currentPath}/${viewingFile}` : viewingFile;
                        const content = richContentRef.current || fileContent;
                        setSaving(true);
                        try {
                          const r = await apiFetch(`/api/workspaces/${activeAgent}/file`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path, content }),
                          });
                          if (r.ok) setFileContent(content);
                        } catch {}
                        setSaving(false);
                      }}
                      saving={saving}
                    />
                  ) : isMarkdown ? (
                    <ScrollArea className="h-[470px]">
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{fileContent}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  ) : (
                    <ScrollArea className="h-[470px]">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground bg-muted/30 rounded p-3 overflow-x-auto">
                        {fileContent}
                      </pre>
                    </ScrollArea>
                  )
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
                Select a file to preview
              </div>
            )}
          </Card>
        </div>
      )}

      {!activeAgent && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
            <FolderOpen className="w-12 h-12 opacity-50" />
            <p>Select an agent workspace to browse</p>
          </div>
        </Card>
      )}
    </div>
  );
}
