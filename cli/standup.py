#!/usr/bin/env python3
"""Daily standup generator — sends summary to Irakli via Telegram."""
import os, sys, psycopg2, psycopg2.extras
from datetime import datetime, timezone

def get_db():
    conn = psycopg2.connect(os.environ["NEON_DATABASE_URL"])
    conn.autocommit = True
    return conn

def generate_standup():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    lines = [f"📊 DAILY STANDUP — {datetime.now().strftime('%b %d, %Y')}\n"]
    
    sections = {
        'done': '✅ COMPLETED',
        'in_progress': '🔄 IN PROGRESS', 
        'review': '👀 NEEDS REVIEW',
        'blocked': '🚫 BLOCKED',
    }
    
    for status, label in sections.items():
        cur.execute("""
            SELECT t.id, t.title, string_agg(a.name, ', ') as assignees
            FROM tasks t
            LEFT JOIN task_assignees ta ON ta.task_id = t.id
            LEFT JOIN agents a ON a.id = ta.agent_id
            WHERE t.status = %s AND t.updated_at > NOW() - INTERVAL '24 hours'
            GROUP BY t.id ORDER BY t.updated_at DESC
        """, (status,))
        rows = cur.fetchall()
        if rows:
            lines.append(f"\n{label}:")
            for r in rows:
                lines.append(f"  • {r['assignees'] or '?'}: {r['title']}")
    
    # Recent activity count
    cur.execute("SELECT COUNT(*) as cnt FROM activities WHERE created_at > NOW() - INTERVAL '24 hours'")
    act_count = cur.fetchone()['cnt']
    
    # Agent statuses
    cur.execute("""
        SELECT name, emoji, status,
            (SELECT COUNT(*) FROM task_assignees ta JOIN tasks t ON t.id = ta.task_id 
             WHERE ta.agent_id = agents.id AND t.status = 'in_progress') as active
        FROM agents ORDER BY id
    """)
    agents = cur.fetchall()
    
    lines.append(f"\n👥 AGENTS:")
    for a in agents:
        status_icon = {"idle": "😴", "active": "🟢", "blocked": "🔴"}.get(a['status'], "❓")
        lines.append(f"  {a['emoji']} {a['name']}: {status_icon} {a['status']} ({a['active']} active tasks)")
    
    lines.append(f"\n📈 {act_count} activities in last 24h")
    
    conn.close()
    return "\n".join(lines)

if __name__ == "__main__":
    print(generate_standup())
