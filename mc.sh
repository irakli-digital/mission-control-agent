#!/bin/bash
# Mission Control CLI - Task management for AI agents
# Usage: mc <command> [args...]

set -e

API_URL="${MC_API_URL:-http://localhost:3847/api}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

function print_header() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}       ${MAGENTA}🎯 Mission Control - Agent Task Manager${NC}         ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
}

function print_usage() {
    print_header
    cat << EOF

USAGE:
    mc <command> [options]

COMMANDS:
    ${GREEN}status${NC}
        Show system status (agents, active tasks, notifications)

    ${GREEN}agents${NC}
        List all agents with task counts

    ${GREEN}tasks${NC} [--status STATUS] [--agent NAME] [--limit N]
        List tasks (default: all statuses, limit 20)
        Statuses: inbox, assigned, in_progress, blocked, done, cancelled

    ${GREEN}show${NC} <task_id>
        Show task details (assignees, comments, documents)

    ${GREEN}create${NC} <title> [--desc TEXT] [--priority LEVEL] [--assign AGENT_ID,...]
        Create new task
        Priority: urgent, high, normal, low (default: normal)

    ${GREEN}assign${NC} <task_id> <agent_id>
        Assign task to agent

    ${GREEN}start${NC} <task_id>
        Start working on task (changes status to in_progress)

    ${GREEN}block${NC} <task_id> <reason>
        Mark task as blocked with reason

    ${GREEN}done${NC} <task_id>
        Mark task as complete

    ${GREEN}comment${NC} <task_id> <text> [--agent AGENT_ID]
        Add comment to task

    ${GREEN}watch${NC} [--interval SECONDS]
        Watch mode: auto-refresh task list (default: 10s)

    ${GREEN}mine${NC} [AGENT_NAME]
        Show my tasks (or specific agent's tasks)

    ${GREEN}inbox${NC}
        Show unassigned tasks

    ${GREEN}active${NC}
        Show all in-progress tasks

    ${GREEN}notify${NC} <agent_id> <message>
        Send notification to agent

    ${GREEN}help${NC}
        Show this help

EXAMPLES:
    # Check status
    mc status

    # List my tasks
    mc mine Jiji

    # Create and assign task
    mc create "Build thumbnail generator" --priority high --assign 1

    # Start working
    mc start 5

    # Add progress comment
    mc comment 5 "Face extraction done, working on composite"

    # Mark done
    mc done 5

    # Watch active tasks
    mc watch --interval 5

AGENT IDS:
    1 = Mura (Builder)
    2 = Jiji (Personal Assistant)
    3 = Baski (Research)

ENVIRONMENT:
    MC_API_URL    API base URL (default: http://localhost:3847/api)

EOF
}

function api_get() {
    local endpoint="$1"
    curl -s "${API_URL}${endpoint}"
}

function api_post() {
    local endpoint="$1"
    local data="$2"
    curl -s -X POST "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data"
}

function api_patch() {
    local endpoint="$1"
    local data="$2"
    curl -s -X PATCH "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data"
}

function format_priority() {
    case "$1" in
        urgent)   echo -e "${RED}🔥 URGENT${NC}" ;;
        high)     echo -e "${YELLOW}⬆️  HIGH${NC}" ;;
        normal)   echo -e "${BLUE}➡️  NORMAL${NC}" ;;
        low)      echo -e "${CYAN}⬇️  LOW${NC}" ;;
        *)        echo "$1" ;;
    esac
}

function format_status() {
    case "$1" in
        inbox)        echo -e "${CYAN}📥 Inbox${NC}" ;;
        assigned)     echo -e "${BLUE}📌 Assigned${NC}" ;;
        in_progress)  echo -e "${YELLOW}⚙️  In Progress${NC}" ;;
        blocked)      echo -e "${RED}🚫 Blocked${NC}" ;;
        done)         echo -e "${GREEN}✅ Done${NC}" ;;
        cancelled)    echo -e "${MAGENTA}❌ Cancelled${NC}" ;;
        *)            echo "$1" ;;
    esac
}

