from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import GovernanceWorkflow, WorkflowTimelineEvent, Connector

# ─────────────────────────────────────────────
# SEED DEMO WORKFLOWS
# ─────────────────────────────────────────────

def seed_demo_workflows(db: Session):
    existing = db.query(GovernanceWorkflow).first()
    if existing:
        return

    now = datetime.utcnow()

    def get_connector_id(db, platform):
        c = db.query(Connector).filter(
            Connector.platform == platform,
            Connector.status == "active"
        ).first()
        return c.id if c else None

    sail_id = get_connector_id(db, "sailpoint")
    entra_id = get_connector_id(db, "entra")
    snow_id = get_connector_id(db, "servicenow")
    cyark_id = get_connector_id(db, "cyberark")

    demo_workflows = [
        {
            "workflow_type": "privileged_access_review",
            "source_type": "hygiene_cluster",
            "source_id": 1,
            "title": "Unused Privileged Roles — AWS",
            "description": "3 privileged AWS roles with zero assigned users detected. Governance review required.",
            "priority": "critical",
            "status": "open",
            "governance_owner": "Cloud Operations Manager",
            "governance_queue": "Critical Governance Queue",
            "connector_id": sail_id,
            "external_reference": "SAIL-AW9KP2XQ",
            "sla_days": 7,
            "created_at": now - timedelta(days=10),
            "due_date": now - timedelta(days=3),
            "escalation_level": 2,
            "escalated_at": now - timedelta(days=3),
            "escalation_target": "CISO / Security Director",
            "notes": "Auto-triggered from hygiene scan. Double SLA breach.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=10),
                 "Governance workflow auto-triggered. Priority: CRITICAL. Routed to SAILPOINT via SAIL-AW9KP2XQ."),
                ("sla_breach", "system", now - timedelta(days=3),
                 "SLA breach detected. 3 day(s) overdue. Escalated to governance queue."),
                ("sla_critical_breach", "system", now - timedelta(days=1),
                 "Critical SLA breach. 9 day(s) overdue. Escalated to CISO / Security Director."),
            ],
        },
        {
            "workflow_type": "owner_assignment",
            "source_type": "hygiene_cluster",
            "source_id": 2,
            "title": "Missing Governance Owner — GitHub",
            "description": "6 GitHub roles have no governance owner assigned. Ownership must be established.",
            "priority": "high",
            "status": "open",
            "governance_owner": "Engineering Platform Owner",
            "governance_queue": "Governance Review Queue",
            "connector_id": sail_id,
            "external_reference": "SAIL-GH3MT7YR",
            "sla_days": 14,
            "created_at": now - timedelta(days=16),
            "due_date": now - timedelta(days=2),
            "escalation_level": 1,
            "escalated_at": now - timedelta(days=2),
            "escalation_target": "IT Governance Lead",
            "notes": "Auto-triggered. Owner assignment pending.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=16),
                 "Governance workflow auto-triggered. Priority: HIGH. Routed to SAILPOINT via SAIL-GH3MT7YR."),
                ("owner_assigned", "analyst@accessmind.local", now - timedelta(days=14),
                 "Governance owner tentatively assigned: Engineering Platform Owner."),
                ("sla_breach", "system", now - timedelta(days=2),
                 "SLA breach detected. 2 day(s) overdue. Escalated to governance queue."),
            ],
        },
        {
            "workflow_type": "stale_review_remediation",
            "source_type": "hygiene_cluster",
            "source_id": 3,
            "title": "Stale Review — CyberArk PAM Roles",
            "description": "CyberArk PAM roles not reviewed in 400+ days. Immediate review required.",
            "priority": "critical",
            "status": "under_review",
            "governance_owner": "CyberArk Platform Admin",
            "governance_queue": "PAM Governance Queue",
            "connector_id": cyark_id,
            "external_reference": "CYARK-PM6VB4WS",
            "sla_days": 7,
            "created_at": now - timedelta(days=5),
            "due_date": now + timedelta(days=2),
            "first_reviewed_at": now - timedelta(days=3),
            "escalation_level": 0,
            "escalation_target": "CISO / Security Director",
            "notes": "Under review by PAM team.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=5),
                 "Governance workflow auto-triggered. Priority: CRITICAL. Routed to CYBERARK via CYARK-PM6VB4WS."),
                ("status_changed", "manager@accessmind.local", now - timedelta(days=3),
                 "Status updated to Under Review. CyberArk Platform Admin notified."),
            ],
        },
        {
            "workflow_type": "stale_access_remediation",
            "source_type": "finding",
            "source_id": 1,
            "title": "Stale Access: Marcus Johnson — Active Directory",
            "description": "Critical stale access finding. User retains domain admin rights post-role change.",
            "priority": "critical",
            "status": "open",
            "governance_owner": "",
            "governance_queue": "Access Remediation Queue",
            "connector_id": entra_id,
            "external_reference": "ENTRA-AD2NX8KL",
            "sla_days": 7,
            "created_at": now - timedelta(days=8),
            "due_date": now - timedelta(days=1),
            "escalation_level": 1,
            "escalated_at": now - timedelta(days=1),
            "escalation_target": "CISO / Security Director",
            "notes": "Auto-triggered from Critical finding. Awaiting owner assignment.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=8),
                 "Workflow auto-triggered from Critical finding. Routed to ENTRA via ENTRA-AD2NX8KL."),
                ("sla_breach", "system", now - timedelta(days=1),
                 "SLA breach detected. 1 day(s) overdue. Escalated to governance queue."),
            ],
        },
        {
            "workflow_type": "privileged_access_review",
            "source_type": "hygiene_cluster",
            "source_id": 4,
            "title": "Unused Privileged Roles — Microsoft Sentinel",
            "description": "2 Sentinel privileged roles unassigned for 90+ days.",
            "priority": "high",
            "status": "open",
            "governance_owner": "Security Operations Lead",
            "governance_queue": "Security Governance Queue",
            "connector_id": entra_id,
            "external_reference": "ENTRA-SN1QR5TM",
            "sla_days": 14,
            "created_at": now - timedelta(days=4),
            "due_date": now + timedelta(days=10),
            "escalation_level": 0,
            "escalation_target": "IT Governance Lead",
            "notes": "Auto-triggered. Within SLA.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=4),
                 "Governance workflow auto-triggered. Priority: HIGH. Routed to ENTRA via ENTRA-SN1QR5TM."),
            ],
        },
        {
            "workflow_type": "owner_assignment",
            "source_type": "hygiene_cluster",
            "source_id": 5,
            "title": "Missing Governance Owner — ServiceNow GRC",
            "description": "4 ServiceNow GRC roles lack governance ownership.",
            "priority": "high",
            "status": "owner_assigned",
            "governance_owner": "ITSM Platform Manager",
            "governance_queue": "ITSM Governance Queue",
            "connector_id": snow_id,
            "external_reference": "SNOW-GR8YK3PW",
            "sla_days": 14,
            "created_at": now - timedelta(days=20),
            "due_date": now - timedelta(days=6),
            "first_reviewed_at": now - timedelta(days=18),
            "escalation_level": 1,
            "escalated_at": now - timedelta(days=6),
            "escalation_target": "IT Governance Lead",
            "notes": "Owner assigned. Pending remediation routing.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=20),
                 "Governance workflow auto-triggered. Priority: HIGH. Routed to SERVICENOW via SNOW-GR8YK3PW."),
                ("sla_breach", "system", now - timedelta(days=6),
                 "SLA breach. Escalated to governance queue."),
                ("owner_assigned", "admin@accessmind.local", now - timedelta(days=5),
                 "Governance owner assigned: ITSM Platform Manager."),
            ],
        },
        {
            "workflow_type": "stale_review_remediation",
            "source_type": "hygiene_cluster",
            "source_id": 6,
            "title": "Stale Review — SAP ERP Finance Roles",
            "description": "SAP Finance roles overdue for access review by 180+ days.",
            "priority": "medium",
            "status": "remediation_in_progress",
            "governance_owner": "Head of Finance Technology",
            "governance_queue": "Finance Governance Queue",
            "connector_id": sail_id,
            "external_reference": "SAIL-SP4FC9NZ",
            "sla_days": 30,
            "created_at": now - timedelta(days=35),
            "due_date": now - timedelta(days=5),
            "first_reviewed_at": now - timedelta(days=30),
            "escalation_level": 1,
            "escalated_at": now - timedelta(days=5),
            "escalation_target": "Governance Queue Manager",
            "notes": "Remediation in progress via SailPoint.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=35),
                 "Governance workflow auto-triggered. Priority: MEDIUM. Routed to SAILPOINT via SAIL-SP4FC9NZ."),
                ("status_changed", "analyst@accessmind.local", now - timedelta(days=30),
                 "Status updated to Under Review."),
                ("sla_breach", "system", now - timedelta(days=5),
                 "SLA breach. Escalated to governance queue."),
                ("remediation_routed", "manager@accessmind.local", now - timedelta(days=2),
                 "Remediation routed to SailPoint IdentityNow. Reference: SAIL-SP4FC9NZ."),
            ],
        },
        {
            "workflow_type": "privileged_access_review",
            "source_type": "hygiene_cluster",
            "source_id": 7,
            "title": "Unused Privileged Roles — Okta IAM",
            "description": "Okta admin roles with no assigned users.",
            "priority": "high",
            "status": "resolved",
            "governance_owner": "Identity Platform Owner",
            "governance_queue": "IAM Governance Queue",
            "connector_id": None,
            "external_reference": "OKTA-IM7VR2CX",
            "sla_days": 14,
            "created_at": now - timedelta(days=30),
            "due_date": now - timedelta(days=16),
            "first_reviewed_at": now - timedelta(days=28),
            "resolved_at": now - timedelta(days=10),
            "escalation_level": 0,
            "escalation_target": "IT Governance Lead",
            "notes": "Resolved. Roles archived in Okta.",
            "events": [
                ("workflow_created", "system", now - timedelta(days=30),
                 "Governance workflow auto-triggered. Priority: HIGH."),
                ("status_changed", "admin@accessmind.local", now - timedelta(days=28),
                 "Status updated to Under Review."),
                ("status_changed", "admin@accessmind.local", now - timedelta(days=10),
                 "Workflow resolved. Roles confirmed archived in Okta IAM."),
            ],
        },
    ]

    for wf_data in demo_workflows:
        events = wf_data.pop("events")

        wf = GovernanceWorkflow(
            workflow_type=wf_data["workflow_type"],
            source_type=wf_data["source_type"],
            source_id=wf_data["source_id"],
            title=wf_data["title"],
            description=wf_data["description"],
            priority=wf_data["priority"],
            status=wf_data["status"],
            governance_owner=wf_data["governance_owner"],
            governance_queue=wf_data["governance_queue"],
            connector_id=wf_data["connector_id"],
            external_reference=wf_data["external_reference"],
            sla_days=wf_data["sla_days"],
            due_date=wf_data["due_date"],
            created_at=wf_data["created_at"],
            updated_at=now,
            first_reviewed_at=wf_data.get("first_reviewed_at"),
            escalated_at=wf_data.get("escalated_at"),
            resolved_at=wf_data.get("resolved_at"),
            escalation_level=wf_data["escalation_level"],
            escalation_target=wf_data["escalation_target"],
            notes=wf_data["notes"],
        )
        db.add(wf)
        db.flush()

        for event_type, actor, created_at, description in events:
            event = WorkflowTimelineEvent(
                workflow_id=wf.id,
                event_type=event_type,
                actor=actor,
                description=description,
                event_metadata={},
                created_at=created_at,
            )
            db.add(event)

    db.commit()
