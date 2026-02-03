#!/usr/bin/env python3
"""Mission Control CLI — shared task management for Clawdbot agents."""

import argparse
import json
import os
import sys
import re
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Installing psycopg2...")
    os.system("pip install psycopg2-binary --break-system-packages -q")
    import psycopg2
    import psycopg2.extras


def get_db():
    url = os.environ.get("NEON_DATABASE_URL")
    if not url:
        print("Error: NEON_DATABASE_URL not set")
        sys.exit(1)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    return conn


def agent_id_by_name(cur, name):
    cur.execute("SELECT id FROM agents WHERE LOWER(name) = LOWER(%s)", (name,))
    row = cur.fetchone()
    if not row:
        print(f"Error: Agent '{name}' not found")
        sys.exit(1)
    return row["id"]


# ─── TASKS ───────────────────────────────────────────────

def task_create(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    created_by = None
    if args.by:
        created_by = agent_id_by_name(cur, args.by)

    cur.execute(
        "INSERT INTO tasks (title, description, status, priority, created_by) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (args.title, args.description or "", args.status or "inbox", args.priority or "normal", created_by),
    )
    task_id = cur.fetchone()["id"]

    # Assign agents
    if args.assign:
        for name in args.assign:
            aid = agent_id_by_name(cur, name)
            cur.execute("INSERT INTO task_assignees (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (task_id, aid))
            cur.execute("INSERT INTO thread_subscriptions (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (task_id, aid))
        status = "assigned" if (args.status or "inbox") == "inbox" else args.status
        cur.execute("UPDATE tasks SET status = %s WHERE id = %s", (status, task_id))

    # Log activity
    by_name = args.by or "System"
    assignees = ", ".join(args.assign) if args.assign else "unassigned"
    log_activity(cur, "task_created", created_by, task_id, f"{by_name} created task #{task_id}: {args.title} → {assignees}")

    print(f"✅ Task #{task_id}: {args.title}")
    if args.assign:
        print(f"   Assigned to: {', '.join(args.assign)}")
    conn.close()


def task_update(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    sets, vals = [], []
    if args.status:
        sets.append("status = %s")
        vals.append(args.status)
    if args.title:
        sets.append("title = %s")
        vals.append(args.title)
    if args.priority:
        sets.append("priority = %s")
        vals.append(args.priority)
    if args.description:
        sets.append("description = %s")
        vals.append(args.description)

    if sets:
        sets.append("updated_at = NOW()")
        vals.append(args.id)
        cur.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = %s", vals)

    if args.assign:
        for name in args.assign:
            aid = agent_id_by_name(cur, name)
            cur.execute("INSERT INTO task_assignees (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (args.id, aid))
            cur.execute("INSERT INTO thread_subscriptions (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (args.id, aid))

    by_id = agent_id_by_name(cur, args.by) if args.by else None
    changes = []
    if args.status:
        changes.append(f"status→{args.status}")
    if args.assign:
        changes.append(f"assigned {', '.join(args.assign)}")
    if args.priority:
        changes.append(f"priority→{args.priority}")
    by_name = args.by or "System"
    log_activity(cur, "task_updated", by_id, args.id, f"{by_name} updated task #{args.id}: {', '.join(changes)}")

    print(f"✅ Task #{args.id} updated")
    conn.close()


def task_list(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where = []
    vals = []
    if args.status:
        where.append("t.status = %s")
        vals.append(args.status)
    if args.agent:
        where.append("EXISTS (SELECT 1 FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = t.id AND LOWER(a.name) = LOWER(%s))")
        vals.append(args.agent)

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""
    cur.execute(f"""
        SELECT t.id, t.title, t.status, t.priority, t.created_at,
               COALESCE(string_agg(a.name, ', '), 'unassigned') as assignees
        FROM tasks t
        LEFT JOIN task_assignees ta ON ta.task_id = t.id
        LEFT JOIN agents a ON a.id = ta.agent_id
        {where_clause}
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT %s
    """, vals + [args.limit or 20])

    rows = cur.fetchall()
    if not rows:
        print("No tasks found.")
        return

    status_icons = {"inbox": "📥", "assigned": "📋", "in_progress": "🔄", "review": "👀", "done": "✅", "blocked": "🚫"}
    priority_icons = {"urgent": "🔴", "high": "🟠", "normal": "⚪", "low": "🔵"}

    for r in rows:
        si = status_icons.get(r["status"], "❓")
        pi = priority_icons.get(r["priority"], "")
        print(f"  {si} #{r['id']} {pi} {r['title']}")
        print(f"     {r['status']} | {r['assignees']} | {r['created_at'].strftime('%b %d')}")
    conn.close()


def task_show(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT * FROM tasks WHERE id = %s", (args.id,))
    task = cur.fetchone()
    if not task:
        print(f"Task #{args.id} not found")
        return

    cur.execute("""
        SELECT a.name FROM task_assignees ta JOIN agents a ON a.id = ta.agent_id WHERE ta.task_id = %s
    """, (args.id,))
    assignees = [r["name"] for r in cur.fetchall()]

    cur.execute("""
        SELECT c.content, a.name, a.emoji, c.created_at
        FROM comments c JOIN agents a ON a.id = c.agent_id
        WHERE c.task_id = %s ORDER BY c.created_at
    """, (args.id,))
    comments = cur.fetchall()

    print(f"{'='*50}")
    print(f"Task #{task['id']}: {task['title']}")
    print(f"Status: {task['status']} | Priority: {task['priority']}")
    print(f"Assigned: {', '.join(assignees) or 'unassigned'}")
    if task["description"]:
        print(f"\n{task['description']}")
    print(f"{'='*50}")

    if comments:
        print(f"\n💬 Comments ({len(comments)}):")
        for c in comments:
            ts = c["created_at"].strftime("%b %d %H:%M")
            print(f"\n  {c['emoji']} {c['name']} ({ts}):")
            print(f"  {c['content']}")
    conn.close()


# ─── COMMENTS ────────────────────────────────────────────

def comment_add(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    aid = agent_id_by_name(cur, args.by)

    cur.execute(
        "INSERT INTO comments (task_id, agent_id, content) VALUES (%s, %s, %s) RETURNING id",
        (args.task_id, aid, args.message),
    )
    cid = cur.fetchone()["id"]

    # Auto-subscribe
    cur.execute("INSERT INTO thread_subscriptions (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (args.task_id, aid))

    # Log activity
    log_activity(cur, "comment_added", aid, args.task_id, f"{args.by} commented on task #{args.task_id}")

    # Parse @mentions and notify
    mentions = re.findall(r"@(\w+)", args.message)
    for m in mentions:
        cur.execute("SELECT id FROM agents WHERE LOWER(name) = LOWER(%s)", (m,))
        row = cur.fetchone()
        if row:
            cur.execute(
                "INSERT INTO notifications (mentioned_agent_id, from_agent_id, task_id, content) VALUES (%s, %s, %s, %s)",
                (row["id"], aid, args.task_id, f"{args.by} mentioned you in task #{args.task_id}: {args.message[:200]}"),
            )
            # Auto-subscribe mentioned agent
            cur.execute("INSERT INTO thread_subscriptions (task_id, agent_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (args.task_id, row["id"]))

    # Notify all thread subscribers (except commenter)
    cur.execute("""
        SELECT a.id, a.name FROM thread_subscriptions ts
        JOIN agents a ON a.id = ts.agent_id
        WHERE ts.task_id = %s AND ts.agent_id != %s
    """, (args.task_id, aid))
    for sub in cur.fetchall():
        if sub["name"].lower() not in [m.lower() for m in mentions]:  # Don't double-notify
            cur.execute(
                "INSERT INTO notifications (mentioned_agent_id, from_agent_id, task_id, content) VALUES (%s, %s, %s, %s)",
                (sub["id"], aid, args.task_id, f"{args.by} commented on task #{args.task_id}: {args.message[:200]}"),
            )

    print(f"💬 Comment #{cid} added to task #{args.task_id}")
    conn.close()


# ─── NOTIFICATIONS ───────────────────────────────────────

def notif_check(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    aid = agent_id_by_name(cur, args.agent)

    cur.execute("""
        SELECT n.id, n.content, a.name as from_name, a.emoji, n.task_id, n.created_at
        FROM notifications n
        LEFT JOIN agents a ON a.id = n.from_agent_id
        WHERE n.mentioned_agent_id = %s AND n.delivered = FALSE
        ORDER BY n.created_at
    """, (aid,))
    rows = cur.fetchall()

    if not rows:
        print("No new notifications.")
        return

    print(f"🔔 {len(rows)} notification(s):")
    for r in rows:
        ts = r["created_at"].strftime("%H:%M")
        print(f"  [{ts}] {r['emoji']} {r['from_name']}: {r['content']}")

    # Mark delivered
    if not args.peek:
        ids = [r["id"] for r in rows]
        cur.execute("UPDATE notifications SET delivered = TRUE WHERE id = ANY(%s)", (ids,))
        print(f"\n  ✅ Marked {len(ids)} as delivered")

    conn.close()


# ─── ACTIVITY FEED ───────────────────────────────────────

def activity_feed(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT ac.message, ac.type, ac.created_at, a.emoji, a.name
        FROM activities ac
        LEFT JOIN agents a ON a.id = ac.agent_id
        ORDER BY ac.created_at DESC
        LIMIT %s
    """, (args.limit or 20,))

    rows = cur.fetchall()
    if not rows:
        print("No activity yet.")
        return

    print("📊 Recent Activity:")
    for r in rows:
        ts = r["created_at"].strftime("%b %d %H:%M")
        emoji = r["emoji"] or "⚙️"
        print(f"  [{ts}] {emoji} {r['message']}")
    conn.close()


# ─── AGENT STATUS ────────────────────────────────────────

def agent_status(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.update:
        aid = agent_id_by_name(cur, args.agent)
        cur.execute("UPDATE agents SET status = %s, updated_at = NOW() WHERE id = %s", (args.update, aid))
        print(f"✅ {args.agent} status → {args.update}")
        return

    cur.execute("""
        SELECT a.*, t.title as current_task_title,
               (SELECT COUNT(*) FROM task_assignees ta WHERE ta.agent_id = a.id) as total_tasks,
               (SELECT COUNT(*) FROM notifications n WHERE n.mentioned_agent_id = a.id AND n.delivered = FALSE) as unread
        FROM agents a
        LEFT JOIN tasks t ON t.id = a.current_task_id
        ORDER BY a.id
    """)
    for r in cur.fetchall():
        status_icon = {"idle": "😴", "active": "🟢", "blocked": "🔴"}.get(r["status"], "❓")
        print(f"  {r['emoji']} {r['name']} ({r['role']}) {status_icon} {r['status']}")
        if r["current_task_title"]:
            print(f"     Working on: {r['current_task_title']}")
        print(f"     Tasks: {r['total_tasks']} | Unread: {r['unread']}")
    conn.close()


# ─── DOCUMENTS ───────────────────────────────────────────

def doc_create(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    aid = agent_id_by_name(cur, args.by) if args.by else None

    content = args.content
    if args.file:
        with open(args.file) as f:
            content = f.read()

    cur.execute(
        "INSERT INTO documents (title, content, type, task_id, agent_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (args.title, content or "", args.type or "deliverable", args.task_id, aid),
    )
    did = cur.fetchone()["id"]
    log_activity(cur, "document_created", aid, args.task_id, f"{args.by or 'System'} created document: {args.title}")
    print(f"📄 Document #{did}: {args.title}")
    conn.close()


# ─── STANDUP ─────────────────────────────────────────────

def standup(args):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Today's activity
    cur.execute("""
        SELECT ac.message, a.emoji FROM activities ac
        LEFT JOIN agents a ON a.id = ac.agent_id
        WHERE ac.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY ac.created_at DESC
    """)
    activities = cur.fetchall()

    # Tasks by status
    for status in ["in_progress", "review", "blocked", "done"]:
        cur.execute("""
            SELECT t.id, t.title, string_agg(a.name, ', ') as assignees
            FROM tasks t
            LEFT JOIN task_assignees ta ON ta.task_id = t.id
            LEFT JOIN agents a ON a.id = ta.agent_id
            WHERE t.status = %s AND t.updated_at > NOW() - INTERVAL '24 hours'
            GROUP BY t.id
        """, (status,))
        rows = cur.fetchall()
        if rows:
            icons = {"in_progress": "🔄 IN PROGRESS", "review": "👀 NEEDS REVIEW", "blocked": "🚫 BLOCKED", "done": "✅ COMPLETED"}
            print(f"\n{icons.get(status, status.upper())}:")
            for r in rows:
                print(f"  • #{r['id']} {r['title']} ({r['assignees'] or 'unassigned'})")

    if not activities:
        print("\nNo activity in the last 24 hours.")
    conn.close()


# ─── HELPERS ─────────────────────────────────────────────

def log_activity(cur, atype, agent_id, task_id, message):
    cur.execute(
        "INSERT INTO activities (type, agent_id, task_id, message) VALUES (%s, %s, %s, %s)",
        (atype, agent_id, task_id, message),
    )


# ─── CLI ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Mission Control CLI")
    sub = parser.add_subparsers(dest="command")

    # task create
    tc = sub.add_parser("create", help="Create a task")
    tc.add_argument("title")
    tc.add_argument("--description", "-d", default="")
    tc.add_argument("--assign", "-a", nargs="+")
    tc.add_argument("--priority", "-p", default="normal", choices=["low", "normal", "high", "urgent"])
    tc.add_argument("--status", "-s", default="inbox")
    tc.add_argument("--by", "-b", default=None)

    # task update
    tu = sub.add_parser("update", help="Update a task")
    tu.add_argument("id", type=int)
    tu.add_argument("--title", "-t", default=None)
    tu.add_argument("--description", "-d", default=None)
    tu.add_argument("--status", "-s", default=None, choices=["inbox", "assigned", "in_progress", "review", "done", "blocked"])
    tu.add_argument("--priority", "-p", default=None, choices=["low", "normal", "high", "urgent"])
    tu.add_argument("--assign", "-a", nargs="+")
    tu.add_argument("--by", "-b", default=None)

    # task list
    tl = sub.add_parser("tasks", help="List tasks")
    tl.add_argument("--status", "-s", default=None)
    tl.add_argument("--agent", "-a", default=None)
    tl.add_argument("--limit", "-n", type=int, default=20)

    # task show
    ts = sub.add_parser("show", help="Show task detail")
    ts.add_argument("id", type=int)

    # comment
    cm = sub.add_parser("comment", help="Add comment to task")
    cm.add_argument("task_id", type=int)
    cm.add_argument("message")
    cm.add_argument("--by", "-b", required=True)

    # notifications
    nt = sub.add_parser("notifs", help="Check notifications")
    nt.add_argument("agent")
    nt.add_argument("--peek", action="store_true", help="Don't mark as delivered")

    # activity feed
    af = sub.add_parser("feed", help="Activity feed")
    af.add_argument("--limit", "-n", type=int, default=20)

    # agent status
    ag = sub.add_parser("agents", help="Agent status")
    ag.add_argument("--agent", "-a", default=None)
    ag.add_argument("--update", "-u", default=None, choices=["idle", "active", "blocked"])

    # documents
    dc = sub.add_parser("doc", help="Create document")
    dc.add_argument("title")
    dc.add_argument("--content", "-c", default="")
    dc.add_argument("--file", "-f", default=None)
    dc.add_argument("--type", "-t", default="deliverable")
    dc.add_argument("--task-id", type=int, default=None)
    dc.add_argument("--by", "-b", default=None)

    # standup
    su = sub.add_parser("standup", help="Daily standup summary")

    args = parser.parse_args()

    commands = {
        "create": task_create,
        "update": task_update,
        "tasks": task_list,
        "show": task_show,
        "comment": comment_add,
        "notifs": notif_check,
        "feed": activity_feed,
        "agents": agent_status,
        "doc": doc_create,
        "standup": standup,
    }

    fn = commands.get(args.command)
    if fn:
        fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
