import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export default function agentRoutes(pool) {
  const router = Router();

  router.get('/agents', asyncHandler(async (req, res) => {
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
  }));

  return router;
}
