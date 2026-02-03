import express from 'express';
import pg from 'pg';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(join(__dirname, '../frontend/dist')));

const pool = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL });

// ─── AGENTS ─────────────────────────────────────────

app.get('/api/agents', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*,
      t.title as current_task_title,
      (SELECT COUNT(*) FROM task_assignees ta JOIN tasks t2 ON t2.id = ta.task_id WHERE ta.agent_id = a.id AND t2.archived = FALSE) as total_tasks,
      (SELECT COUNT(*) FROM notifications n WHERE n.mentioned_agent_id = a.id AND n.delivered = FALSE) as unread,
      (SELECT COUNT(*) FROM task_assignees ta2 JOIN tasks t2 ON t2.id = ta2.task_id WHERE ta2.agent_id = a.id AND t2.status = 'in_progress' AND t2.archived = FALSE) as active_tasks
    FROM agents a
    LEFT JOIN tasks t ON t.id = a.current_task_id
    ORDER BY a.id
  `);
  res.json(rows);
});

// ─── TASKS ──────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
  const { status, agent, project, tags, search, archived, limit = 50 } = req.query;
  let where = ['t.archived = $1'], vals = [archived === 'true'], idx = 2;

  if (status) { where.push(`t.status = $${idx++}`); vals.push(status); }
  if (project) { where.push(`t.project = $${idx++}`); vals.push(project); }
  if (tags) {
    const tagList = tags.split(',');
    where.push(`t.tags && $${idx++}::text[]`);
    vals.push(tagList);
  }
  if (search) {
    where.push(`to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')) @@ plainto_tsquery('english', $${idx++})`);
    vals.push(search);
  }
  if (agent) {
    where.push(`EXISTS (SELECT 1 FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = t.id AND LOWER(a.name) = LOWER($${idx++}))`);
    vals.push(agent);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const { rows } = await pool.query(`
    SELECT t.*,
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'emoji', a.emoji)) FILTER (WHERE a.id IS NOT NULL), '[]') as assignees,
      (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count,
      ca.name as created_by_name
    FROM tasks t
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    LEFT JOIN agents a ON a.id = ta.agent_id
    LEFT JOIN agents ca ON ca.id = t.created_by
    ${whereClause}
    GROUP BY t.id, ca.name
    ORDER BY
      CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.due_date NULLS LAST,
      t.created_at DESC
    LIMIT $${idx}
  `, [...vals, parseInt(limit)]);
  res.json(rows);
});

app.get('/api/tasks/:id', async (req, res) => {
  const { rows: [task] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const { rows: assignees } = await pool.query(`
    SELECT a.id, a.name, a.emoji FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = $1
  `, [req.params.id]);

  const { rows: comments } = await pool.query(`
    SELECT c.*, a.name as agent_name, a.emoji FROM comments c JOIN agents a ON a.id = c.agent_id WHERE c.task_id = $1 ORDER BY c.created_at
  `, [req.params.id]);

  const { rows: docs } = await pool.query(`
    SELECT d.*, a.name as agent_name FROM documents d LEFT JOIN agents a ON a.id = d.agent_id WHERE d.task_id = $1 ORDER BY d.created_at
  `, [req.params.id]);

  res.json({ ...task, assignees, comments, documents: docs });
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, priority, assignees, created_by, tags, project, due_date, recurrence } = req.body;
  const { rows: [task] } = await pool.query(
    `INSERT INTO tasks (title, description, priority, created_by, status, tags, project, due_date, recurrence) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, description || '', priority || 'normal', created_by || null, assignees?.length ? 'assigned' : 'inbox', 
     tags || [], project || null, due_date || null, recurrence || null]
  );
  if (assignees?.length) {
    for (const aid of assignees) {
      await pool.query('INSERT INTO task_assignees (task_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [task.id, aid]);
    }
  }
  // Log activity
  await pool.query(
    "INSERT INTO activities (type, agent_id, task_id, message) VALUES ('task_created', $1, $2, $3)",
    [created_by, task.id, `Created task #${task.id}: ${title}`]
  );
  res.json(task);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const { status, title, description, priority, tags, project, due_date, archived, time_spent_minutes, token_spend } = req.body;
  const sets = [], vals = [];
  let idx = 1;
  if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
  if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
  if (priority !== undefined) { sets.push(`priority = $${idx++}`); vals.push(priority); }
  if (tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(tags); }
  if (project !== undefined) { sets.push(`project = $${idx++}`); vals.push(project); }
  if (due_date !== undefined) { sets.push(`due_date = $${idx++}`); vals.push(due_date); }
  if (archived !== undefined) { sets.push(`archived = $${idx++}`); vals.push(archived); }
  if (time_spent_minutes !== undefined) { sets.push(`time_spent_minutes = $${idx++}`); vals.push(time_spent_minutes); }
  if (token_spend !== undefined) { sets.push(`token_spend = $${idx++}`); vals.push(token_spend); }
  sets.push('updated_at = NOW()');
  vals.push(req.params.id);
  const { rows: [task] } = await pool.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
  res.json(task);
});

