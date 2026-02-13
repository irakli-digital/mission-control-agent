import { useRef, useEffect, useState } from 'react';
import { Search, LayoutGrid, Activity, Archive, FolderOpen, Tag, Target, Menu, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Header({
  search,
  onSearchChange,
  searchResults,
  onSearchResultClick,
  onClearSearch,
  projects,
  tags,
  filterProject,
  onFilterProjectChange,
  filterTag,
  onFilterTagChange,
  view,
  onViewChange,
  showArchived,
  onShowArchivedChange,
}) {
  const searchRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        onClearSearch?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClearSearch]);

  return (
    <header className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 sticky top-0 bg-background z-40">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">Mission Control</h1>
            <span className="text-xs text-muted-foreground hidden md:block">Irakli's Agent Squad</span>
          </div>
        </div>

        {/* Search - always visible */}
        <div className="relative flex-1 max-w-xs" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="pl-9 h-8 sm:h-9 text-sm"
          />
          {searchResults && <SearchResults results={searchResults} onTaskClick={onSearchResultClick} onClose={onClearSearch} />}
        </div>

        {/* Desktop controls */}
        <div className="hidden sm:flex gap-2 items-center">
          <Select value={filterProject || 'all'} onValueChange={(v) => onFilterProjectChange(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[130px] h-9">
              <FolderOpen className="w-4 h-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.project} value={p.project}>{p.project} ({p.task_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTag || 'all'} onValueChange={(v) => onFilterTagChange(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[120px] h-9">
              <Tag className="w-4 h-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags?.map((t) => (
                <SelectItem key={t.tag} value={t.tag}>{t.tag} ({t.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onViewChange('board')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={view === 'feed' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onViewChange('feed')}>
              <Activity className="w-4 h-4" />
            </Button>
            <Button
              variant={showArchived ? 'default' : 'ghost'}
              size="icon"
              className={cn('h-8 w-8', showArchived && 'bg-primary text-primary-foreground')}
              onClick={() => onShowArchivedChange(!showArchived)}
            >
              <Archive className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden mt-3 pt-3 border-t border-border space-y-3 animate-fade-in">
          <div className="flex gap-2">
            <Select value={filterProject || 'all'} onValueChange={(v) => { onFilterProjectChange(v === 'all' ? '' : v); }}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <FolderOpen className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.project} value={p.project}>{p.project}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTag || 'all'} onValueChange={(v) => { onFilterTagChange(v === 'all' ? '' : v); }}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <Tag className="w-3.5 h-3.5 mr-1" />
                <SelectValue placeholder="Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags?.map((t) => (
                  <SelectItem key={t.tag} value={t.tag}>{t.tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { onViewChange('board'); setMobileMenuOpen(false); }}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button variant={view === 'feed' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { onViewChange('feed'); setMobileMenuOpen(false); }}>
              <Activity className="w-3.5 h-3.5" />
            </Button>
            <Button variant={showArchived ? 'default' : 'ghost'} size="icon" className={cn('h-7 w-7', showArchived && 'bg-primary text-primary-foreground')} onClick={() => onShowArchivedChange(!showArchived)}>
              <Archive className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function SearchResults({ results, onTaskClick, onClose }) {
  if (!results?.length) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg p-4 z-50 shadow-lg">
        <div className="text-sm text-muted-foreground">No results found</div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg overflow-hidden z-50 shadow-lg max-h-[300px] overflow-y-auto">
      {results.map((t) => {
        const priorityConfig = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.normal;
        return (
          <div
            key={t.id}
            onClick={() => { onTaskClick(t.id); onClose?.(); }}
            className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-0 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityConfig.dotColor)} />
              <span className="text-sm text-foreground flex-1 truncate">{t.title}</span>
              <Badge variant={t.archived ? 'secondary' : 'outline'} className="text-xs shrink-0">
                {t.archived ? 'archived' : t.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
