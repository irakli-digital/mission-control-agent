import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function statsRoutes(pool) {
  const router = Router();

  router.get('/stats', asyncHandler(async (req, res) => {
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
  }));

  router.get('/projects', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
      SELECT DISTINCT project, COUNT(*) as task_count 
      FROM tasks WHERE project IS NOT NULL AND archived = FALSE
      GROUP BY project ORDER BY task_count DESC
    `);
    res.json(rows);
  }));

  router.get('/tags', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
      SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
      FROM tasks WHERE archived = FALSE
      GROUP BY tag ORDER BY count DESC
    `);
    res.json(rows);
  }));

  router.get('/activities', asyncHandler(async (req, res) => {
    const limit = req.query.limit || 50;
    const { rows } = await pool.query(`
      SELECT ac.*, a.name as agent_name, a.emoji
      FROM activities ac LEFT JOIN agents a ON a.id = ac.agent_id
      ORDER BY ac.created_at DESC LIMIT $1
    `, [parseInt(limit)]);
    res.json(rows);
  }));

  // Activity creation (for CLI)
  router.post('/activities', asyncHandler(async (req, res) => {
    const { type, agent_id, task_id, message } = req.body;
    const { rows: [activity] } = await pool.query(
      'INSERT INTO activities (type, agent_id, task_id, message) VALUES ($1, $2, $3, $4) RETURNING *',
      [type, agent_id, task_id, message]
    );
    res.json(activity);
  }));

  router.get('/search', asyncHandler(async (req, res) => {
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
      GROUP BY t.id ORDER BY rank DESC LIMIT 20
    `, [q]);
    res.json(rows);
  }));

  router.get('/standup', asyncHandler(async (req, res) => {
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
  }));

  return router;
}
