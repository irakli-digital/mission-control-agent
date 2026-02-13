import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Archive, ArrowRight, UserPlus, X } from 'lucide-react';
import { STATUS_COLS } from '@/lib/constants';

export function BulkActionsBar({ count, agents, onArchive, onMove, onAssign, onClear }) {
  return (
    <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex flex-wrap items-center gap-2 sm:gap-3 animate-fade-in">
      <span className="text-sm font-medium text-primary">{count} selected</span>

      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onArchive}>
        <Archive className="w-3.5 h-3.5" /> Archive
      </Button>

      <Select onValueChange={onMove}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <ArrowRight className="w-3.5 h-3.5 mr-1" />
          <SelectValue placeholder="Move to..." />
        </SelectTrigger>
        <SelectContent>
          {STATUS_COLS.map((s) => (
            <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => onAssign(parseInt(v))}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <UserPlus className="w-3.5 h-3.5 mr-1" />
          <SelectValue placeholder="Assign to..." />
        </SelectTrigger>
        <SelectContent>
          {agents?.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>{a.emoji} {a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
