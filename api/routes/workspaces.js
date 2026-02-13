import { Router } from 'express';
import { resolve, join, basename } from 'path';
import { readdir, stat, readFile, writeFile, copyFile, mkdir, rename, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { homedir } from 'os';
import multer from 'multer';
import archiver from 'archiver';
import { asyncHandler } from '../middleware/errorHandler.js';

const WORKSPACES = {
  'openclaw-root': { name: 'OpenClaw Root', emoji: '⚙️', path: join(homedir(), '.openclaw') },
  baski:    { name: 'Baski (Main)', emoji: '🧠', path: join(homedir(), '.openclaw/workspace') },
  mura:     { name: 'Mura', emoji: '🔨', path: join(homedir(), '.openclaw/workspace-mura') },
  jiji:     { name: 'Jiji', emoji: '🐱', path: join(homedir(), '.openclaw/workspace-jiji') },
  doctor:   { name: 'Doctor', emoji: '🩺', path: join(homedir(), '.openclaw/workspace-doctor') },
  mentor:   { name: 'Mentor', emoji: '🎓', path: join(homedir(), '.openclaw/workspace-mentor') },
  writer:   { name: 'Writer', emoji: '✍️', path: join(homedir(), '.openclaw/workspace-writer') },
  'mypen-support': { name: 'MyPen Support', emoji: '🖊️', path: join(homedir(), '.openclaw/workspace-mypen-support') },
};

function safePath(workspaceRoot, relPath) {
  const resolved = resolve(workspaceRoot, relPath || '');
  if (!resolved.startsWith(workspaceRoot)) return null;
  return resolved;
}

const TEXT_EXTS = ['.md','.txt','.js','.jsx','.ts','.tsx','.py','.json','.sh','.yaml','.yml','.toml','.cfg','.ini','.env','.css','.html','.svg','.xml','.csv','.log'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv']);

async function getFolderStats(dirPath, maxDepth = 2) {
  let totalSize = 0;
  let latestModified = new Date(0);
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      try {
        const fullPath = join(dirPath, e.name);
        const s = await stat(fullPath);
        if (e.isDirectory() && maxDepth > 0) {
          const sub = await getFolderStats(fullPath, maxDepth - 1);
          totalSize += sub.size;
          if (sub.modified > latestModified) latestModified = sub.modified;
        } else if (e.isFile()) {
          totalSize += s.size;
          if (s.mtime > latestModified) latestModified = s.mtime;
        }
      } catch {}
    }
  } catch {}
  return { size: totalSize, modified: latestModified };
}

