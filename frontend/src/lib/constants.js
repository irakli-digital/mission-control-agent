import {
  Inbox,
  ClipboardList,
  RefreshCw,
  Eye,
  CheckCircle2,
  Ban,
  Clock,
  Coins,
  MessageSquare,
  Calendar,
  FolderOpen,
  Tag,
  Search,
  LayoutGrid,
  Activity,
  Archive,
  Target,
  Bell,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  Check,
  MoreHorizontal,
  User,
  Settings,
  Repeat,
  AlertCircle,
  Zap,
  Circle,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

// Status configuration
export const STATUS_CONFIG = {
  inbox: {
    label: 'Inbox',
    icon: Inbox,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
  },
  assigned: {
    label: 'Assigned',
    icon: ClipboardList,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  in_progress: {
    label: 'In Progress',
    icon: RefreshCw,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  review: {
    label: 'Review',
    icon: Eye,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  done: {
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  blocked: {
    label: 'Blocked',
    icon: Ban,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
};

export const STATUS_COLS = ['inbox', 'assigned', 'in_progress', 'review', 'done'];

// Priority configuration
export const PRIORITY_CONFIG = {
  urgent: {
    label: 'Urgent',
    icon: Zap,
    color: 'text-red-400',
    bgColor: 'bg-red-500',
    dotColor: 'bg-red-500',
  },
  high: {
    label: 'High',
    icon: ArrowUpCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
    dotColor: 'bg-orange-500',
  },
  normal: {
    label: 'Normal',
    icon: Circle,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-600',
    dotColor: 'bg-zinc-600',
  },
  low: {
    label: 'Low',
    icon: ArrowDownCircle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500',
    dotColor: 'bg-blue-500',
  },
};

// Agent status configuration
export const AGENT_STATUS_CONFIG = {
  idle: {
    label: 'Idle',
    color: 'bg-zinc-500',
    textColor: 'text-zinc-400',
  },
  active: {
    label: 'Active',
    color: 'bg-green-500',
    textColor: 'text-green-400',
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-red-500',
    textColor: 'text-red-400',
  },
};

// Icon mappings for common UI elements
export const ICONS = {
  // Navigation & Actions
  search: Search,
  grid: LayoutGrid,
  activity: Activity,
  archive: Archive,
  settings: Settings,
  close: X,
  plus: Plus,
  check: Check,
  more: MoreHorizontal,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,

  // Task related
  clock: Clock,
  coins: Coins,
  comment: MessageSquare,
  calendar: Calendar,
  folder: FolderOpen,
  tag: Tag,
  repeat: Repeat,
  alert: AlertCircle,

  // Agent related
  user: User,
  bell: Bell,
  target: Target,
};

// API base URL
export const API_BASE = import.meta.env.VITE_API_URL || '';

// Polling interval for data refresh (in ms)
export const REFRESH_INTERVAL = 10000;
