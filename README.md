# AccessMind

Making access governance intelligent.

---

## The Problem

When someone joins a company or changes teams, two things go wrong.

**Nobody knows what access they actually need.** Managers guess. IT copies the last person's access. Role names are cryptic. The result is under-provisioned new starters waiting days for the right access, or over-provisioned employees accumulating risk.

**Old access never gets cleaned up.** People move teams, change roles, or leave and their access stays. No one reviews it until an audit fails.

These are not new problems. But existing IAM platforms like SailPoint, Okta, and Entra are built for enterprises with six-figure implementation budgets. Mid-market companies are left managing this with spreadsheets, Confluence pages, and gut feel.

---

## What AccessMind Does

AccessMind is a governance intelligence layer that sits above your existing IAM ecosystem. It does not replace SailPoint or Entra. It makes them governable.

For onboarding: analyses what access people in the same role actually hold, and recommends the right access for a new starter across all connected platforms in one place, with plain-English role descriptions instead of cryptic system codes.

For governance hygiene: continuously detects stale access including people who have moved teams but still hold their old access, accounts with no login activity in 45 or more days, and roles with no governance owner.

Core capabilities:
- Cross-platform role discovery, one searchable catalogue across all your IAM systems
- Peer-based access recommendations for new starters
- Stale access detection with automated workflow generation
- SLA-tracked governance workflows with escalation management
- Recertification campaigns with manager review flows
- Governance debt scoring per system and team
- Audit-ready activity log for every governance action

---

## What It Is Not

AccessMind never provisions or deprovisions access directly. It detects, recommends, routes, and tracks. Execution happens in your connected platforms.

---

## Demo

Live demo: [your-deployed-url]

Demo accounts:
- admin@accessmind.local / Password123! — Admin, full access
- manager@accessmind.local / Password123! — Manager, can approve workflows
- analyst@accessmind.local / Password123! — Analyst, can create findings
- auditor@accessmind.local / Password123! — Auditor, read only

Suggested demo flow:
1. Overview — governance debt score, active escalations, live governance stories
2. New Starter — select Cyber Security then Security Architect to see peer-based recommendations
3. Findings — select multiple findings, bulk remediate to SailPoint
4. Governance Hygiene — see debt by system, click into a critical cluster
5. Workflows — see SLA breach escalations, open a timeline
6. Role Discovery — search for AWS to see the cross-platform unified catalogue

---

## Running Locally

Prerequisites: Python 3.11+, Node.js 18+, PostgreSQL 16+

1. Create the database:
   psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE accessmind;"

2. Start the backend:
   cd backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   uvicorn main:app --reload --port 8000

3. Start the frontend (new terminal):
   cd frontend
   npm install
   cp .env.local.example .env.local
   npm run dev

Open http://localhost:3000

---

## Connected Platforms

- SailPoint IdentityNow — Active — Role remediation, access certification
- Microsoft Entra ID — Active — AD and Azure access governance
- ServiceNow ITSM — Active — Ticket-based remediation workflows
- CyberArk PAM — Coming Phase 5 — Privileged access remediation
- Okta IAM — Coming Phase 5 — SSO group governance
- Splunk SIEM — Coming Phase 5 — Security event correlation

---

## Architecture

- Frontend: Next.js 16 with App Router and Tailwind CSS
- Backend: FastAPI with Python, SQLAlchemy, PostgreSQL
- Auth: JWT with role-based access control
- Philosophy: Detect, Orchestrate, Route. Never provision directly.

---

## Status

Phase 4D complete. Active development. Core governance loop covering detect, workflow, remediate, and audit is fully functional with seeded enterprise demo data across 6 connected platforms, 50 governance clusters, and 32 active workflows.