function cmd_status() {
    print_header
    
    echo -e "\n${CYAN}═══ Agents ═══${NC}"
    agents=$(api_get "/agents")
    echo "$agents" | jq -r '.[] | "\(.emoji) \(.name) - \(.role)\n   Active: \(.active_tasks) | Total: \(.total_tasks) | Unread: \(.unread)"' | sed 's/^/  /'
    
    echo -e "\n${CYAN}═══ Active Tasks ═══${NC}"
    active=$(api_get "/tasks?status=in_progress")
    count=$(echo "$active" | jq '. | length')
    if [ "$count" -eq 0 ]; then
        echo "  (none)"
    else
        echo "$active" | jq -r '.[] | "  #\(.id) - \(.title) [\(.assignees | map(.name) | join(", "))]"'
    fi
    
    echo -e "\n${CYAN}═══ Inbox ═══${NC}"
    inbox=$(api_get "/tasks?status=inbox")
    count=$(echo "$inbox" | jq '. | length')
    if [ "$count" -eq 0 ]; then
        echo "  (none)"
    else
        echo "$inbox" | jq -r '.[] | "  #\(.id) - \(.title)"'
    fi
    
    echo ""
}

function cmd_agents() {
    agents=$(api_get "/agents")
    
    echo -e "${CYAN}Agents:${NC}"
    echo "$agents" | jq -r '.[] | "  \(.emoji) \(.name) (\(.role))\n     Status: \(.status) | Active: \(.active_tasks) | Total: \(.total_tasks) | Unread: \(.unread)"'
}

function cmd_tasks() {
    local status=""
    local agent=""
    local limit=20
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --status)
                status="$2"
                shift 2
                ;;
            --agent)
                agent="$2"
                shift 2
                ;;
            --limit)
                limit="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Build query
    query="limit=$limit"
    [ -n "$status" ] && query="${query}&status=${status}"
    [ -n "$agent" ] && query="${query}&agent=${agent}"
    
    tasks=$(api_get "/tasks?${query}")
    count=$(echo "$tasks" | jq '. | length')
    
    echo -e "${CYAN}Tasks ($count):${NC}\n"
    
    if [ "$count" -eq 0 ]; then
        echo "  (no tasks)"
        return
    fi
    
    echo "$tasks" | jq -r '.[] | 
        "  #\(.id) - \(.title)\n" +
        "     Priority: \(.priority) | Status: \(.status)\n" +
        "     Assigned: \(if .assignees then [.assignees[].name] | join(", ") else "(none)" end)\n" +
        "     Comments: \(.comment_count) | Created: \(.created_at[:10])"
    '
}

function cmd_show() {
    if [ $# -lt 1 ]; then
        echo -e "${RED}Usage: mc show <task_id>${NC}"
        exit 1
    fi
    
    task_id="$1"
    task=$(api_get "/tasks/${task_id}")
    
    if echo "$task" | jq -e '.error' > /dev/null; then
        echo -e "${RED}❌ Task not found: $task_id${NC}"
        exit 1
    fi
    
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  Task #$task_id"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}\n"
    
    title=$(echo "$task" | jq -r '.title')
    desc=$(echo "$task" | jq -r '.description // "(no description)"')
    priority=$(echo "$task" | jq -r '.priority')
    status=$(echo "$task" | jq -r '.status')
    created=$(echo "$task" | jq -r '.created_at[:19]')
    
    echo -e "${BLUE}Title:${NC} $title"
    echo -e "${BLUE}Description:${NC} $desc"
    echo -e "${BLUE}Priority:${NC} $(format_priority $priority)"
    echo -e "${BLUE}Status:${NC} $(format_status $status)"
    echo -e "${BLUE}Created:${NC} $created"
    
    # Assignees
    assignees=$(echo "$task" | jq -r '[.assignees[].name] | join(", ") // "(none)"')
    echo -e "${BLUE}Assigned to:${NC} $assignees"
    
    # Comments
    comments=$(echo "$task" | jq '.comments | length')
    if [ "$comments" -gt 0 ]; then
        echo -e "\n${CYAN}Comments ($comments):${NC}"
        echo "$task" | jq -r '.comments[] | "  [\(.created_at[:16])] \(.emoji) \(.agent_name): \(.content)"'
    fi
    
    # Documents
    docs=$(echo "$task" | jq '.documents | length')
    if [ "$docs" -gt 0 ]; then
        echo -e "\n${CYAN}Documents ($docs):${NC}"
        echo "$task" | jq -r '.documents[] | "  📄 \(.title) - \(.path)\n     \(.description // "")"'
    fi
    
    echo ""
}

function cmd_create() {
    if [ $# -lt 1 ]; then
        echo -e "${RED}Usage: mc create <title> [--desc TEXT] [--priority LEVEL] [--assign IDS]${NC}"
        exit 1
    fi
    
    title="$1"
    shift
    
    local desc=""
    local priority="normal"
    local assignees=""
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --desc)
                desc="$2"
                shift 2
                ;;
            --priority)
                priority="$2"
                shift 2
                ;;
            --assign)
                assignees="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Build JSON
    json=$(jq -n \
        --arg title "$title" \
        --arg desc "$desc" \
        --arg priority "$priority" \
        '{title: $title, description: $desc, priority: $priority}')
    
    if [ -n "$assignees" ]; then
        IFS=',' read -ra AGENT_IDS <<< "$assignees"
        json=$(echo "$json" | jq --argjson ids "$(printf '%s\n' "${AGENT_IDS[@]}" | jq -R . | jq -s 'map(tonumber)')" '. + {assignees: $ids}')
    fi
    
    result=$(api_post "/tasks" "$json")
    task_id=$(echo "$result" | jq -r '.id')
    
    echo -e "${GREEN}✅ Created task #$task_id${NC}"
    echo "   Title: $title"
    echo "   Priority: $priority"
    [ -n "$assignees" ] && echo "   Assigned to: $assignees"
}

