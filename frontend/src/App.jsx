import { useState, useCallback } from 'react';

// Hooks
import { useAgents } from '@/hooks/useAgents';
import { useTasks, useTaskSearch } from '@/hooks/useTasks';
import { useActivities } from '@/hooks/useActivities';
import { useStats, useProjects, useTags } from '@/hooks/useStats';

// Components
import { Header } from '@/components/layout';
import { AgentGrid, AgentDetailModal } from '@/components/agents';
import { KanbanBoard, RecurringJobs, TaskDetailModal, TaskCard } from '@/components/tasks';
import { ActivityFeed } from '@/components/activity';
import { StatsBar } from '@/components/stats';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function App() {
  // UI State
  const [view, setView] = useState('board');
  const [showArchived, setShowArchived] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Data hooks
  const { agents, loading: agentsLoading } = useAgents();
  const { tasks, loading: tasksLoading, refresh: refreshTasks, moveTask } = useTasks({
    showArchived,
    filterProject,
    filterTag,
  });
  const { activities, loading: activitiesLoading } = useActivities();
  const { stats, loading: statsLoading } = useStats();
  const { projects } = useProjects();
  const { tags } = useTags();
  const { results: searchResults, search, clearResults: clearSearchResults } = useTaskSearch();

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

  const handleRefresh = useCallback(() => {
    refreshTasks();
  }, [refreshTasks]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with search and filters */}
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Agent Cards */}
        <AgentGrid
          agents={agents}
          loading={agentsLoading}
          onAgentClick={setSelectedAgent}
        />

        {/* Stats Bar */}
        <StatsBar stats={stats} loading={statsLoading} />

        {/* Recurring Jobs */}
        <RecurringJobs
          tasks={tasks}
          agents={agents}
          onTaskClick={setSelectedTask}
        />

        {/* Main View */}
        {view === 'board' ? (
          <KanbanBoard
            tasks={tasks}
            loading={tasksLoading}
            onTaskClick={setSelectedTask}
            onMoveTask={handleMoveTask}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActivityFeed activities={activities} loading={activitiesLoading} />
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">All Tasks</h3>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {tasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onClick={setSelectedTask}
                    />
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </main>

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTask}
        agents={agents}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onRefresh={handleRefresh}
      />

      {/* Agent Detail Modal */}
      <AgentDetailModal
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
        onTaskClick={setSelectedTask}
      />
    </div>
  );
}