export default function workspaceRoutes() {
  const router = Router();

  router.get('/workspaces', (req, res) => {
    const list = Object.entries(WORKSPACES).map(([id, w]) => ({ id, name: w.name, emoji: w.emoji }));
    res.json(list);
  });

  router.get('/workspaces/:agent/files', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const dirPath = safePath(ws.path, req.query.path);
    if (!dirPath) return res.status(403).json({ error: 'Forbidden' });

    const entries = await readdir(dirPath, { withFileTypes: true });
    const items = await Promise.all(entries
      .filter(e => !e.name.startsWith('.'))
      .map(async (e) => {
        try {
          const fullPath = join(dirPath, e.name);
          const s = await stat(fullPath);
          if (e.isDirectory()) {
            // Get folder size and latest modified date recursively (shallow — max 2 levels for speed)
            const { size, modified } = await getFolderStats(fullPath, 2);
            return { name: e.name, type: 'directory', size, modified };
          }
          return { name: e.name, type: 'file', size: s.size, modified: s.mtime };
        } catch { return null; }
      }));
    const sorted = items.filter(Boolean).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json(sorted);
  }));

  router.get('/workspaces/:agent/file', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const filePath = safePath(ws.path, req.query.path);
    if (!filePath) return res.status(403).json({ error: 'Forbidden' });

    const s = await stat(filePath);
    if (s.size > 1024 * 1024) return res.status(413).json({ error: 'File too large' });
    const content = await readFile(filePath, 'utf-8');
    res.type('text/plain').send(content);
  }));

  router.put('/workspaces/:agent/file', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const { path: relPath, content } = req.body || {};
    if (typeof relPath !== 'string' || typeof content !== 'string') return res.status(400).json({ error: 'path and content required' });
    
    // Validate path doesn't contain dangerous patterns
    if (relPath.includes('..') || relPath.startsWith('/')) return res.status(400).json({ error: 'Invalid path' });
    
    const filePath = safePath(ws.path, relPath);
    if (!filePath) return res.status(403).json({ error: 'Forbidden' });
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (!TEXT_EXTS.includes(ext)) return res.status(400).json({ error: 'Only text files can be edited' });

    try { await copyFile(filePath, filePath + '.bak'); } catch {}
    await writeFile(filePath, content, 'utf-8');
    res.json({ ok: true });
  }));

  router.post('/workspaces/:agent/upload', upload.array('files', 20), asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const dirPath = safePath(ws.path, req.body.path || '');
    if (!dirPath) return res.status(403).json({ error: 'Forbidden' });

    await mkdir(dirPath, { recursive: true });
    const results = [];
    for (const file of (req.files || [])) {
      const dest = safePath(ws.path, join(req.body.path || '', file.originalname));
      if (!dest) { results.push({ name: file.originalname, error: 'Forbidden path' }); continue; }
      await writeFile(dest, file.buffer);
      results.push({ name: file.originalname, size: file.size, ok: true });
    }
    res.json({ uploaded: results });
  }));

  router.post('/workspaces/:agent/move', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const { from, to } = req.body || {};
    if (typeof from !== 'string' || typeof to !== 'string') return res.status(400).json({ error: 'from and to required' });
    
    // Validate paths
    if (from.includes('..') || to.includes('..')) return res.status(400).json({ error: 'Invalid path' });
    
    const fromPath = safePath(ws.path, from);
    let toPath = safePath(ws.path, to);
    if (!fromPath || !toPath) return res.status(403).json({ error: 'Forbidden' });

    try {
      const s = await stat(toPath);
      if (s.isDirectory()) {
        const basename = fromPath.substring(fromPath.lastIndexOf('/') + 1);
        toPath = join(toPath, basename);
      }
    } catch {}
    if (fromPath === toPath) return res.status(400).json({ error: 'Source and destination are the same' });
    if (toPath.startsWith(fromPath + '/')) return res.status(400).json({ error: 'Cannot move folder into itself' });
    await rename(fromPath, toPath);
    res.json({ ok: true });
  }));

  // Download a single file
  router.get('/workspaces/:agent/download', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const relPath = req.query.path || '';
    const filePath = safePath(ws.path, relPath);
    if (!filePath) return res.status(403).json({ error: 'Forbidden' });
    if (relPath.includes('..')) return res.status(400).json({ error: 'Invalid path' });

    const s = await stat(filePath);
    const selectedItems = req.query.items ? req.query.items.split(',').filter(Boolean) : null;

    if (selectedItems && selectedItems.length > 0) {
      // Zip only selected items
      const folderName = basename(filePath) || req.params.agent;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}-selected.zip"`);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err) => { throw err; });
      archive.pipe(res);
      const IGNORE = ['**/node_modules/**', '**/.git/**', '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/*.db', '**/.DS_Store'];
      for (const item of selectedItems) {
        const itemPath = join(filePath, item);
        if (!itemPath.startsWith(ws.path)) continue; // safety
        try {
          const is = await stat(itemPath);
          if (is.isDirectory()) {
            archive.glob('**/*', { cwd: itemPath, dot: false, ignore: IGNORE }, { prefix: item });
          } else {
            archive.file(itemPath, { name: item });
          }
        } catch { /* skip missing */ }
      }
      await archive.finalize();
    } else if (s.isDirectory()) {
      // Zip the folder and stream it (exclude heavy dirs)
      const folderName = basename(filePath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err) => { throw err; });
      archive.pipe(res);
      archive.glob('**/*', {
        cwd: filePath,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**', '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/*.db', '**/.DS_Store'],
      }, { prefix: folderName });
      await archive.finalize();
    } else {
      // Single file download
      const fileName = basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', s.size);
      createReadStream(filePath).pipe(res);
    }
  }));

  // Delete files/folders
  router.delete('/workspaces/:agent/files', asyncHandler(async (req, res) => {
    const ws = WORKSPACES[req.params.agent];
    if (!ws) return res.status(404).json({ error: 'Unknown agent' });
    const { items } = req.body; // array of relative paths
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items specified' });
    }
    const results = [];
    for (const relPath of items) {
      if (relPath.includes('..')) { results.push({ path: relPath, error: 'Invalid path' }); continue; }
      const filePath = safePath(ws.path, relPath);
      if (!filePath) { results.push({ path: relPath, error: 'Forbidden' }); continue; }
      try {
        const s = await stat(filePath);
        await rm(filePath, { recursive: s.isDirectory(), force: true });
        results.push({ path: relPath, deleted: true });
      } catch (err) {
        results.push({ path: relPath, error: err.message });
      }
    }
    res.json({ results, deleted: results.filter(r => r.deleted).length });
  }));

  return router;
}
