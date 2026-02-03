/**
 * Notification Delivery Daemon
 * Polls for undelivered notifications and sends them to agents via Clawdbot sessions_send.
 * Run with: node notify-daemon.js
 */
import pg from 'pg';
import { execSync } from 'child_process';

const pool = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL });

const AGENT_SESSIONS = {
  'agent:mura:main': 'mura',
  'agent:main:main': 'main',
  'agent:baski:main': 'baski',
};

async function deliverNotifications() {
  const { rows } = await pool.query(`
    SELECT n.id, n.content, n.task_id,
           ma.session_key as to_session, ma.name as to_name,
           fa.name as from_name
    FROM notifications n
    JOIN agents ma ON ma.id = n.mentioned_agent_id
    LEFT JOIN agents fa ON fa.id = n.from_agent_id
    WHERE n.delivered = FALSE
    ORDER BY n.created_at
    LIMIT 10
  `);

  for (const n of rows) {
    try {
      // Use clawdbot CLI to send to the agent's session
      const msg = `🔔 Mission Control: ${n.content}`;
      console.log(`  → Delivering to ${n.to_name} (${n.to_session}): ${n.content.substring(0, 80)}...`);
      
      // Mark as delivered first to avoid re-sending on failure
      await pool.query('UPDATE notifications SET delivered = TRUE WHERE id = $1', [n.id]);
      
      // Try to send via clawdbot sessions_send
      // This will wake the agent if they have an active session
      try {
        execSync(`clawdbot sessions send --session "${n.to_session}" --message "${msg.replace(/"/g, '\\"')}"`, {
          timeout: 10000,
          stdio: 'pipe'
        });
        console.log(`    ✅ Delivered to ${n.to_name}`);
      } catch (e) {
        // Session might not be active — that's OK, notification is queued in DB
        console.log(`    ⚠️ Session not active for ${n.to_name} — notification saved in DB`);
      }
    } catch (err) {
      console.error(`  ❌ Error delivering to ${n.to_name}:`, err.message);
    }
  }
  
  return rows.length;
}

async function run() {
  console.log('🔔 Notification daemon started (polling every 5s)');
  
  while (true) {
    try {
      const count = await deliverNotifications();
      if (count > 0) console.log(`  Processed ${count} notification(s)`);
    } catch (err) {
      console.error('Poll error:', err.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

run();