// Archive/Unarchive
app.post('/api/tasks/:id/archive', async (req, res) => {
  const { rows: [task] } = await pool.query('UPDATE tasks SET archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
  res.json(task);
});

app.post('/api/tasks/:id/unarchive', async (req, res) => {
  const { rows: [task] } = await pool.query('UPDATE tasks SET archived = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
  res.json(task);
});

// Track time
app.post('/api/tasks/:id/time', async (req, res) => {
  const { minutes } = req.body;
  const { rows: [task] } = await pool.query(
    'UPDATE tasks SET time_spent_minutes = time_spent_minutes + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [minutes, req.params.id]
  );
  res.json(task);
});

// Track tokens
app.post('/api/tasks/:id/tokens', async (req, res) => {
  const { tokens } = req.body;
  const { rows: [task] } = await pool.query(
    'UPDATE tasks SET token_spend = token_spend + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [tokens, req.params.id]
  );
  res.json(task);
});

// ─── PROJECTS ───────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT DISTINCT project, COUNT(*) as task_count 
    FROM tasks 
    WHERE project IS NOT NULL AND archived = FALSE
    GROUP BY project 
    ORDER BY task_count DESC
  `);
  res.json(rows);
});

// ─── TAGS ───────────────────────────────────────────

app.get('/api/tags', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
    FROM tasks WHERE archived = FALSE
    GROUP BY tag ORDER BY count DESC
  `);
  res.json(rows);
});

// ─── COMMENTS ───────────────────────────────────────

app.post('/api/tasks/:id/comments', async (req, res) => {
  const { agent_id, content } = req.body;
  const { rows: [comment] } = await pool.query(
    'INSERT INTO comments (task_id, agent_id, content) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, agent_id, content]
  );
  await pool.query('INSERT INTO thread_subscriptions (task_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, agent_id]);
  await pool.query(
    "INSERT INTO activities (type, agent_id, task_id, message) VALUES ('comment_added', $1, $2, $3)",
    [agent_id, req.params.id, `Commented on task #${req.params.id}`]
  );
  res.json(comment);
});

// ─── ACTIVITY FEED ──────────────────────────────────

app.get('/api/activities', async (req, res) => {
  const limit = req.query.limit || 50;
  const { rows } = await pool.query(`
    SELECT ac.*, a.name as agent_name, a.emoji
    FROM activities ac
    LEFT JOIN agents a ON a.id = ac.agent_id
    ORDER BY ac.created_at DESC
    LIMIT $1
  `, [parseInt(limit)]);
  res.json(rows);
});

// ─── SEARCH ─────────────────────────────────────────

app.get('/api/search', async (req, res) => {
  const { q, include_archived } = req.query;
  if (!q) return res.json([]);
  
  const { rows } = await pool.query(`
    SELECT t.*, 
      COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name)) FILTER (WHERE a.id IS NOT NULL), '[]') as assignees,
      ts_rank(to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')), plainto_tsquery('english', $1)) as rank
    FROM tasks t
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    LEFT JOIN agents a ON a.id = ta.agent_id
    WHERE to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')) @@ plainto_tsquery('english', $1)
      ${include_archived === 'true' ? '' : 'AND t.archived = FALSE'}
    GROUP BY t.id
    ORDER BY rank DESC
    LIMIT 20
  `, [q]);
  res.json(rows);
});

// ─── STANDUP ────────────────────────────────────────

app.get('/api/standup', async (req, res) => {
  const result = {};
  for (const status of ['done', 'in_progress', 'review', 'blocked']) {
    const { rows } = await pool.query(`
      SELECT t.id, t.title, t.time_spent_minutes, t.token_spend, string_agg(a.name, ', ') as assignees
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN agents a ON a.id = ta.agent_id
      WHERE t.status = $1 AND t.updated_at > NOW() - INTERVAL '24 hours' AND t.archived = FALSE
      GROUP BY t.id
    `, [status]);
    result[status] = rows;
  }
  res.json(result);
});

// ─── STATS ──────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  const { rows: [counts] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'inbox' AND archived = FALSE) as inbox,
      COUNT(*) FILTER (WHERE status = 'assigned' AND archived = FALSE) as assigned,
      COUNT(*) FILTER (WHERE status = 'in_progress' AND archived = FALSE) as in_progress,
      COUNT(*) FILTER (WHERE status = 'review' AND archived = FALSE) as review,
      COUNT(*) FILTER (WHERE status = 'done' AND archived = FALSE) as done,
      COUNT(*) FILTER (WHERE status = 'blocked' AND archived = FALSE) as blocked,
      COUNT(*) FILTER (WHERE archived = FALSE) as total,
      COUNT(*) FILTER (WHERE archived = TRUE) as archived,
      SUM(time_spent_minutes) FILTER (WHERE archived = FALSE) as total_time,
      SUM(token_spend) FILTER (WHERE archived = FALSE) as total_tokens
    FROM tasks
  `);
  res.json(counts);
});

// ─── DRAG & DROP (Reorder/Move) ─────────────────────

app.post('/api/tasks/:id/move', async (req, res) => {
  const { status, agent_id } = req.body;
  const updates = ['updated_at = NOW()'];
  const vals = [];
  let idx = 1;
  
  if (status) {
    updates.push(`status = $${idx++}`);
    vals.push(status);
  }
  
  vals.push(req.params.id);
  const { rows: [task] } = await pool.query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );
  
  // Log activity
  if (agent_id) {
    await pool.query(
      "INSERT INTO activities (type, agent_id, task_id, message) VALUES ('status_changed', $1, $2, $3)",
      [agent_id, req.params.id, `Moved task #${req.params.id} to ${status}`]
    );
  }
  
  res.json(task);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.MC_PORT || 3847;
app.listen(PORT, () => console.log(`🚀 Mission Control API on http://localhost:${PORT}`));
