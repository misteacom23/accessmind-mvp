from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
from models import Base
Base.metadata.create_all(bind=engine)

# ── Phase 1–4C seeders
from sample_data_loader import load as load_sample_data
from seed_users import seed as seed_users
from seed_role_catalogue import seed as seed_role_catalogue
from seed_connectors import seed_connectors
from seed_governance_roles import seed_governance_roles
from seed_hygiene import seed_hygiene_clusters
from seed_workflows import seed_demo_workflows
from campaign_service import seed_demo_campaigns
from package_service import seed_demo_packages
from seed_campaign_items import seed_campaign_items

# ── Phase 4D seeders
from seed_trends import seed_trends
from seed_stories import seed_stories
from seed_inactive_accounts import seed_inactive_accounts

# ── Phase 1–4C seed execution
_db = SessionLocal()
try:
    load_sample_data(_db)
    seed_users(_db)
    seed_role_catalogue(_db)
    seed_connectors(_db)
finally:
    _db.close()

seed_governance_roles()
seed_hygiene_clusters()

_db4c = SessionLocal()
try:
    seed_demo_workflows(_db4c)
    seed_demo_campaigns(_db4c)
    seed_demo_packages(_db4c)
    seed_campaign_items(_db4c)
finally:
    _db4c.close()

# ── Phase 4D seed execution
seed_trends()
seed_stories()
seed_inactive_accounts()

# ── App initialisation
app = FastAPI(
    title="AccessMind API",
    description="Identity & Access Governance Orchestration Platform",
    version="4.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers — Phase 1–4C
from routes.auth import router as auth_router
from routes.employees import router as employees_router
from routes.recommendations import router as recommendations_router
from routes.movers import router as movers_router
from routes.findings import router as findings_router
from routes.approvals import router as approvals_router
from routes.audit import router as audit_router
from routes.exceptions import router as exceptions_router
from routes.roles import router as roles_router
from routes.connectors import router as connectors_router
from routes.hygiene import router as hygiene_router
from routes.remediation import router as remediation_router
from routes.workflows import router as workflows_router
from routes.campaigns import router as campaigns_router
from routes.packages import router as packages_router

# ── Routers — Phase 4D
from routes.trends import router as trends_router
from routes.notifications import router as notifications_router

app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(recommendations_router)
app.include_router(movers_router)
app.include_router(findings_router)
app.include_router(approvals_router)
app.include_router(audit_router)
app.include_router(exceptions_router)
app.include_router(roles_router)
app.include_router(connectors_router)
app.include_router(hygiene_router)
app.include_router(remediation_router)
app.include_router(workflows_router)
app.include_router(campaigns_router)
app.include_router(packages_router)
app.include_router(trends_router)
app.include_router(notifications_router)


# ── Health check
@app.get("/health", tags=["Health"])
def health_check():
    from database import engine
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"
    return {
        "status":  "ok",
        "db":      db_status,
        "version": "4.4.0",
        "phase":   "Phase 4D",
    }


@app.get("/", tags=["Health"])
def root():
    return {"message": "AccessMind API running", "version": "4.4.0", "phase": "Phase 4D"}
