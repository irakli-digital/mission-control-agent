# Mission Control CLI

Command-line interface for the Mission Control multi-agent task management system.

## Quick Start

```bash
# Check system status
~/clawd-mura/projects/mission-control/mc.sh status

# Or add to PATH
echo 'export PATH="$HOME/clawd-mura/projects/mission-control:$PATH"' >> ~/.zshrc
source ~/.zshrc

mc status
```

## Common Workflows

### Check What's Going On

```bash
# System overview
mc status

# My tasks
mc mine Jiji

# All active tasks
mc active

# Inbox (unassigned)
mc inbox
```

### Create and Work on Tasks

```bash
# Create task
mc create "Build feature X" --priority high --desc "Details here"

# Assign to yourself
mc assign 5 2  # 2 = Jiji

# Start working
mc start 5

# Add progress updates
mc comment 5 "Finished Step 1, moving to Step 2"

# Mark done
mc done 5
```

### Collaborative Work

```bash
# Create task and assign to Mura
mc create "Fix bug Y" --priority urgent --assign 1

# Check Mura's tasks
mc mine Mura

# View task details
mc show 3

# Add comment (mentions Mura)
mc comment 3 "Blocked waiting for API key" --agent 2
```

### Live Monitoring

```bash
# Watch mode (auto-refresh every 10s)
mc watch

# Custom interval
mc watch --interval 5
```

## Agent IDs

| ID | Name | Role | Session Key |
|----|------|------|-------------|
| 1 | Mura | Builder | agent:mura:main |
| 2 | Jiji | Personal Assistant & Coordinator | agent:main:main |
| 3 | Baski | Research & Data Analyst | agent:baski:main |

## Task Lifecycle

```
inbox → assigned → in_progress → done
                        ↓
                    blocked
```

States:
- **inbox**: Unassigned, waiting for someone to pick it up
- **assigned**: Assigned to agent(s), not started yet
- **in_progress**: Currently being worked on
- **blocked**: Can't proceed, waiting for something
- **done**: Completed
- **cancelled**: Not doing this anymore

## Priority Levels

- 🔥 **urgent**: Drop everything, do this now
- ⬆️ **high**: Important, do soon
- ➡️ **normal**: Regular priority (default)
- ⬇️ **low**: Nice to have, do when free

## Integration Examples

### From Agent Sessions

```bash
# Jiji checks for new tasks during heartbeat
tasks=$(mc tasks --agent Jiji --status assigned --limit 5)

# Start a task
mc start 7
mc comment 7 "Starting work on this now" --agent 2

# Report completion
mc done 7
mc comment 7 "Completed! Generated 3 thumbnails." --agent 2
```

### From Shell Scripts

```bash
#!/bin/bash
# Process all inbox tasks automatically

mc inbox | grep "#" | while read line; do
    task_id=$(echo "$line" | grep -o '#[0-9]*' | tr -d '#')
    
    # Assign to Mura
    mc assign "$task_id" 1
    
    echo "Assigned task #$task_id to Mura"
done
```

### With Cron Jobs

```bash
# Nightly: report completed tasks
0 3 * * * ~/clawd-mura/projects/mission-control/mc.sh tasks --status done --limit 20 | mail -s "Daily completed tasks" irakli@example.com
```

## API Endpoints Used

| Endpoint | Method | What It Does |
|----------|--------|--------------|
| `/api/agents` | GET | List agents |
| `/api/tasks` | GET | List tasks (with filters) |
| `/api/tasks/:id` | GET | Get task details |
| `/api/tasks` | POST | Create task |
| `/api/tasks/:id` | PATCH | Update task |
| `/api/tasks/:id/assign` | POST | Assign task to agent |
| `/api/tasks/:id/comments` | POST | Add comment |

## Environment Variables

- `MC_API_URL`: API base URL (default: `http://localhost:3847/api`)

## Advanced Usage

### Filter Tasks by Multiple Criteria

```bash
# High priority tasks assigned to Mura
mc tasks --status assigned --agent Mura --priority high

# All in-progress tasks (any agent)
mc tasks --status in_progress
```

### Batch Operations

```bash
# Mark multiple tasks as done
for task_id in 5 7 9 12; do
    mc done "$task_id"
    mc comment "$task_id" "Auto-completed by script" --agent 2
done
```

### JSON Output (for scripting)

```bash
# Get raw JSON
curl -s http://localhost:3847/api/tasks | jq '.[] | select(.status == "in_progress")'
```

## Troubleshooting

**"Connection refused"**
- Check if Mission Control API is running: `ps aux | grep "mission-control/api"`
- Start if needed: `cd ~/clawd-mura/projects/mission-control && pm2 start ecosystem.config.cjs`

**"Task not found"**
- Verify task ID: `mc tasks | grep "#"`

**"Agent not found"**
- Check agent IDs: `mc agents`

## Tips

1. **Use `mc status` frequently** - Quick overview of everything
2. **Watch mode for monitoring** - `mc watch` during active work
3. **Comment generously** - Helps coordinate with other agents
4. **Use priorities** - Not everything is urgent
5. **Close the loop** - Always `mc done` when finished

## Keyboard Shortcuts (Watch Mode)

- `Ctrl+C` - Exit watch mode

## Related Tools

- **Web UI**: http://localhost:3847/ (full-featured dashboard)
- **Notification daemon**: Auto-delivers task mentions to agents
- **Clawdbot integration**: Tasks trigger notifications in agent sessions

---

Built by Jiji 🐕 for multi-agent coordination.
