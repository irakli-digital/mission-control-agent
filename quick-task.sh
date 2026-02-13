#!/bin/bash
# quick-task.sh - Fast task creation for Mission Control
# Usage: 
#   quick-task "Task description"
#   quick-task "Task description" --priority high --agent Mura
#   echo "Task description" | quick-task

set -euo pipefail

# Default values
AGENT="Jiji"
PRIORITY="normal"
BOARD="Jiji"
TASK_TEXT=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get MC CLI path
MC_CLI="$HOME/clawd-mura/projects/mission-control/mc.sh"

if [[ ! -f "$MC_CLI" ]]; then
    echo "❌ Mission Control CLI not found at $MC_CLI"
    exit 1
fi

# Parse input
if [[ -p /dev/stdin ]]; then
    # Piped input
    TASK_TEXT=$(cat)
elif [[ $# -eq 0 ]]; then
    # Interactive mode
    echo -n "Task: "
    read TASK_TEXT
else
    # First arg is task text
    TASK_TEXT="$1"
    shift
fi

# Parse optional flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--priority)
            PRIORITY="$2"
            shift 2
            ;;
        -a|--agent)
            AGENT="$2"
            BOARD="$2"
            shift 2
            ;;
        -b|--board)
            BOARD="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate task text
if [[ -z "$TASK_TEXT" ]]; then
    echo "❌ Task description required"
    exit 1
fi

# Create task (capture both stdout and stderr, ignore exit code)
echo "Creating task..."
RESULT=$("$MC_CLI" create "$TASK_TEXT" \
    --agent "$AGENT" \
    --priority "$PRIORITY" \
    --board "$BOARD" 2>&1 || true)

# Extract task ID from result (simple pattern match)
TASK_ID=$(echo "$RESULT" | grep -o '#[0-9]\+' | head -1 | tr -d '#' || echo "")

if [[ -n "$TASK_ID" ]]; then
    echo -e "${GREEN}✅ Created task #${TASK_ID}${NC}"
    echo -e "${BLUE}📋 View: http://localhost:3847${NC}"
    echo ""
    echo "$RESULT"
else
    echo "⚠️  Task created but couldn't extract ID"
    echo "$RESULT"
fi
