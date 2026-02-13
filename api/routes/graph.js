import { Router } from 'express';
import { join, basename, resolve, relative, dirname } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { homedir } from 'os';
import { asyncHandler } from '../middleware/errorHandler.js';

const AGENTS = {
  mura:      { name: 'Mura',      path: join(homedir(), '.openclaw/workspace-mura') },
  main:      { name: 'Main',      path: join(homedir(), '.openclaw/workspace') },
  workflows: { name: 'Workflows', path: join(homedir(), '.openclaw/workflows') },
  jiji:      { name: 'Jiji',      path: join(homedir(), '.openclaw/workspace-jiji') },
  baski:     { name: 'Baski',     path: join(homedir(), '.openclaw/workspace') },
  doctor:    { name: 'Doctor',    path: join(homedir(), '.openclaw/workspace-doctor') },
  mentor:    { name: 'Mentor',    path: join(homedir(), '.openclaw/workspace-mentor') },
  writer:    { name: 'Writer',    path: join(homedir(), '.openclaw/workspace-writer') },
};

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next']);

async function findMdFiles(dir, agent) {
  const results = [];
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith('.md')) {
        try {
          const s = await stat(full);
          results.push({ id: full, name: e.name, path: full, agent, size: s.size });
        } catch { /* skip */ }
      }
    }
  }
  await walk(dir);
  return results;
}

function extractReferences(content, filePath) {
  const refs = new Set();
  const dir = dirname(filePath);

  // Markdown links: [text](path.md) or [text](path/to/file.md)
  const mdLinkRe = /\[([^\]]*)\]\(([^)]*\.md)\)/gi;
  for (const m of content.matchAll(mdLinkRe)) {
    refs.add(m[2]);
  }

  // Backtick references: `path/to/file.md` or `file.md`
  const backtickRe = /`([^`]*\.md)`/gi;
  for (const m of content.matchAll(backtickRe)) {
    refs.add(m[1]);
  }

  // Direct file path references (not inside [] or ())
  // Patterns like: Read SOUL.md, see memory/lessons.md, check AGENTS.md
  const wordRefRe = /(?:^|[\s,;:])([A-Za-z0-9_./-]+\.md)\b/gm;
  for (const m of content.matchAll(wordRefRe)) {
    refs.add(m[1].trim());
  }

  // Tilde paths: ~/.openclaw/.../*.md
  const tildeRe = /(~\/[^\s,;:)`'"]+\.md)/g;
  for (const m of content.matchAll(tildeRe)) {
    refs.add(m[1]);
  }

  return [...refs];
}

function resolveRef(ref, filePath, nodeIndex) {
  // Expand tilde
  if (ref.startsWith('~/')) {
    const expanded = join(homedir(), ref.slice(2));
    if (nodeIndex.has(expanded)) return expanded;
  }

  // Try as relative to file's directory
  const dir = dirname(filePath);
  const asRelative = resolve(dir, ref);
  if (nodeIndex.has(asRelative)) return asRelative;

  // Try matching just by filename
  const name = basename(ref);
  const refPath = ref.replace(/^\.\//, '');
  
  // Try matching by path suffix
  for (const nodePath of nodeIndex.keys()) {
    if (nodePath.endsWith('/' + refPath)) return nodePath;
  }
  
  // Last resort: match by basename (pick first)
  for (const nodePath of nodeIndex.keys()) {
    if (basename(nodePath) === name) return nodePath;
  }

  return null;
}

export default function graphRoutes() {
  const router = Router();

  router.get('/workspace/graph', asyncHandler(async (req, res) => {
    // Scan all workspaces
    const allNodes = [];
    const scanPromises = Object.entries(AGENTS).map(async ([key, { path: wsPath }]) => {
      try {
        await stat(wsPath);
        return await findMdFiles(wsPath, key);
      } catch {
        return [];
      }
    });

    const results = await Promise.all(scanPromises);
    for (const files of results) allNodes.push(...files);

    // Deduplicate by path
    const nodeIndex = new Map();
    for (const node of allNodes) {
      if (!nodeIndex.has(node.id)) {
        nodeIndex.set(node.id, node);
      }
    }

    const nodes = [...nodeIndex.values()];
    const edges = [];

    // Extract edges
    for (const node of nodes) {
      try {
        const content = await readFile(node.path, 'utf-8');
        const refs = extractReferences(content, node.path);
        for (const ref of refs) {
          const target = resolveRef(ref, node.path, nodeIndex);
          if (target && target !== node.id) {
            edges.push({ source: node.id, target });
          }
        }
      } catch { /* skip unreadable files */ }
    }

    // Deduplicate edges
    const edgeSet = new Set();
    const uniqueEdges = edges.filter(e => {
      const key = `${e.source}|${e.target}`;
      if (edgeSet.has(key)) return false;
      edgeSet.add(key);
      return true;
    });

    res.json({ nodes, edges: uniqueEdges });
  }));

  return router;
}
