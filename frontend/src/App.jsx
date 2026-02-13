import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';

// Auth
import { hasCredentials, clearCredentials } from '@/hooks/useApi';
import { LoginPage } from '@/components/auth';

// Hooks
import { useAgents } from '@/hooks/useAgents';
import { useTasks, useTaskSearch } from '@/hooks/useTasks';
import { useActivities } from '@/hooks/useActivities';
import { useStats, useProjects, useTags } from '@/hooks/useStats';
import { useContent } from '@/hooks/useContent';
import { useWebSocket } from '@/hooks/useWebSocket';

// Components
import { Header } from '@/components/layout';
import { AgentGrid, AgentDetailModal } from '@/components/agents';
import { KanbanBoard, RecurringJobs, TaskDetailModal, TaskCard, TaskCreateModal } from '@/components/tasks';
import { ActivityFeed } from '@/components/activity';
import { StatsBar } from '@/components/stats';
import { ContentKanbanBoard, ContentEditModal } from '@/components/content';
import { WorkspaceBrowser } from '@/components/workspaces/WorkspaceBrowser';
const DependencyGraph = lazy(() => import('@/components/graph/DependencyGraph').then(m => ({ default: m.DependencyGraph })));
import { AgentConfigBoard } from '@/components/agent-config';
import { BulkActionsBar } from '@/components/tasks/BulkActionsBar';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Video, ListTodo, FolderOpen, Network, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials());
  const navigate = useNavigate();
  const location = useLocation();

  // Listen for auth-required events
  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener('mc:auth-required', handler);
    return () => window.removeEventListener('mc:auth-required', handler);
  }, []);

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const mainTab = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/content')) return 'content';
    if (path.startsWith('/workspaces')) return 'workspaces';
    if (path.startsWith('/graph')) return 'graph';
    if (path.startsWith('/agent-config')) return 'agent-config';
    return 'tasks';
  }, [location.pathname]);

  const setMainTab = useCallback((tab) => {
    if (tab === 'tasks') navigate('/tasks');
    else if (tab === 'content') navigate('/content');
    else if (tab === 'workspaces') navigate('/workspaces');
    else if (tab === 'graph') navigate('/graph');
    else if (tab === 'agent-config') navigate('/agent-config');
  }, [navigate]);

  // UI State
  const [view, setView] = useState('board');
  const [showArchived, setShowArchived] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const [showNewContentModal, setShowNewContentModal] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState(null);
  const [filterAgent, setFilterAgent] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  // Data hooks
  const { agents, loading: agentsLoading, refresh: refreshAgents } = useAgents();
  const { tasks, loading: tasksLoading, refresh: refreshTasks, moveTask, bulkArchive, bulkMove, bulkAssign } = useTasks({
    showArchived,
    filterProject,
    filterTag,
  });
  const { activities, loading: activitiesLoading, refresh: refreshActivities } = useActivities();
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const { projects } = useProjects();
  const { tags } = useTags();
  const { results: searchResults, search, clearResults: clearSearchResults } = useTaskSearch();
  const {
    content,
    loading: contentLoading,
    moveContent,
    createContent,
    updateContent,
    deleteContent,
    refresh: refreshContent,
  } = useContent();

  // WebSocket — auto-refresh on events
  useWebSocket(useCallback((event) => {
    if (event.startsWith('task:')) {
      refreshTasks();
      refreshStats();
      refreshActivities();
    } else if (event.startsWith('content:')) {
      refreshContent();
    }
  }, [refreshTasks, refreshStats, refreshActivities, refreshContent]));

  // Handlers
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    search(query);
  }, [search]);

  const handleSearchResultClick = useCallback((taskId) => {
    setSelectedTask(taskId);
    setSearchQuery('');
    clearSearchResults();
  }, [clearSearchResults]);

  const handleMoveTask = useCallback(async (taskId, status) => {
    await moveTask(taskId, status);
  }, [moveTask]);

  const handleRefresh = useCallback(() => { refreshTasks(); }, [refreshTasks]);

  const handleMoveContent = useCallback(async (contentId, status) => {
    await moveContent(contentId, status);
  }, [moveContent]);

  const handleSaveContent = useCallback(async (data) => {
    if (selectedContent) {
      await updateContent(selectedContent.id, data);
    } else {
      await createContent(data);
    }
  }, [selectedContent, updateContent, createContent]);

  const handleDeleteContent = useCallback(async () => {
    if (selectedContent) {
      await deleteContent(selectedContent.id);
      setSelectedContent(null);
    }
  }, [selectedContent, deleteContent]);

  // Bulk operations
  const handleToggleSelect = useCallback((taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((taskIds) => {
    setSelectedTaskIds((prev) => {
      const allSelected = taskIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        taskIds.forEach((id) => next.delete(id));
      } else {
        taskIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(async () => {
    await bulkArchive([...selectedTaskIds]);
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, bulkArchive]);

  const handleBulkMove = useCallback(async (status) => {
    await bulkMove([...selectedTaskIds], status);
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, bulkMove]);

  const handleBulkAssign = useCallback(async (agentId) => {
    await bulkAssign([...selectedTaskIds], agentId);
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, bulkAssign]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        search={searchQuery}
        onSearchChange={handleSearch}
        searchResults={searchResults}
        onSearchResultClick={handleSearchResultClick}
        onClearSearch={clearSearchResults}
        projects={projects}
        tags={tags}
        filterProject={filterProject}
        onFilterProjectChange={setFilterProject}
        filterTag={filterTag}
        onFilterTagChange={setFilterTag}
        view={view}
        onViewChange={setView}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Main Tab Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="bg-muted">
              <TabsTrigger value="tasks" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <ListTodo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Tasks</span>
                <span className="sm:hidden">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Content Calendar</span>
                <span className="sm:hidden">Content</span>
              </TabsTrigger>
              <TabsTrigger value="workspaces" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Workspaces</span>
                <span className="sm:hidden">Files</span>
              </TabsTrigger>
              <TabsTrigger value="graph" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Graph</span>
                <span className="sm:hidden">Graph</span>
              </TabsTrigger>
              <TabsTrigger value="agent-config" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Agent Config</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mainTab === 'tasks' && (
            <Button size="sm" onClick={() => { setNewTaskDefaultStatus(null); setShowNewTaskModal(true); }} className="gap-1">
              <Plus className="w-4 h-4" /> New Task
            </Button>
          )}
          {mainTab === 'content' && (
            <Button size="sm" onClick={() => setShowNewContentModal(true)} className="gap-1">
              <Plus className="w-4 h-4" /> New Idea
            </Button>
          )}
        </div>

        {/* Tasks View */}
        {mainTab === 'tasks' && (
          <>
            {/* Compact Agent Strip */}
            {!agentsLoading && agents?.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 px-1">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setFilterAgent(filterAgent === agent.id ? null : agent.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                      filterAgent === agent.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    <span>{agent.emoji}</span>
                    <span>{agent.name}</span>
                    {agent.active_tasks > 0 && (
                      <span className={cn(
                        'px-1.5 py-0 rounded-full text-[10px]',
                        filterAgent === agent.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/20 text-primary'
                      )}>
                        {agent.active_tasks}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <StatsBar stats={stats} loading={statsLoading} filterStatus={filterStatus} onFilterStatus={setFilterStatus} />
            <RecurringJobs tasks={tasks} agents={agents} onTaskClick={setSelectedTask} />

            {/* Bulk Actions Bar */}
            {selectedTaskIds.size > 0 && (
              <BulkActionsBar
                count={selectedTaskIds.size}
                agents={agents}
                onArchive={handleBulkArchive}
                onMove={handleBulkMove}
                onAssign={handleBulkAssign}
                onClear={() => setSelectedTaskIds(new Set())}
              />
            )}

            {view === 'board' ? (
              <KanbanBoard
                tasks={tasks.filter((t) => {
                  if (filterAgent && !t.assignees?.some((a) => a.id === filterAgent)) return false;
                  if (filterStatus && t.status !== filterStatus) return false;
                  return true;
                })}
                loading={tasksLoading}
                onTaskClick={setSelectedTask}
                onMoveTask={handleMoveTask}
                selectedTaskIds={selectedTaskIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onAddTask={(status) => { setNewTaskDefaultStatus(status); setShowNewTaskModal(true); }}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ActivityFeed activities={activities} loading={activitiesLoading} />
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Tasks</h3>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-4">
                      {tasks.map((t) => (
                        <TaskCard key={t.id} task={t} onClick={setSelectedTask} />
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            )}
          </>
        )}

        {mainTab === 'content' && (
          <ContentKanbanBoard
            content={content}
            loading={contentLoading}
            onItemClick={setSelectedContent}
            onMoveContent={handleMoveContent}
          />
        )}

        {mainTab === 'workspaces' && <WorkspaceBrowser />}

        {mainTab === 'graph' && <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading graph...</div>}><DependencyGraph /></Suspense>}

        {mainTab === 'agent-config' && <AgentConfigBoard />}
      </main>

      <TaskDetailModal
        taskId={selectedTask}
        agents={agents}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={handleRefresh}
      />

      <AgentDetailModal
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
        onTaskClick={setSelectedTask}
      />

      <ContentEditModal
        item={selectedContent}
        open={!!selectedContent}
        onOpenChange={(open) => !open && setSelectedContent(null)}
        onSave={handleSaveContent}
        onDelete={handleDeleteContent}
      />

      <ContentEditModal
        item={null}
        open={showNewContentModal}
        onOpenChange={setShowNewContentModal}
        onSave={handleSaveContent}
        onDelete={() => {}}
        isNew
      />

      <TaskCreateModal
        open={showNewTaskModal}
        onOpenChange={setShowNewTaskModal}
        agents={agents}
        onCreated={handleRefresh}
        defaultStatus={newTaskDefaultStatus}
      />
    </div>
  );
}
