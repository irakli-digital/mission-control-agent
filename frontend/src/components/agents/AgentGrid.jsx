import { AgentCard } from './AgentCard';
import { LoadingState } from '@/components/common';

export function AgentGrid({ agents, loading, onAgentClick }) {
  if (loading) {
    return <LoadingState type="card" count={3} />;
  }

  if (!agents?.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} onClick={onAgentClick} />
      ))}
    </div>
  );
}
