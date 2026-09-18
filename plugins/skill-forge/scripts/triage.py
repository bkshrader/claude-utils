#!/usr/bin/env python3
"""Cluster the skill-forge inbox by tag and print a summary.

Usage: triage.py [--json] [inbox-dir]
"""
import json, os, sys
from collections import defaultdict

inbox = (os.environ.get("SKILL_FORGE_INBOX")
         or os.path.join(os.environ.get("SKILL_FORGE_HOME") or os.path.expanduser("~/.claude/skill-forge"), "inbox"))
as_json = "--json" in sys.argv
positional = [a for a in sys.argv[1:] if not a.startswith("--")]
if positional:
    inbox = positional[0]

if not os.path.isdir(inbox):
    print(f"inbox empty: {inbox} does not exist" if not as_json else "[]")
    sys.exit(0)

clusters = defaultdict(list)
for name in sorted(os.listdir(inbox)):
    if not name.endswith(".json"):
        continue
    path = os.path.join(inbox, name)
    try:
        with open(path) as f:
            rec = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"skip {name}: {e}", file=sys.stderr)
        continue
    rec["_file"] = path
    clusters[rec.get("tag", "untagged")].append(rec)

rows = []
for tag, recs in sorted(clusters.items(), key=lambda kv: -len(kv[1])):
    projects = sorted({r.get("project", "?") for r in recs})
    rows.append({
        "tag": tag,
        "captures": len(recs),
        "projects": projects,
        "first": recs[0].get("captured_at"),
        "last": recs[-1].get("captured_at"),
        "files": [r["_file"] for r in recs],
    })

if as_json:
    print(json.dumps(rows, indent=2))
    sys.exit(0)

if not rows:
    print(f"inbox empty: {inbox}")
    sys.exit(0)

print(f"{'tag':<28} {'captures':>8}  {'projects':>8}  span")
for r in rows:
    print(f"{r['tag']:<28} {r['captures']:>8}  {len(r['projects']):>8}  {r['first'][:10]} .. {r['last'][:10]}")
    for p in r["projects"]:
        print(f"{'':<28} {'':>8}  {'':>8}    {p}")
