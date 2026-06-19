# AccessMind
**Governance Operations Intelligence Platform**

AccessMind is an Identity and Access Governance (IAG) orchestration layer that sits above existing IAM ecosystems.
It provides governance visibility, stale access intelligence, workflow orchestration, and accountability routing.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 16+ on localhost:5432
- accessmind database created with user postgres

### 1 - Create the database
    psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE accessmind;"

### 2 - Backend
    cd backend && python3 -m venv venv && source venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    uvicorn main:app --reload --port 8000

### 3 - Frontend
    cd frontend && npm install
    cp .env.local.example .env.local
    npm run dev

Open http://localhost:3000

---

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@accessmind.local | Password123! | Admin |
| manager@accessmind.local | Password123! | Manager |
| analyst@accessmind.local | Password123! | Analyst |
| auditor@accessmind.local | Password123! | Auditor |

---

## Health Check
    curl http://localhost:8000/health
    {"status":"ok","db":"connected","version":"4.4.0","phase":"Phase 4D"}

---

## Key Principles
- Orchestration only - AccessMind never provisions or deprovisions directly
- Governance-first - every feature maps to a governance accountability outcome
- Integration-aware - workflows route to SailPoint, Entra, CyberArk, Okta, or ServiceNow
- Low-noise - operational alerts are actionable or they do not exist

---

## Connected Platforms

| Platform | Status | Used For |
|----------|--------|----------|
| SailPoint IdentityNow | Active | Role remediation, certification |
| Microsoft Entra ID | Active | AD/Azure access governance |
| ServiceNow ITSM | Active | Ticket-based remediation |
| Okta IAM | Coming Soon | SSO governance |
| CyberArk PAM | Coming Soon | Privileged access remediation |
| Splunk SIEM | Coming Soon | Security event correlation |
