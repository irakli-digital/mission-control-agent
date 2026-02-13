import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { API_BASE } from '@/lib/constants';
import { Search, X, ExternalLink, ArrowRight, ArrowLeft, Network } from 'lucide-react';

const AGENT_COLORS = {
  mura: '#3b82f6', main: '#a855f7', baski: '#a855f7', workflows: '#f97316',
  jiji: '#ec4899', doctor: '#10b981', mentor: '#eab308', writer: '#06b6d4',
};
const AGENT_LABELS = {
  mura: 'Mura', main: 'Shared', baski: 'Shared', workflows: 'Workflows',
  jiji: 'Jiji', doctor: 'Doctor', mentor: 'Mentor', writer: 'Writer',
};

function getColor(agent) { return AGENT_COLORS[agent] || '#6b7280'; }
function getAuthHeader() {
  const creds = localStorage.getItem('mc_credentials');
  if (!creds) return {};
  return { Authorization: `Basic ${btoa(creds)}` };
}

function bfs(startId, nodeMap, dir, maxDeg = 5) {
  const visited = new Set([startId]);
  const levels = new Map();
  let queue = [startId];
  let deg = 1;
  while (queue.length > 0 && deg <= maxDeg) {
    const next = [];
    for (const id of queue) {
      const nd = nodeMap.get(id);
      if (!nd) continue;
      const refs = dir === 'out' ? (nd.outRefs || []) : (nd.inRefs || []);
      for (const ref of refs) {
        if (!visited.has(ref) && nodeMap.has(ref)) {
          visited.add(ref);
          next.push(ref);
          if (!levels.has(deg)) levels.set(deg, []);
          levels.get(deg).push(ref);
        }
      }
    }
    queue = next;
    deg++;
  }
  return levels;
}

