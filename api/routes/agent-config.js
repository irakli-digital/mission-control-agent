import { Router } from 'express';
import { join, basename } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { asyncHandler } from '../middleware/errorHandler.js';

const AGENTS = {
  main:           { name: 'Main (Baski)', emoji: '🧠', path: join(homedir(), '.openclaw/workspace') },
  mura:           { name: 'Mura',         emoji: '🔨', path: join(homedir(), '.openclaw/workspace-mura') },
  jiji:           { name: 'Jiji',         emoji: '🐱', path: join(homedir(), '.openclaw/workspace-jiji') },
  doctor:         { name: 'Doctor',       emoji: '🩺', path: join(homedir(), '.openclaw/workspace-doctor') },
  mentor:         { name: 'Mentor',       emoji: '🎓', path: join(homedir(), '.openclaw/workspace-mentor') },
  writer:         { name: 'Writer',       emoji: '✍️', path: join(homedir(), '.openclaw/workspace-writer') },
  'mypen-support':{ name: 'MyPen Support',emoji: '🖊️', path: join(homedir(), '.openclaw/workspace-mypen-support') },
};

function detectType(content, title) {
  const text = (content + ' ' + title).toLowerCase();
  if (/don't|never|avoid|must not|do not|禁止/.test(text)) return 'constraint';
  if (/https?:\/\//.test(text)) return 'reference';
  if (/\b(tool|cli|api|command|endpoint|script|bash|curl)\b/.test(text)) return 'tool';
  if (/\b(identity|personality|tone|voice|persona|who you are|character)\b/.test(text)) return 'persona';
  return 'rule';
}

function extractCustomType(body) {
  const match = body.match(/<!-- type: (\w+) -->$/m);
  return match ? match[1] : null;
}

function stripCustomTypeComment(body) {
  return body.replace(/\n?<!-- type: \w+ -->$/m, '').trim();
}

function parseFileIntoCards(agentId, fileName, content) {
  const cards = [];
  const lines = content.split('\n');
  let currentTitle = null;
  let currentLines = [];
  let index = 0;

  function makeCard(title, bodyLines, idx, isPreamble) {
    const rawBody = bodyLines.join('\n').trim();
    const customType = extractCustomType(rawBody);
    const cleanBody = stripCustomTypeComment(rawBody);
    const type = customType || detectType(cleanBody, title);
    return {
      id: isPreamble ? `${agentId}--${fileName}--preamble` : `${agentId}--${fileName}--${idx}`,
      title: isPreamble ? `📄 ${fileName} (header)` : title,
      content: cleanBody,
      file: fileName,
      type,
      customType: customType || undefined,
      agentId,
      index: isPreamble ? -1 : idx,
    };
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## /)) {
      if (currentLines.length > 0) {
        const body = currentLines.join('\n').trim();
        if (body && body !== `# ${fileName.replace('.md', '')}`) {
          cards.push(makeCard(null, currentLines, -1, true));
        }
      }
      currentTitle = lines[i].replace(/^## /, '').trim();
      currentLines = [];
      index++;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^## /)) {
          cards.push(makeCard(currentTitle, currentLines, index, false));
          currentTitle = lines[j].replace(/^## /, '').trim();
          currentLines = [];
          index++;
          i = j - 1;
          break;
        }
        currentLines.push(lines[j]);
        if (j === lines.length - 1) {
          cards.push(makeCard(currentTitle, currentLines, index, false));
          i = j;
        }
      }
      currentTitle = null;
      currentLines = [];
      continue;
    }
    if (currentTitle === null) {
      currentLines.push(lines[i]);
    }
  }

  return cards;
}

function cardsToFiles(cards) {
  const fileMap = {};
  for (const card of cards) {
    if (!fileMap[card.file]) fileMap[card.file] = [];
    fileMap[card.file].push(card);
  }

  const result = {};
  for (const [file, fileCards] of Object.entries(fileMap)) {
    fileCards.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const parts = [];
    for (const card of fileCards) {
      const typeComment = card.customType ? `\n<!-- type: ${card.customType} -->` : '';
      if (card.id.endsWith('--preamble')) {
        parts.unshift(card.content + typeComment);
      } else {
        parts.push(`## ${card.title}\n\n${card.content}${typeComment}`);
      }
    }
    result[file] = parts.join('\n\n') + '\n';
  }
  return result;
}

async function getMdFiles(workspacePath) {
  try {
    const entries = await readdir(workspacePath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name);
  } catch {
    return [];
  }
}

async function getAgentCards(agentId) {
  const agent = AGENTS[agentId];
  if (!agent) return [];

  const mdFiles = await getMdFiles(agent.path);
  const allCards = [];

  for (const file of mdFiles) {
    try {
      const content = await readFile(join(agent.path, file), 'utf-8');
      const cards = parseFileIntoCards(agentId, file, content);
      allCards.push(...cards);
    } catch (err) {
      console.error(`[agent-config] Error reading ${file} for ${agentId}:`, err.message);
    }
  }

  return allCards;
}

export default function agentConfigRoutes(pool) {
  const router = Router();

  // Init history table
  if (pool) {
    pool.query(`
      CREATE TABLE IF NOT EXISTS agent_config_history (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        card_title TEXT,
        action TEXT NOT NULL,
        old_content TEXT,
        new_content TEXT,
        moved_from_agent TEXT,
        moved_to_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).then(() => console.log('[agent-config] History table ready'))
      .catch(err => console.error('[agent-config] Failed to create history table:', err.message));
  }

  // List agents with their .md files
  router.get('/agent-config/agents', asyncHandler(async (req, res) => {
    const result = [];
    for (const [id, agent] of Object.entries(AGENTS)) {
      const mdFiles = await getMdFiles(agent.path);
      result.push({ id, name: agent.name, emoji: agent.emoji, path: agent.path, mdFiles });
    }
    console.log(`[agent-config] Listed ${result.length} agents`);
    res.json(result);
  }));

  // Get cards for an agent
  router.get('/agent-config/agents/:id/cards', asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!AGENTS[id]) return res.status(404).json({ error: 'Agent not found' });
    const cards = await getAgentCards(id);
    console.log(`[agent-config] ${id}: ${cards.length} cards`);
    res.json(cards);
  }));

  // Save cards for an agent
  router.put('/agent-config/agents/:id/cards', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const agent = AGENTS[id];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { cards } = req.body;
    if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be an array' });

    const files = cardsToFiles(cards);
    for (const [file, content] of Object.entries(files)) {
      const filePath = join(agent.path, file);
      await writeFile(filePath, content, 'utf-8');
      console.log(`[agent-config] Wrote ${filePath}`);
    }

    res.json({ ok: true, filesWritten: Object.keys(files) });
  }));

  // Bulk save — save multiple agents at once + log history
  router.post('/agent-config/bulk-save', asyncHandler(async (req, res) => {
    const { changes } = req.body; // { agentId: cards[] }
    const { history } = req.body; // [{ agent_id, file_name, card_title, action, old_content, new_content, moved_from_agent, moved_to_agent }]

    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'changes object required' });
    }

    // Write all files
    for (const [agentId, cards] of Object.entries(changes)) {
      const agent = AGENTS[agentId];
      if (!agent) continue;
      const files = cardsToFiles(cards);
      for (const [file, content] of Object.entries(files)) {
        const filePath = join(agent.path, file);
        await writeFile(filePath, content, 'utf-8');
        console.log(`[agent-config] Wrote ${filePath}`);
      }
    }

    // Log history
    if (pool && Array.isArray(history) && history.length > 0) {
      for (const h of history) {
        try {
          await pool.query(
            `INSERT INTO agent_config_history (agent_id, file_name, card_title, action, old_content, new_content, moved_from_agent, moved_to_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [h.agent_id, h.file_name || '', h.card_title || '', h.action, h.old_content || null, h.new_content || null, h.moved_from_agent || null, h.moved_to_agent || null]
          );
        } catch (err) {
          console.error('[agent-config] Failed to log history:', err.message);
        }
      }
      console.log(`[agent-config] Logged ${history.length} history entries`);
    }

    res.json({ ok: true });
  }));

  // Move card between agents
  router.post('/agent-config/cards/move', asyncHandler(async (req, res) => {
    const { card, fromAgentId, toAgentId } = req.body;
    if (!card || !fromAgentId || !toAgentId) {
      return res.status(400).json({ error: 'card, fromAgentId, toAgentId required' });
    }

    const fromCards = await getAgentCards(fromAgentId);
    const remaining = fromCards.filter(c => c.id !== card.id);
    const fromFiles = cardsToFiles(remaining);
    const fromAgent = AGENTS[fromAgentId];
    for (const [file, content] of Object.entries(fromFiles)) {
      await writeFile(join(fromAgent.path, file), content, 'utf-8');
    }

    const toCards = await getAgentCards(toAgentId);
    const newCard = { ...card, agentId: toAgentId, id: `${toAgentId}--${card.file}--${Date.now()}`, index: toCards.length };
    toCards.push(newCard);
    const toFiles = cardsToFiles(toCards);
    const toAgent = AGENTS[toAgentId];
    for (const [file, content] of Object.entries(toFiles)) {
      await writeFile(join(toAgent.path, file), content, 'utf-8');
    }

    console.log(`[agent-config] Moved card "${card.title}" from ${fromAgentId} to ${toAgentId}`);
    res.json({ ok: true });
  }));

  // Search across all agents
  router.get('/agent-config/search', asyncHandler(async (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    if (!q) return res.json([]);

    const results = [];
    for (const agentId of Object.keys(AGENTS)) {
      const cards = await getAgentCards(agentId);
      for (const card of cards) {
        if (card.title.toLowerCase().includes(q) || card.content.toLowerCase().includes(q)) {
          results.push(card);
        }
      }
    }
    console.log(`[agent-config] Search "${q}": ${results.length} results`);
    res.json(results);
  }));

  // Get change history
  router.get('/agent-config/history', asyncHandler(async (req, res) => {
    if (!pool) return res.json([]);
    const { agent, limit = 50 } = req.query;
    let query = 'SELECT * FROM agent_config_history';
    const params = [];
    if (agent) {
      query += ' WHERE agent_id = $1';
      params.push(agent);
    }
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    const { rows } = await pool.query(query, params);
    res.json(rows);
  }));

  return router;
}