function cmd_assign() {
    if [ $# -lt 2 ]; then
        echo -e "${RED}Usage: mc assign <task_id> <agent_id>${NC}"
        exit 1
    fi
    
    task_id="$1"
    agent_id="$2"
    
    result=$(api_post "/tasks/${task_id}/assign" "{\"agent_id\": $agent_id}")
    echo -e "${GREEN}✅ Assigned task #$task_id to agent $agent_id${NC}"
}

function cmd_start() {
    if [ $# -lt 1 ]; then
        echo -e "${RED}Usage: mc start <task_id>${NC}"
        exit 1
    fi
    
    task_id="$1"
    result=$(api_patch "/tasks/${task_id}" '{"status": "in_progress"}')
    echo -e "${GREEN}✅ Started task #$task_id${NC}"
}

function cmd_done() {
    if [ $# -lt 1 ]; then
        echo -e "${RED}Usage: mc done <task_id>${NC}"
        exit 1
    fi
    
    task_id="$1"
    result=$(api_patch "/tasks/${task_id}" '{"status": "done"}')
    echo -e "${GREEN}✅ Completed task #$task_id${NC}"
}

function cmd_comment() {
    if [ $# -lt 2 ]; then
        echo -e "${RED}Usage: mc comment <task_id> <text> [--agent AGENT_ID]${NC}"
        exit 1
    fi
    
    task_id="$1"
    text="$2"
    shift 2
    
    agent_id=2  # Default to Jiji
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --agent)
                agent_id="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    json=$(jq -n --arg text "$text" --argjson agent "$agent_id" '{content: $text, agent_id: $agent}')
    result=$(api_post "/tasks/${task_id}/comments" "$json")
    
    echo -e "${GREEN}✅ Added comment to task #$task_id${NC}"
}

function cmd_mine() {
    agent_name="${1:-Jiji}"
    cmd_tasks --agent "$agent_name" --limit 50
}

function cmd_inbox() {
    cmd_tasks --status inbox
}

function cmd_active() {
    cmd_tasks --status in_progress
}

function cmd_watch() {
    interval=10
    
    if [ "$1" = "--interval" ]; then
        interval="$2"
    fi
    
    echo -e "${CYAN}Watching active tasks (refresh every ${interval}s, Ctrl+C to stop)${NC}\n"
    
    while true; do
        clear
        cmd_status
        sleep "$interval"
    done
}

# Main
case "${1:-help}" in
    status)
        cmd_status
        ;;
    agents)
        cmd_agents
        ;;
    tasks)
        shift
        cmd_tasks "$@"
        ;;
    show)
        shift
        cmd_show "$@"
        ;;
    create)
        shift
        cmd_create "$@"
        ;;
    assign)
        shift
        cmd_assign "$@"
        ;;
    start)
        shift
        cmd_start "$@"
        ;;
    done)
        shift
        cmd_done "$@"
        ;;
    comment)
        shift
        cmd_comment "$@"
        ;;
    mine)
        shift
        cmd_mine "$@"
        ;;
    inbox)
        cmd_inbox
        ;;
    active)
        cmd_active
        ;;
    watch)
        shift
        cmd_watch "$@"
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        print_usage
        exit 1
        ;;
esac
