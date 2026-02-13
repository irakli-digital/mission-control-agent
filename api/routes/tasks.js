import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { notifyTaskAssignees } from '../lib/notifyAgent.js';

const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const VALID_STATUSES = ['inbox', 'assigned', 'in_progress', 'blocked', 'review', 'done', 'cancelled'];

export default function taskRoutes(pool, broadcast) {
  const router = Router();

  router.get('/tasks', asyncHandler(async (req, res) => {
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
  }));

  router.get('/tasks/:id', asyncHandler(async (req, res) => {
    const { rows: [task] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Not found' });

    const { rows: assignees } = await pool.query(
      'SELECT a.id, a.name, a.emoji FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = $1',
      [req.params.id]
    );
    const { rows: comments } = await pool.query(
      'SELECT c.*, a.name as agent_name, a.emoji FROM comments c JOIN agents a ON a.id = c.agent_id WHERE c.task_id = $1 ORDER BY c.created_at',
      [req.params.id]
    );
    const { rows: docs } = await pool.query(
      'SELECT d.*, a.name as agent_name FROM documents d LEFT JOIN agents a ON a.id = d.agent_id WHERE d.task_id = $1 ORDER BY d.created_at',
      [req.params.id]
    );

    res.json({ ...task, assignees, comments, documents: docs });
  }));

  router.post('/tasks', asyncHandler(async (req, res) => {
    const { title, description, priority, assignees, created_by, tags, project, due_date, recurrence } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

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
    await pool.query(
      "INSERT INTO activities (type, agent_id, task_id, message) VALUES ('task_created', $1, $2, $3)",
      [created_by, task.id, `Created task #${task.id}: ${title}`]
    );
    broadcast('task:created', { task });

    // Notify assigned agents about the new task
    if (assignees?.length) {
      notifyTaskAssignees(pool, task.id, 'assigned', task);
    }

    res.json(task);
  }));

  router.patch('/tasks/:id', asyncHandler(async (req, res) => {
    const { status, title, description, priority, tags, project, due_date, archived, time_spent_minutes, token_spend } = req.body;

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

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
    broadcast('task:updated', { task });

    // Notify agents on status change
    if (status) {
      notifyTaskAssignees(pool, req.params.id, status, task);
    }

    res.json(task);
  }));

  router.post('/tasks/:id/archive', asyncHandler(async (req, res) => {
    const { rows: [task] } = await pool.query('UPDATE tasks SET archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    broadcast('task:updated', { task });
    res.json(task);
  }));

  router.post('/tasks/:id/unarchive', asyncHandler(async (req, res) => {
    const { rows: [task] } = await pool.query('UPDATE tasks SET archived = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    broadcast('task:updated', { task });
    res.json(task);
  }));

  router.post('/tasks/:id/time', asyncHandler(async (req, res) => {
    const { minutes } = req.body;
    const { rows: [task] } = await pool.query(
      'UPDATE tasks SET time_spent_minutes = time_spent_minutes + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [minutes, req.params.id]
    );
    res.json(task);
  }));

  router.post('/tasks/:id/tokens', asyncHandler(async (req, res) => {
    const { tokens } = req.body;
    const { rows: [task] } = await pool.query(
      'UPDATE tasks SET token_spend = token_spend + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [tokens, req.params.id]
    );
    res.json(task);
  }));

  router.post('/tasks/:id/move', asyncHandler(async (req, res) => {
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

    if (agent_id) {
      await pool.query(
        "INSERT INTO activities (type, agent_id, task_id, message) VALUES ('status_changed', $1, $2, $3)",
        [agent_id, req.params.id, `Moved task #${req.params.id} to ${status}`]
      );
    }

    broadcast('task:moved', { task });

    // Notify assigned agents about the status change
    if (status) {
      notifyTaskAssignees(pool, req.params.id, status, task);
    }

    res.json(task);
  }));

  router.post('/tasks/:id/comments', asyncHandler(async (req, res) => {
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
  }));

  // Bulk operations
  router.post('/tasks/bulk/archive', asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const { rowCount } = await pool.query(
      'UPDATE tasks SET archived = TRUE, updated_at = NOW() WHERE id = ANY($1::int[]) RETURNING *',
      [ids]
    );
    broadcast('task:updated', { bulk: true });
    res.json({ archived: rowCount });
  }));

  router.post('/tasks/bulk/move', asyncHandler(async (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Valid status required' });
    const { rowCount } = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING *',
      [status, ids]
    );
    broadcast('task:updated', { bulk: true });
    res.json({ moved: rowCount });
  }));

  router.post('/tasks/bulk/assign', asyncHandler(async (req, res) => {
    const { ids, agent_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!agent_id) return res.status(400).json({ error: 'agent_id required' });
    for (const id of ids) {
      await pool.query('INSERT INTO task_assignees (task_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, agent_id]);
    }
    await pool.query(
      'UPDATE tasks SET status = CASE WHEN status = \'inbox\' THEN \'assigned\' ELSE status END, updated_at = NOW() WHERE id = ANY($1::int[])',
      [ids]
    );
    broadcast('task:updated', { bulk: true });

    // Notify newly assigned agent
    const { rows: [agent] } = await pool.query('SELECT name FROM agents WHERE id = $1', [agent_id]);
    if (agent) {
      for (const id of ids) {
        const { rows: [task] } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (task) {
          const { notifyAgent } = await import('../lib/notifyAgent.js');
          await notifyAgent(agent.name, `📌 Mission Control — Task #${id} assigned to you: "${task.title}" (Priority: ${task.priority}). Pick this up.`);
        }
      }
    }

    res.json({ assigned: ids.length });
  }));

  // Remove assignee from task
  router.delete('/tasks/:id/assignees/:agentId', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM task_assignees WHERE task_id = $1 AND agent_id = $2', [req.params.id, req.params.agentId]);
    broadcast('task:updated', { taskId: req.params.id });
    res.json({ ok: true });
  }));

  return router;
}