export function DependencyGraph() {
  const svgRef = useRef();
  const containerRef = useRef();
  const simRef = useRef();
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const [activeAgents, setActiveAgents] = useState(new Set());
  const [filterAgents, setFilterAgents] = useState(null);

  // Fetch
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/workspace/graph`, { headers: getAuthHeader() });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const outgoing = new Map(), incoming = new Map();
        for (const e of data.edges) {
          outgoing.set(e.source, (outgoing.get(e.source) || []).concat(e.target));
          incoming.set(e.target, (incoming.get(e.target) || []).concat(e.source));
        }
        const nodes = data.nodes.map(n => ({
          ...n, connections: (outgoing.get(n.id)?.length || 0) + (incoming.get(n.id)?.length || 0),
          outRefs: outgoing.get(n.id) || [], inRefs: incoming.get(n.id) || [],
        }));
        setActiveAgents(new Set(nodes.map(n => n.agent)));
        setRawData({ nodes, edges: data.edges });
      } catch (err) { console.error('[graph]', err); }
      finally { setLoading(false); }
    })();
  }, []);

  // Filtered data
  const filtered = useMemo(() => {
    if (!rawData) return null;
    let nodes = rawData.nodes;
    if (filterAgents && filterAgents.size > 0) {
      const ids = new Set(nodes.filter(n => filterAgents.has(n.agent)).map(n => n.id));
      nodes = nodes.filter(n => filterAgents.has(n.agent));
      return { nodes, edges: rawData.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
    }
    return rawData;
  }, [rawData, filterAgents]);

  const nodeMap = useMemo(() => {
    if (!rawData) return new Map();
    const m = new Map();
    for (const n of rawData.nodes) m.set(n.id, n);
    return m;
  }, [rawData]);

  // D3 force simulation
  useEffect(() => {
    if (!filtered || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoomBehavior);

    // Arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 12).attr('refY', 0)
      .attr('markerWidth', 4).attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', 'rgba(255,255,255,0.2)');

    const nodes = filtered.nodes.map(n => ({ ...n }));
    const links = filtered.edges.map(e => ({ source: e.source, target: e.target }));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(40))
      .force('charge', d3.forceManyBody().strength(-60).distanceMax(250))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.8))
      .force('collision', d3.forceCollide().radius(d => 5 + Math.sqrt(d.connections) * 2));

    simRef.current = sim;

    // Links
    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 0.5)
      .attr('marker-end', 'url(#arrow)');

    // Nodes
    const node = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', d => 3 + Math.sqrt(d.connections) * 2)
      .attr('fill', d => getColor(d.agent))
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .attr('opacity', 0.85)
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Labels (only for high-connection nodes)
    const label = g.append('g').selectAll('text').data(nodes.filter(d => d.connections >= 3)).join('text')
      .text(d => d.name)
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-size', '8px')
      .attr('text-anchor', 'middle')
      .attr('dy', d => (3 + Math.sqrt(d.connections) * 2) + 10)
      .attr('pointer-events', 'none');

    // Hover
    node.on('mouseover', function (event, d) {
      d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1.5);
      // Show tooltip
      tooltip.style('display', 'block')
        .html(`<strong>${d.name}</strong><br/>${d.path.replace(/^\/Users\/[^/]+\//, '~/')}<br/>${d.connections} connections`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    }).on('mouseout', function () {
      d3.select(this).attr('opacity', 0.85).attr('stroke', 'none');
      tooltip.style('display', 'none');
    });

    // Click
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(prev => prev?.id === d.id ? null : d);

      // Highlight connected chain
      const connected = new Set([d.id]);
      const q = [d.id];
      while (q.length > 0) {
        const cur = q.shift();
        const nd = nodeMap.get(cur);
        if (!nd) continue;
        for (const ref of [...(nd.outRefs || []), ...(nd.inRefs || [])]) {
          if (!connected.has(ref)) { connected.add(ref); q.push(ref); }
        }
      }

      node.attr('opacity', n => connected.has(n.id) ? 1 : 0.1);
      link.attr('stroke', l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        return connected.has(sid) && connected.has(tid) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.02)';
      }).attr('stroke-width', l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        return connected.has(sid) && connected.has(tid) ? 1.5 : 0.3;
      });
      label.attr('fill', n => connected.has(n.id) ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)');
    });

    // Click background to reset
    svg.on('click', () => {
      setSelectedNode(null);
      node.attr('opacity', 0.85);
      link.attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-width', 0.5);
      label.attr('fill', 'rgba(255,255,255,0.6)');
    });

    // Tooltip div
    let tooltip = d3.select(container).select('.graph-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select(container).append('div').attr('class', 'graph-tooltip')
        .style('position', 'absolute').style('display', 'none')
        .style('background', 'rgba(24,24,27,0.95)').style('border', '1px solid rgba(63,63,70,0.5)')
        .style('padding', '6px 10px').style('border-radius', '6px')
        .style('font-size', '11px').style('color', '#d4d4d8')
        .style('pointer-events', 'none').style('z-index', '20')
        .style('max-width', '300px').style('line-height', '1.4');
    }

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('cx', d => d.x).attr('cy', d => d.y);
      label.attr('x', d => d.x).attr('y', d => d.y);
    });

    // Fit to view after stabilization
    sim.on('end', () => {
      const bounds = g.node().getBBox();
      const scale = Math.min(width / (bounds.width + 80), height / (bounds.height + 80), 2);
      const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
      const ty = height / 2 - (bounds.y + bounds.height / 2) * scale;
      svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => { sim.stop(); tooltip.remove(); };
  }, [filtered, nodeMap]);

  // Search zoom
  useEffect(() => {
    if (!search || !filtered) return;
    const q = search.toLowerCase();
    const match = filtered.nodes.find(n => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q));
    if (match && svgRef.current) {
      setSelectedNode(match);
    }
  }, [search, filtered]);

  const toggleAgent = useCallback((agent) => {
    setFilterAgents(prev => {
      const next = new Set(prev || activeAgents);
      if (next.has(agent)) next.delete(agent); else next.add(agent);
      if (next.size === activeAgents.size || next.size === 0) return null;
      return next;
    });
  }, [activeAgents]);

  const stats = useMemo(() => ({
    files: filtered?.nodes.length || 0,
    connections: filtered?.edges.length || 0,
  }), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-muted-foreground flex items-center gap-2">
          <Network className="w-5 h-5 animate-pulse" /> Loading dependency graph...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      <div className="flex-1 relative" ref={containerRef} style={{ overflow: 'hidden' }}>
        {/* Controls */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-xs rounded-md bg-zinc-800/90 border border-zinc-700 text-zinc-200 placeholder:text-zinc-500 w-52 focus:outline-none focus:ring-1 focus:ring-zinc-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-zinc-500" /></button>}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[...activeAgents].sort().map(agent => {
              const isActive = !filterAgents || filterAgents.has(agent);
              return (
                <button key={agent} onClick={() => toggleAgent(agent)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                  style={{ backgroundColor: isActive ? getColor(agent) + '25' : 'rgba(63,63,70,0.5)', color: isActive ? getColor(agent) : '#71717a', borderWidth: 1, borderColor: isActive ? getColor(agent) + '50' : 'transparent' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? getColor(agent) : '#52525b' }} />
                  {AGENT_LABELS[agent] || agent}
                </button>
              );
            })}
          </div>
          <div className="ml-auto text-[11px] text-zinc-500 bg-zinc-800/80 px-2.5 py-1 rounded-md">
            {stats.files} files · {stats.connections} connections
          </div>
        </div>

        <svg ref={svgRef} style={{ width: '100%', height: '100%', background: '#09090b' }} />
      </div>

      {/* Sidebar */}
      {selectedNode && (
        <div className="w-80 border-l border-zinc-800 bg-zinc-900/95 overflow-y-auto shrink-0">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{selectedNode.name}</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5 break-all">{selectedNode.path.replace(/^\/Users\/[^/]+\//, '~/')}</p>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: getColor(selectedNode.agent) + '20', color: getColor(selectedNode.agent) }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getColor(selectedNode.agent) }} />
                {AGENT_LABELS[selectedNode.agent] || selectedNode.agent}
              </span>
              <span className="text-[11px] text-zinc-500">{(selectedNode.size / 1024).toFixed(1)} KB</span>
              <span className="text-[11px] text-zinc-500">{selectedNode.connections} connections</span>
            </div>

            <a href={`/workspaces?path=${encodeURIComponent(selectedNode.path)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors mb-4">
              <ExternalLink className="w-3 h-3" /> View File
            </a>

            {/* Dependency chain */}
            {[
              { chain: bfs(selectedNode.id, nodeMap, 'out'), label: 'References', Icon: ArrowRight },
              { chain: bfs(selectedNode.id, nodeMap, 'in'), label: 'Referenced by', Icon: ArrowLeft },
            ].map(({ chain, label, Icon }) => chain.size > 0 && (
              <div key={label} className="mb-4">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Icon className="w-3 h-3" /> {label}
                </h4>
                {[...chain.entries()].map(([degree, ids]) => (
                  <div key={degree} className="mb-2">
                    <div className="text-[10px] text-zinc-500 mb-1 ml-1">
                      {degree === 1 ? 'Direct' : `${degree}° link`} ({ids.length})
                    </div>
                    <div className="space-y-0.5" style={{ paddingLeft: Math.min(degree - 1, 3) * 8 }}>
                      {ids.map(id => {
                        const n = nodeMap.get(id);
                        if (!n) return null;
                        return (
                          <button key={id} onClick={() => setSelectedNode(n)}
                            className="w-full text-left px-2 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getColor(n.agent) }} />
                            <span className="truncate">{n.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
