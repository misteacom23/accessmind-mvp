# AccessMind
**Making access governance intelligent — so your team spends less time managing spreadsheets and more time managing risk.**

---

## The Problem

When someone joins a company or changes teams, two things go wrong:

1. **Nobody knows what access they actually need.** Managers guess. IT copies the last person's access. Role names are cryptic. The result is either under-provisioned new starters waiting days for the right access, or over-provisioned employees accumulating risk.

2. **Old access never gets cleaned up.** People move teams, change roles, or leave — and their access stays. No one reviews it until an audit fails.

These aren't new problems. But existing IAM platforms (SailPoint, Okta, Entra) are built for enterprises with six-figure implementation budgets. Mid-market companies are left managing this with spreadsheets, Confluence pages, and gut feel.

---

## What AccessMind Does

AccessMind is a governance intelligence layer that sits above yoAccessMind is a governance intelligence place SailPoint or Entra — it makes them governable.

**For onboarding:** AccessMind analyses what access people in the same role actually hold, and recommends t**For onboarding:** AccessMind analyses what access people in thorms, in one place, with plain-English role descriptions instead of cryptic system codes.

**For governance hygiene:** AccessMind continuously detects stale access — people who've moved teams but still hold their old access, accounts with no login activity in 45+ days, roles with no governance owner. It surfaces these as prioritised findings and routes remediation to the right platform automatically.

**Core capabilities:**
- Cross-platform role discovery — one searchable catalogue across all your IAM systems
- Peer-based access recommendations for new starters
- Stale access detection with automated workflow generation
- SLA-tracked governance workflows w- SLA-tracked governament- SLA-tracked governance workflows w- SLA-tracked governament- SLA-tracked governance workflows w- SLA-tracked governament- SLA-tracked governance workflows
---

## What It Is Not

AccessMind never provisions or deprovisions access directly. It is a governance orchestration layer — it detects, recommends, routes, and tracks. Execution happens in your connected platforms.

---

## Demo

Live demo: [your-deployed-url]
Live demo: [your-deployed-url]
deprovisions access directly. It is a governance orchestration layer — it detects, recommends, routes, and tracks. Execution happens in your connected platforms.
d governance workflows
smind.local | Password123! | Analyst — can create findings |
| auditor@accessmind.local | Passwo| auditor@accessmin� re| auditor@accessmind.local | Passwo| auditor@accessmin� re| auditor@accessmind.local |esc| auditor@accessmind.local | Passwo| auditor@accesst | auditor@accessmind.local | Passwo| auditor@accessmin� rcommendations
3. **Findings** → select multiple findings → bulk remediate to SailPoint
4. **Governance Hygiene** → see debt by system, click into a critical cluster
5. **Workflows** → see SLA breach escalations, open a timeline
6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6. **Role6

### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ## -### Setup### Seash###d ### Setup### Seash### Setup### Seash### Setups -h### Setup## .e### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##E ## -### Setup### Seash###d ----### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setuer### Setup### Seash### Setup### Seash### Setups -h### Setup### Seash### Setup##| ### Setup### Seash### Setup### Seash### Setups -h### Setup### |
||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||ture

- **Frontend:** Next.js 16 (App Router), Tailwind CSS
- **Backend:** FastAPI (Python), SQLAlchemy, PostgreSQL
- **Auth:** JWT with role-based access control (admin, manager, analyst, auditor)
- **Philosophy:** Detect → Orchestrate → Route. Never provision directly.

---

## Status
Active development
Core governance loop (detect → workflow → remediate → audit) is fully functional with seeded enterprise demo data across 6 connected platforms, 50+ governance clusters, and 32 active workflows.
