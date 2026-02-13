import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function contentRoutes(pool, broadcast) {
  const router = Router();

  router.get('/content/stats', asyncHandler(async (req, res) => {
    const { rows: [counts] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'idea') as idea,
        COUNT(*) FILTER (WHERE status = 'scripted') as scripted,
        COUNT(*) FILTER (WHERE status = 'recording') as recording,
        COUNT(*) FILTER (WHERE status = 'editing') as editing,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) as total
      FROM content_calendar
    `);
    res.json(counts);
  }));

  router.get('/content', asyncHandler(async (req, res) => {
    const { status, platform, limit = 100 } = req.query;
    let where = [], vals = [], idx = 1;

    if (status) { where.push(`status = $${idx++}`); vals.push(status); }
    if (platform) { where.push(`platform = $${idx++}`); vals.push(platform); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(`
      SELECT * FROM content_calendar
      ${whereClause}
      ORDER BY 
        CASE status 
          WHEN 'idea' THEN 0 WHEN 'scripted' THEN 1 WHEN 'recording' THEN 2 
          WHEN 'editing' THEN 3 WHEN 'scheduled' THEN 4 WHEN 'published' THEN 5 
        END,
        scheduled_date NULLS LAST,
        created_at DESC
      LIMIT $${idx}
    `, [...vals, parseInt(limit)]);
    res.json(rows);
  }));

  router.get('/content/:id', asyncHandler(async (req, res) => {
    const { rows: [content] } = await pool.query('SELECT * FROM content_calendar WHERE id = $1', [req.params.id]);
    if (!content) return res.status(404).json({ error: 'Not found' });
    res.json(content);
  }));

  router.post('/content', asyncHandler(async (req, res) => {
    const { title, angle, description, platform, status, scheduled_date, published_url, thumbnail_status, tags, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { rows: [content] } = await pool.query(`
      INSERT INTO content_calendar (title, angle, description, platform, status, scheduled_date, published_url, thumbnail_status, tags, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [title, angle || null, description || null, platform || 'youtube', status || 'idea',
        scheduled_date || null, published_url || null, thumbnail_status || null, tags || [], notes || null]);
    broadcast('content:updated', { content });
    res.json(content);
  }));

  router.patch('/content/:id', asyncHandler(async (req, res) => {
    const { title, angle, description, platform, status, scheduled_date, published_url, thumbnail_status, tags, notes } = req.body;
    const sets = [], vals = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (angle !== undefined) { sets.push(`angle = $${idx++}`); vals.push(angle); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (platform !== undefined) { sets.push(`platform = $${idx++}`); vals.push(platform); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (scheduled_date !== undefined) { sets.push(`scheduled_date = $${idx++}`); vals.push(scheduled_date); }
    if (published_url !== undefined) { sets.push(`published_url = $${idx++}`); vals.push(published_url); }
    if (thumbnail_status !== undefined) { sets.push(`thumbnail_status = $${idx++}`); vals.push(thumbnail_status); }
    if (tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(tags); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(notes); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    vals.push(req.params.id);
    const { rows: [content] } = await pool.query(
      `UPDATE content_calendar SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    broadcast('content:updated', { content });
    res.json(content);
  }));

  router.post('/content/:id/move', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { rows: [content] } = await pool.query(
      'UPDATE content_calendar SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    broadcast('content:updated', { content });
    res.json(content);
  }));

  router.delete('/content/:id', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM content_calendar WHERE id = $1', [req.params.id]);
    broadcast('content:updated', { deleted: req.params.id });
    res.json({ success: true });
  }));

  return router;
}
