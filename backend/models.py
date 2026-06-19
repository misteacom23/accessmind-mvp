from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text, func, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False, default="analyst")
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    current_team = Column(String(100), nullable=False)
    previous_team = Column(String(100), nullable=True)
    role = Column(String(100), nullable=False)
    employment_status = Column(String(50), default="active")

    employee_access = relationship("EmployeeAccess", back_populates="employee")
    findings = relationship("Finding", back_populates="employee")
    approval_requests = relationship("ApprovalRequest", back_populates="employee")
    access_exceptions = relationship("AccessException", back_populates="employee")


class AccessGroup(Base):
    __tablename__ = "access_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(150), unique=True, nullable=False)
    system_name = Column(String(150), nullable=False)
    team_owner = Column(String(100), nullable=False)
    is_privileged = Column(Boolean, default=False)

    employee_access = relationship("EmployeeAccess", back_populates="group")


class EmployeeAccess(Base):
    __tablename__ = "employee_access"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("access_groups.id"), nullable=False)
    granted_date = Column(Date, nullable=True)

    employee = relationship("Employee", back_populates="employee_access")
    group = relationship("AccessGroup", back_populates="employee_access")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    finding_type = Column(String(100), nullable=False)
    risk_level = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    status = Column(String(50), default="Open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    employee = relationship("Employee", back_populates="findings")
    approval_requests = relationship("ApprovalRequest", back_populates="finding")
    access_exceptions = relationship("AccessException", back_populates="finding")
    remediation_actions = relationship("RemediationAction", back_populates="finding")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    finding_id = Column(Integer, ForeignKey("findings.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    request_type = Column(String(100), nullable=False, default="access_removal")
    access_group_name = Column(String(150), nullable=False)
    approver_name = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="Pending")
    decision_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    decided_at = Column(DateTime(timezone=True), nullable=True)

    finding = relationship("Finding", back_populates="approval_requests")
    employee = relationship("Employee", back_populates="approval_requests")


class AccessException(Base):
    __tablename__ = "access_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    finding_id = Column(Integer, ForeignKey("findings.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    access_group_name = Column(String(150), nullable=False)
    business_justification = Column(Text, nullable=False)
    approved_by = Column(String(100), nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="Active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    finding = relationship("Finding", back_populates="access_exceptions")
    employee = relationship("Employee", back_populates="access_exceptions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String(100), nullable=False)
    performed_by = Column(String(100), nullable=False, default="System")
    target_type = Column(String(100), nullable=True)
    target_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RoleCatalogue(Base):
    __tablename__ = "role_catalogue"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(150), unique=True, nullable=False)
    application = Column(String(100), nullable=False)
    environment = Column(String(20), nullable=False, default="PRD")
    access_type = Column(String(50), nullable=False)
    is_privileged = Column(Boolean, default=False)
    description = Column(Text, nullable=False)
    owner_team = Column(String(100), nullable=False)
    approval_owner = Column(String(100), nullable=False)
    requestable = Column(Boolean, default=True)
    assigned_user_count = Column(Integer, default=0)
    stale_finding_count = Column(Integer, default=0)
    last_reviewed_date = Column(Date, nullable=True)
    source_system = Column(String(100), default="AccessMind")
    source_type = Column(String(50), default="manual")
    external_id = Column(String(150), nullable=True)
    sync_status = Column(String(50), default="synced")
    last_synced_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Connector(Base):
    __tablename__ = "connectors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    connector_type = Column(String, nullable=False)
    status = Column(String, default="coming_soon")
    description = Column(String)
    base_url = Column(String, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default="never_synced")
    record_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    remediation_actions = relationship("RemediationAction", back_populates="connector")


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id = Column(Integer, primary_key=True, index=True)
    finding_id = Column(Integer, ForeignKey("findings.id"), nullable=False)
    action_type = Column(String, nullable=False)
    target_platform = Column(String, nullable=False)
    connector_id = Column(Integer, ForeignKey("connectors.id"), nullable=True)
    status = Column(String, default="sent")
    external_reference = Column(String, nullable=True)
    performed_by = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    finding = relationship("Finding", back_populates="remediation_actions")
    connector = relationship("Connector", back_populates="remediation_actions")


class GovernanceHygieneCluster(Base):
    """
    One row per (system_name x cluster_type) governance finding.
    Never one row per bad role — always grouped at system+type level.
    Detection data refreshed on each scan; workflow status is preserved.
    """
    __tablename__ = "governance_hygiene_clusters"

    id = Column(Integer, primary_key=True, index=True)

    # Detection identity
    cluster_type = Column(String(50), nullable=False)
    system_name = Column(String(200), nullable=False)

    # Cluster content (refreshed on each scan)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    affected_count = Column(Integer, default=0)
    affected_role_names = Column(JSON, default=list)

    # Prioritisation
    priority = Column(String(20), default="medium")
    governance_debt_score = Column(Integer, default=0)

    # Accountability routing (updatable via PATCH)
    governance_owner = Column(String(200), nullable=True)
    governance_queue = Column(String(200), nullable=True)
    escalation_target = Column(String(200), nullable=True)

    # Recommendation
    recommendation = Column(Text, nullable=True)

    # Workflow lifecycle (NEVER overwritten on re-scan)
    status = Column(String(50), default="new")

    # Timestamps
    last_detected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─────────────────────────────────────────────
# PHASE 4C — GOVERNANCE WORKFLOW AUTOMATION
# ─────────────────────────────────────────────

class GovernanceWorkflow(Base):
    __tablename__ = "governance_workflows"

    id = Column(Integer, primary_key=True, index=True)
    workflow_type = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, nullable=False, default="medium")
    status = Column(String, nullable=False, default="open")
    governance_owner = Column(String, nullable=True)
    governance_queue = Column(String, nullable=True)
    connector_id = Column(Integer, ForeignKey("connectors.id"), nullable=True)
    external_reference = Column(String, nullable=True)
    sla_days = Column(Integer, nullable=False, default=14)
    due_date = Column(DateTime, nullable=True)
    first_reviewed_at = Column(DateTime, nullable=True)
    escalated_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    escalation_level = Column(Integer, nullable=False, default=0)
    escalation_target = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    story_key = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    connector = relationship("Connector", foreign_keys=[connector_id])
    timeline_events = relationship("WorkflowTimelineEvent", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowTimelineEvent(Base):
    __tablename__ = "workflow_timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("governance_workflows.id"), nullable=False)
    event_type = Column(String, nullable=False)
    actor = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workflow = relationship("GovernanceWorkflow", back_populates="timeline_events")


class GovernanceCampaign(Base):
    __tablename__ = "governance_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String, nullable=False)
    campaign_type = Column(String, nullable=False)
    target_system = Column(String, nullable=True)
    target_access_type = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")
    created_by = Column(String, nullable=False)
    launched_at = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    completion_pct = Column(Float, nullable=False, default=0.0)
    total_targets = Column(Integer, nullable=False, default=0)
    confirmed_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    pending_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    review_items = relationship("CampaignReviewItem", back_populates="campaign", cascade="all, delete-orphan")


class CampaignReviewItem(Base):
    __tablename__ = "campaign_review_items"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("governance_campaigns.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    role_id = Column(Integer, ForeignKey("role_catalogue.id"), nullable=True)
    assigned_to = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    escalated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("GovernanceCampaign", back_populates="review_items")
    employee = relationship("Employee", foreign_keys=[employee_id])
    role = relationship("RoleCatalogue", foreign_keys=[role_id])


class AccessPackage(Base):
    __tablename__ = "access_packages"

    id = Column(Integer, primary_key=True, index=True)
    package_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    governance_owner = Column(String, nullable=False, default="")
    risk_level = Column(String, nullable=False, default="medium")
    system_scope = Column(String, nullable=True)
    last_reviewed_date = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="active")
    stale_finding_count = Column(Integer, nullable=False, default=0)
    risk_score      = Column(Integer, nullable=False, default=0)
    overlap_flag    = Column(Boolean, default=False)
    duplicate_flag  = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    package_roles = relationship("AccessPackageRole", back_populates="package", cascade="all, delete-orphan")


class AccessPackageRole(Base):
    __tablename__ = "access_package_roles"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("access_packages.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("role_catalogue.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    package = relationship("AccessPackage", back_populates="package_roles")
    role = relationship("RoleCatalogue", foreign_keys=[role_id])


# ─── PHASE 4D MODELS ──────────────────────────────────────────────────────────

class GovernanceStory(Base):
    """Narrative arc metadata — links seed workflows into named demo stories."""
    __tablename__ = "governance_stories"

    id          = Column(Integer, primary_key=True, index=True)
    story_key   = Column(String, unique=True, nullable=False)   # e.g. "engineer_team_move"
    story_title = Column(String, nullable=False)
    story_phase = Column(String, nullable=False)                # "detection" / "escalation" / "resolution"
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


class GovernanceTrendSnapshot(Base):
    """
    Daily point-in-time metric captures.
    metric_type values:
      "debt_score"              — platform-wide governance debt (0–100)
      "open_workflows"          — count of non-resolved workflows
      "escalation_count"        — workflows at escalation_level >= 1
      "remediation_throughput"  — workflows resolved in rolling 7-day window
      "stale_access_count"      — open stale-access findings
    system_scope = None means platform-wide aggregate.
    governance_queue = None means not queue-scoped.
    """
    __tablename__ = "governance_trend_snapshots"

    id               = Column(Integer, primary_key=True, index=True)
    snapshot_date    = Column(DateTime, nullable=False)
    metric_type      = Column(String, nullable=False)
    metric_value     = Column(Float, nullable=False)
    system_scope     = Column(String, nullable=True)
    governance_queue = Column(String, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)


class GovernanceNotification(Base):
    """
    In-app operational notifications. No emails. No push.
    notification_type values:
      "sla_breach"       — workflow past due
      "escalation"       — escalation level changed
      "workflow_created" — auto-trigger fired
      "package_issue"    — orphaned / duplicate / stale package detected
      "campaign_overdue" — campaign past due_date with pending items
    severity: "info" / "warning" / "critical"
    target_user_role: "analyst" / "manager" / "admin" / None (all roles see it)
    """
    __tablename__ = "governance_notifications"

    id                  = Column(Integer, primary_key=True, index=True)
    notification_type   = Column(String, nullable=False)
    title               = Column(String, nullable=False)
    body                = Column(Text, nullable=False)
    target_user_role    = Column(String, nullable=True)
    severity            = Column(String, default="info")
    is_read             = Column(Boolean, default=False)
    is_dismissed        = Column(Boolean, default=False)
    related_workflow_id = Column(Integer, ForeignKey("governance_workflows.id"), nullable=True)
    related_campaign_id = Column(Integer, ForeignKey("governance_campaigns.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    read_at             = Column(DateTime, nullable=True)
