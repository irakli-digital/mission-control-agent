/**
 * Notify agents about task changes via OpenClaw Gateway Tools Invoke API.
 * Uses sessions_send to deliver messages directly to agent main sessions.
 * For "in_progress" tasks, sends actionable work instructions.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Map MC agent names → OpenClaw full session keys
const AGENT_SESSION_MAP = {
  'mura': 'agent:mura:main',
  'jiji': 'agent:jiji:main',
  'baski': 'agent:main:main',
  'mentor': 'agent:mentor:main',
  'doctor mura': 'agent:doctor:main',
  'doctor': 'agent:doctor:main',
  'content jiji': 'agent:writer:main',
  'writer': 'agent:writer:main',
};

// Read gateway config
let gatewayToken = '';
let gatewayPort = 18789;
try {
  const config = JSON.parse(readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf-8'));
  gatewayToken = config.gateway?.auth?.token || '';
  gatewayPort = config.gateway?.port || 18789;
} catch (e) {
  console.warn('[mc-api] Could not read gateway config');
}

const GATEWAY_URL = `http://127.0.0.1:${gatewayPort}`;

async function invokeGatewayTool(tool, args, sessionKey) {
  const body = { tool, args };
  if (sessionKey) body.sessionKey = sessionKey;
  
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gatewayToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Send a message to an agent's main session via sessions_send.
 */
export async function notifyAgent(agentName, message) {
  const sessionKey = AGENT_SESSION_MAP[agentName.toLowerCase()];
  if (!sessionKey) {
    console.warn(`[mc-api] No OpenClaw session mapping for "${agentName}"`);
    return;
  }
  if (!gatewayToken) {
    console.warn(`[mc-api] No gateway token — cannot notify ${agentName}`);
    return;
  }

  console.log(`[mc-api] Notifying agent ${agentName} (session: ${sessionKey})`);
  try {
    const { ok, data } = await invokeGatewayTool('sessions_send', { sessionKey, message });
    console.log(`[mc-api] ${ok ? '✓' : '✗'} Notified ${agentName}:`, ok ? 'delivered' : JSON.stringify(data));
  } catch (err) {
    console.error(`[mc-api] Error notifying ${agentName}:`, err.message);
  }
}

/**
 * Notify all assignees of a task about a status change.
 * For "in_progress" → sends work instructions to the agent's main session.
 * For other statuses → sends informational notification.
 */
export async function notifyTaskAssignees(pool, taskId, newStatus, task) {
  const NOTIFY_STATUSES = ['assigned', 'in_progress', 'blocked', 'review'];
  if (!NOTIFY_STATUSES.includes(newStatus)) return;

  try {
    const { rows: assignees } = await pool.query(
      'SELECT a.name FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = $1',
      [taskId]
    );

    if (assignees.length === 0) return;

    for (const { name } of assignees) {
      if (newStatus === 'in_progress') {
        const message = `🚀 Mission Control — Task #${taskId} moved to In Progress. Start working on this:\n\n**${task.title}**${task.description ? `\n\n${task.description}` : ''}\n\nPriority: ${task.priority}\n\nWhen done, update MC:\n• Progress: bash ~/.openclaw/workspace-mura/projects/mission-control/mc.sh comment ${taskId} "what you did" -b ${name}\n• Done: bash ~/.openclaw/workspace-mura/projects/mission-control/mc.sh update ${taskId} -s review -b ${name}`;
        await notifyAgent(name, message);
      } else {
        const statusEmoji = { assigned: '📌', blocked: '🚫', review: '👀' };
        const emoji = statusEmoji[newStatus] || '📋';
        const message = `${emoji} Mission Control — Task #${taskId} moved to **${newStatus}**: "${task.title}" (Priority: ${task.priority}).`;
        await notifyAgent(name, message);
      }
    }
  } catch (err) {
    console.error(`[mc-api] Error looking up assignees for task ${taskId}:`, err.message);
  }
}
