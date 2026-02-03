import { useState, useEffect, useCallback, useRef } from 'react';
import { getAgents, getTasks, getActivities, getStats, getTask, updateTask, addComment } from './api';

const API = import.meta.env.VITE_API_URL || '';

const STATUS_COLS = ['inbox', 'assigned', 'in_progress', 'review', 'done'];
const STATUS_LABELS = { inbox: '📥 Inbox', assigned: '📋 Assigned', in_progress: '🔄 In Progress', review: '👀 Review', done: '✅ Done', blocked: '🚫 Blocked' };
const PRIORITY_COLORS = { urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-zinc-600', low: 'bg-blue-500' };
const STATUS_COLORS = { idle: 'bg-zinc-500', active: 'bg-green-500', blocked: 'bg-red-500' };

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTime(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

function formatTokens(tokens) {
  if (!tokens) return '0';
  if (tokens >= 1000000) return `${(tokens/1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens/1000).toFixed(1)}K`;
  return tokens;
}

function AgentAvatar({ agent, size = 'md' }) {
  const sizes = { sm: 'w-6 h-6 text-sm', md: 'w-10 h-10 text-2xl', lg: 'w-12 h-12 text-3xl' };
  
  if (agent.avatar_url) {
    return (
      <img 
        src={agent.avatar_url} 
        alt={agent.name}
        className={`${sizes[size].split(' ').slice(0, 2).join(' ')} rounded-full object-cover`}
      />
    );
  }
  return <span className={sizes[size].split(' ').slice(2).join(' ')}>{agent.emoji}</span>;
}

function AgentCards({ agents, onAgentClick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {agents.map(a => (
        <div 
          key={a.id} 
          onClick={() => onAgentClick(a)}
          className="bg-[#222] border border-[#333] rounded-lg p-4 hover:border-amber-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-2">
            <AgentAvatar agent={a} size="md" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">{a.name}</div>
              <div className="text-xs text-zinc-500">{a.role}</div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[a.status]}`} title={a.status} />
          </div>
          <div className="flex gap-4 text-xs text-zinc-400 mt-3">
            <span>📋 {a.total_tasks} tasks</span>
            <span>🔄 {a.active_tasks} active</span>
            {a.unread > 0 && <span className="text-amber-400">🔔 {a.unread}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, onClick, onDragStart, onDragEnd, dragging }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(task.id)}
      className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-3 mb-2 cursor-pointer hover:border-amber-500/40 transition-all group ${dragging === task.id ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-200 group-hover:text-white line-clamp-2">
            {task.title}
          </div>
          
          {/* Tags */}
          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Project */}
          {task.project && (
            <div className="text-[10px] text-purple-400 mt-1">📁 {task.project}</div>
          )}
          
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex -space-x-1">
              {task.assignees?.filter(a => a.id).map(a => (
                <span key={a.id} className="text-xs" title={a.name}>{a.emoji}</span>
              ))}
            </div>
            {task.comment_count > 0 && (
              <span className="text-xs text-zinc-500">💬 {task.comment_count}</span>
            )}
            {task.time_spent_minutes > 0 && (
              <span className="text-xs text-blue-400">⏱ {formatTime(task.time_spent_minutes)}</span>
            )}
            {task.token_spend > 0 && (
              <span className="text-xs text-green-400">🪙 {formatTokens(task.token_spend)}</span>
            )}
            {task.due_date && (
              <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                📅 {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            <span className="text-xs text-zinc-600 ml-auto">{timeAgo(task.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ tasks, onTaskClick, onMoveTask }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Filter out recurring tasks - they go in separate section
  const nonRecurring = tasks.filter(t => !t.recurrence);

  const handleDragStart = (e, task) => {
    setDragging(task.id);
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOver(status);
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setDragOver(null);
    setDragging(null);
    if (taskId) {
      await onMoveTask(parseInt(taskId), status);
    }
  };

  const cols = STATUS_COLS.map(s => ({
    status: s,
    label: STATUS_LABELS[s],
    tasks: nonRecurring.filter(t => t.status === s),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {cols.map(col => (
        <div 
          key={col.status} 
          className={`flex-1 min-w-[200px] sm:min-w-[220px] ${dragOver === col.status ? 'bg-amber-500/10 rounded-lg' : ''}`}
          onDragOver={(e) => handleDragOver(e, col.status)}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, col.status)}
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-sm font-medium text-zinc-400">{col.label}</span>
            <span className="text-xs bg-[#333] text-zinc-500 px-1.5 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>
          <div className="space-y-0 min-h-[100px]">
            {col.tasks.map(t => (
              <TaskCard 
                key={t.id} 
                task={t} 
                onClick={onTaskClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                dragging={dragging}
              />
            ))}
            {col.tasks.length === 0 && (
              <div className="text-xs text-zinc-700 text-center py-8 border border-dashed border-[#2a2a2a] rounded-md">
                Drop here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ activities }) {
  return (
    <div className="bg-[#222] border border-[#333] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-3">📊 Activity Feed</h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {activities.map(a => (
          <div key={a.id} className="flex gap-2 text-xs py-1.5 border-b border-[#2a2a2a] last:border-0">
            <span>{a.emoji || '⚙️'}</span>
            <span className="text-zinc-400 flex-1">{a.message}</span>
            <span className="text-zinc-600 shrink-0">{timeAgo(a.created_at)}</span>
          </div>
        ))}
        {activities.length === 0 && <div className="text-xs text-zinc-600">No activity yet.</div>}
      </div>
    </div>
  );
}

function RecurringJobs({ tasks, agents, onTaskClick }) {
  const [expanded, setExpanded] = useState(false);
  const recurring = tasks.filter(t => t.recurrence);
  if (recurring.length === 0) return null;

  // Group recurring tasks by agent
  const tasksByAgent = {};
  agents.forEach(a => { tasksByAgent[a.id] = { agent: a, tasks: [] }; });
  tasksByAgent['unassigned'] = { agent: { id: 'unassigned', name: 'Unassigned' }, tasks: [] };
  
  recurring.forEach(t => {
    const assignee = t.assignees?.find(a => a.id);
    if (assignee) {
      if (tasksByAgent[assignee.id]) {
        tasksByAgent[assignee.id].tasks.push(t);
      }
    } else {
      tasksByAgent['unassigned'].tasks.push(t);
    }
  });

  return (
    <div className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#222] transition-colors"
      >
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Recurring Jobs <span className="text-zinc-600">({recurring.length})</span>
        </span>
        <span className={`text-zinc-600 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </div>
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {agents.map(agent => {
            const agentTasks = tasksByAgent[agent.id]?.tasks || [];
            if (agentTasks.length === 0) return null;
            
            return (
              <div key={agent.id} className="min-w-0">
                <div className="text-xs font-medium text-zinc-500 mb-2 truncate">{agent.name}</div>
                <div className="space-y-1">
                  {agentTasks.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className="bg-[#222] border border-[#2a2a2a] rounded px-2 py-1.5 cursor-pointer hover:border-zinc-600 transition-colors"
                    >
                      <div className="text-xs text-zinc-400 truncate">{t.title.replace(/\s*\([^)]*\)\s*$/, '')}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">{t.recurrence}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {tasksByAgent['unassigned'].tasks.length > 0 && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-500 mb-2">Unassigned</div>
              <div className="space-y-1">
                {tasksByAgent['unassigned'].tasks.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => onTaskClick(t.id)}
                    className="bg-[#222] border border-[#2a2a2a] rounded px-2 py-1.5 cursor-pointer hover:border-zinc-600 transition-colors"
                  >
                    <div className="text-xs text-zinc-400 truncate">{t.title.replace(/\s*\([^)]*\)\s*$/, '')}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{t.recurrence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Total', value: stats.total, color: 'text-white' },
    { label: 'In Progress', value: stats.in_progress, color: 'text-blue-400' },
    { label: 'Review', value: stats.review, color: 'text-amber-400' },
    { label: 'Done', value: stats.done, color: 'text-green-400' },
    { label: 'Blocked', value: stats.blocked, color: 'text-red-400' },
  ];
  return (
    <div className="flex gap-4 sm:gap-6 mb-6 px-1 overflow-x-auto">
      {items.map(i => (
        <div key={i.label} className="text-center shrink-0">
          <div className={`text-lg sm:text-xl font-bold ${i.color}`}>{i.value}</div>
          <div className="text-[10px] sm:text-xs text-zinc-500">{i.label}</div>
        </div>
      ))}
      {stats.total_time > 0 && (
        <div className="text-center shrink-0 border-l border-[#333] pl-4">
          <div className="text-lg sm:text-xl font-bold text-blue-400">⏱ {formatTime(stats.total_time)}</div>
          <div className="text-[10px] sm:text-xs text-zinc-500">Time</div>
        </div>
      )}
      {stats.total_tokens > 0 && (
        <div className="text-center shrink-0">
          <div className="text-lg sm:text-xl font-bold text-green-400">🪙 {formatTokens(stats.total_tokens)}</div>
          <div className="text-[10px] sm:text-xs text-zinc-500">Tokens</div>
        </div>
      )}
      {stats.archived > 0 && (
        <div className="text-center shrink-0 border-l border-[#333] pl-4">
          <div className="text-lg sm:text-xl font-bold text-zinc-500">📦 {stats.archived}</div>
          <div className="text-[10px] sm:text-xs text-zinc-500">Archived</div>
        </div>
      )}
    </div>
  );
}

function SearchResults({ results, onTaskClick, onClose }) {
  if (!results.length) return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-[#222] border border-[#333] rounded-lg p-4 z-50 shadow-xl">
      <div className="text-sm text-zinc-500">No results found</div>
    </div>
  );
  
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-[#222] border border-[#333] rounded-lg overflow-hidden z-50 shadow-xl max-h-[300px] overflow-y-auto">
      {results.map(t => (
        <div 
          key={t.id}
          onClick={() => { onTaskClick(t.id); onClose(); }}
          className="p-3 hover:bg-[#2a2a2a] cursor-pointer border-b border-[#333] last:border-0"
        >
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[t.priority]}`} />
            <span className="text-sm text-zinc-200">{t.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${t.archived ? 'bg-zinc-700 text-zinc-400' : 'bg-[#333] text-zinc-500'}`}>
              {t.archived ? 'archived' : t.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentDetail({ agent, onClose, onTaskClick }) {
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState('tasks');

  useEffect(() => {
    if (agent) {
      // Fetch agent's tasks
      fetch(`${API}/api/tasks?agent=${encodeURIComponent(agent.name)}&archived=false`)
        .then(r => r.json())
        .then(setTasks);
      // Fetch agent's activities
      fetch(`${API}/api/activities?limit=50`)
        .then(r => r.json())
        .then(all => setActivities(all.filter(a => a.agent_name === agent.name)));
    }
  }, [agent]);

  if (!agent) return null;

  const tasksByStatus = {
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    assigned: tasks.filter(t => t.status === 'assigned'),
    review: tasks.filter(t => t.status === 'review'),
    done: tasks.filter(t => t.status === 'done'),
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <AgentAvatar agent={agent} size="lg" />
              <div>
                <h2 className="text-lg font-bold text-white">{agent.name}</h2>
                <div className="text-sm text-zinc-500">{agent.role}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ml-2 ${STATUS_COLORS[agent.status]}`} />
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-4 p-3 bg-[#222] rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{agent.total_tasks}</div>
              <div className="text-xs text-zinc-500">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">{agent.active_tasks}</div>
              <div className="text-xs text-zinc-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-400">{agent.unread || 0}</div>
              <div className="text-xs text-zinc-500">Unread</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-[#333] pb-2">
            <button
              onClick={() => setTab('tasks')}
              className={`text-sm px-3 py-1 rounded-md ${tab === 'tasks' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-white'}`}
            >
              📋 Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setTab('activity')}
              className={`text-sm px-3 py-1 rounded-md ${tab === 'activity' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-white'}`}
            >
              📊 Activity ({activities.length})
            </button>
          </div>

          {/* Content */}
          {tab === 'tasks' && (
            <div className="space-y-4">
              {tasksByStatus.in_progress.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-blue-400 mb-2">🔄 In Progress</h3>
                  {tasksByStatus.in_progress.map(t => (
                    <div key={t.id} onClick={() => { onTaskClick(t.id); onClose(); }} className="bg-[#222] p-3 rounded-md mb-2 cursor-pointer hover:bg-[#2a2a2a]">
                      <div className="text-sm text-white">{t.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">{timeAgo(t.updated_at)}</div>
                    </div>
                  ))}
                </div>
              )}
              {tasksByStatus.assigned.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 mb-2">📋 Assigned</h3>
                  {tasksByStatus.assigned.map(t => (
                    <div key={t.id} onClick={() => { onTaskClick(t.id); onClose(); }} className="bg-[#222] p-3 rounded-md mb-2 cursor-pointer hover:bg-[#2a2a2a]">
                      <div className="text-sm text-white">{t.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">{timeAgo(t.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
              {tasksByStatus.review.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-400 mb-2">👀 Review</h3>
                  {tasksByStatus.review.map(t => (
                    <div key={t.id} onClick={() => { onTaskClick(t.id); onClose(); }} className="bg-[#222] p-3 rounded-md mb-2 cursor-pointer hover:bg-[#2a2a2a]">
                      <div className="text-sm text-white">{t.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">{timeAgo(t.updated_at)}</div>
                    </div>
                  ))}
                </div>
              )}
              {tasksByStatus.done.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-green-400 mb-2">✅ Done (recent)</h3>
                  {tasksByStatus.done.slice(0, 5).map(t => (
                    <div key={t.id} onClick={() => { onTaskClick(t.id); onClose(); }} className="bg-[#222] p-3 rounded-md mb-2 cursor-pointer hover:bg-[#2a2a2a]">
                      <div className="text-sm text-zinc-400">{t.title}</div>
                      <div className="text-xs text-zinc-600 mt-1">{timeAgo(t.updated_at)}</div>
                    </div>
                  ))}
                </div>
              )}
              {tasks.length === 0 && (
                <div className="text-center text-zinc-500 py-8">No tasks assigned</div>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {activities.map(a => (
                <div key={a.id} className="flex gap-2 text-xs py-2 border-b border-[#2a2a2a] last:border-0">
                  <span className="text-zinc-400 flex-1">{a.message}</span>
                  <span className="text-zinc-600 shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center text-zinc-500 py-8">No activity yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ taskId, agents, onClose, onRefresh }) {
  const [task, setTask] = useState(null);
  const [comment, setComment] = useState('');
  const [commentBy, setCommentBy] = useState(agents[0]?.id);
  const [editingTime, setEditingTime] = useState(false);
  const [editingTokens, setEditingTokens] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    if (taskId) getTask(taskId).then(setTask);
  }, [taskId]);

  if (!task) return null;

  const handleStatusChange = async (status) => {
    await updateTask(task.id, { status });
    setTask({ ...task, status });
    onRefresh();
  };

  const handleArchive = async () => {
    await fetch(`${API}/api/tasks/${task.id}/archive`, { method: 'POST' });
    onRefresh();
    onClose();
  };

  const handleAddTime = async () => {
    const mins = parseInt(timeInput);
    if (mins > 0) {
      await fetch(`${API}/api/tasks/${task.id}/time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: mins })
      });
      setTask({ ...task, time_spent_minutes: (task.time_spent_minutes || 0) + mins });
      setTimeInput('');
      setEditingTime(false);
      onRefresh();
    }
  };

  const handleAddTokens = async () => {
    const tokens = parseInt(tokenInput);
    if (tokens > 0) {
      await fetch(`${API}/api/tasks/${task.id}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens })
      });
      setTask({ ...task, token_spend: (task.token_spend || 0) + tokens });
      setTokenInput('');
      setEditingTokens(false);
      onRefresh();
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    await addComment(task.id, { agent_id: commentBy, content: comment });
    setComment('');
    getTask(taskId).then(setTask);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500 mb-1">Task #{task.id}</div>
              <h2 className="text-lg font-bold text-white">{task.title}</h2>
              {task.project && <div className="text-sm text-purple-400 mt-1">📁 {task.project}</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleArchive} className="text-zinc-500 hover:text-amber-400 text-sm">📦</button>
              <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {task.tags.map(tag => (
                <span key={tag} className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Status buttons */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {STATUS_COLS.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  task.status === s
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'border-[#444] text-zinc-500 hover:text-zinc-300 hover:border-zinc-400'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {task.description && (
            <div className="text-sm text-zinc-400 mb-4 bg-[#222] rounded-md p-3">{task.description}</div>
          )}

          {/* Time & Tokens tracking */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">⏱ Time:</span>
              <span className="text-sm text-blue-400 font-medium">{formatTime(task.time_spent_minutes)}</span>
              {editingTime ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={timeInput}
                    onChange={e => setTimeInput(e.target.value)}
                    placeholder="mins"
                    className="w-16 bg-[#333] border border-[#444] rounded px-2 py-0.5 text-xs text-white"
                    autoFocus
                  />
                  <button onClick={handleAddTime} className="text-xs text-green-400">✓</button>
                  <button onClick={() => setEditingTime(false)} className="text-xs text-zinc-500">✕</button>
                </div>
              ) : (
                <button onClick={() => setEditingTime(true)} className="text-xs text-zinc-500 hover:text-white">+</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">🪙 Tokens:</span>
              <span className="text-sm text-green-400 font-medium">{formatTokens(task.token_spend)}</span>
              {editingTokens ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="tokens"
                    className="w-20 bg-[#333] border border-[#444] rounded px-2 py-0.5 text-xs text-white"
                    autoFocus
                  />
                  <button onClick={handleAddTokens} className="text-xs text-green-400">✓</button>
                  <button onClick={() => setEditingTokens(false)} className="text-xs text-zinc-500">✕</button>
                </div>
              ) : (
                <button onClick={() => setEditingTokens(true)} className="text-xs text-zinc-500 hover:text-white">+</button>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="text-xs text-zinc-500">Assigned:</span>
            {task.assignees?.map(a => (
              <span key={a.id} className="text-xs bg-[#333] px-2 py-0.5 rounded-full">{a.emoji} {a.name}</span>
            ))}
          </div>

          {/* Comments */}
          <div className="border-t border-[#333] pt-4 mt-4">
            <h3 className="text-sm font-semibold text-zinc-400 mb-3">💬 Comments ({task.comments?.length || 0})</h3>
            <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto">
              {task.comments?.map(c => (
                <div key={c.id} className="bg-[#222] rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{c.emoji}</span>
                    <span className="text-xs font-medium text-zinc-300">{c.agent_name}</span>
                    <span className="text-xs text-zinc-600">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="text-sm text-zinc-400">{c.content}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <select
                value={commentBy}
                onChange={e => setCommentBy(Number(e.target.value))}
                className="bg-[#333] border border-[#444] rounded-md px-2 py-1.5 text-xs text-zinc-300 w-full sm:w-auto"
              >
                {agents.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
              </select>
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-[#222] border border-[#444] rounded-md px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:border-amber-500 focus:outline-none min-w-0"
              />
              <button
                onClick={handleComment}
                className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [view, setView] = useState('board');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const searchRef = useRef(null);

  const refresh = useCallback(() => {
    getAgents().then(setAgents);
    let url = `${API}/api/tasks?archived=${showArchived}`;
    if (filterProject) url += `&project=${encodeURIComponent(filterProject)}`;
    if (filterTag) url += `&tags=${encodeURIComponent(filterTag)}`;
    fetch(url).then(r => r.json()).then(setTasks);
    getActivities().then(setActivities);
    getStats().then(setStats);
    fetch(`${API}/api/projects`).then(r => r.json()).then(setProjects);
    fetch(`${API}/api/tags`).then(r => r.json()).then(setTags);
  }, [showArchived, filterProject, filterTag]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length >= 2) {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&include_archived=true`);
      setSearchResults(await res.json());
    } else {
      setSearchResults(null);
    }
  };

  const handleMoveTask = async (taskId, status) => {
    await fetch(`${API}/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    refresh();
  };

  // Close search on click outside
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <div className="border-b border-[#222] px-4 sm:px-6 py-4 sticky top-0 bg-[#0f0f0f] z-40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xl">🎯</span>
            <h1 className="text-lg font-bold text-white tracking-tight">Mission Control</h1>
            <span className="text-xs text-zinc-600 hidden sm:inline ml-2">Irakli's Agent Squad</span>
          </div>
          
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs" ref={searchRef}>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="🔍 Search tasks..."
              className="w-full bg-[#222] border border-[#333] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            {searchResults && (
              <SearchResults 
                results={searchResults} 
                onTaskClick={setSelectedTask}
                onClose={() => setSearchResults(null)}
              />
            )}
          </div>
          
          <div className="flex gap-2 items-center w-full sm:w-auto justify-between sm:justify-end">
            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={filterProject}
                onChange={e => setFilterProject(e.target.value)}
                className="bg-[#222] border border-[#333] rounded-md px-2 py-1.5 text-xs text-zinc-400"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.project} value={p.project}>📁 {p.project} ({p.task_count})</option>)}
              </select>
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="bg-[#222] border border-[#333] rounded-md px-2 py-1.5 text-xs text-zinc-400"
              >
                <option value="">All Tags</option>
                {tags.map(t => <option key={t.tag} value={t.tag}>🏷 {t.tag} ({t.count})</option>)}
              </select>
            </div>
            
            {/* View toggles */}
            <div className="flex gap-1 bg-[#222] rounded-lg p-0.5">
              <button
                onClick={() => setView('board')}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md transition-colors ${view === 'board' ? 'bg-[#333] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                📋
              </button>
              <button
                onClick={() => setView('feed')}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md transition-colors ${view === 'feed' ? 'bg-[#333] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                📊
              </button>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md transition-colors ${showArchived ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                📦
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AgentCards agents={agents} onAgentClick={setSelectedAgent} />
        <StatsBar stats={stats} />
        <RecurringJobs tasks={tasks} agents={agents} onTaskClick={setSelectedTask} />

        {view === 'board' ? (
          <KanbanBoard tasks={tasks} onTaskClick={setSelectedTask} onMoveTask={handleMoveTask} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActivityFeed activities={activities} />
            <div className="bg-[#222] border border-[#333] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-zinc-400 mb-3">📋 All Tasks</h3>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {tasks.map(t => <TaskCard key={t.id} task={t} onClick={setSelectedTask} onDragStart={()=>{}} onDragEnd={()=>{}} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetail
          taskId={selectedTask}
          agents={agents}
          onClose={() => setSelectedTask(null)}
          onRefresh={refresh}
        />
      )}

      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onTaskClick={setSelectedTask}
        />
      )}
    </div>
  );
}
