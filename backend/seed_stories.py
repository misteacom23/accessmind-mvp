"""
seed_stories.py — Phase 4D
Seeds three governance narrative arcs into governance_stories.
Links to existing governance_workflows via story_key.
Idempotent: skips if stories already exist.
"""

from datetime import datetime
from database import SessionLocal
from models import GovernanceStory, GovernanceWorkflow


STORIES = [
    {
        "story_key":   "engineer_team_move",
        "story_title": "Engineer Team Transfer — Stale Privileged Access",
        "story_phase": "escalation",
        "description": (
            "Marcus Johnson moved from Cloud Engineering to the SRE team 47 days ago. "
            "His AWS Administrator and Terraform production access was never revoked. "
            "AccessMind detected the stale entitlements during the weekly hygiene scan, "
            "auto-triggered a governance workflow, and escalated after the 14-day SLA "
            "was breached with no action from the assigned governance owner. "
            "The workflow is now routed to SailPoint IdentityNow for remediation."
        ),
    },
    {
        "story_key":   "cyberark_orphaned_safe",
        "story_title": "CyberArk PAM Safe — Missing Governance Owner",
        "story_phase": "detection",
        "description": (
            "A CyberArk privileged access safe containing 14 shared service accounts "
            "has no active governance owner — the original owner left the organisation "
            "91 days ago. AccessMind flagged this as a critical orphaned-owner cluster "
            "during hygiene analysis. A governance workflow was created and assigned to "
            "the PAM Governance Queue. A recertification campaign is pending launch to "
            "confirm whether the accounts are still required."
        ),
    },
    {
        "story_key":   "aws_package_sprawl",
        "story_title": "AWS Admin Package Sprawl — Duplicate Entitlement Paths",
        "story_phase": "detection",
        "description": (
            "Three overlapping access packages grant AWS Administrator-equivalent "
            "permissions through different role combinations: Cloud-Ops-Admin-Package, "
            "a legacy Dev-Ops-Admin bundle, and an ungoverned ad-hoc group. "
            "AccessMind detected the duplication during package hygiene analysis — "
            "governance debt increased 8 points. A consolidation recommendation has "
            "been generated and is pending governance owner review."
        ),
    },
]


def seed_stories():
    db = SessionLocal()
    try:
        existing = db.query(GovernanceStory).first()
        if existing:
            print("  [seed_stories] already seeded — skipping.")
            return

        # ── Insert story records
        story_objects = []
        for s in STORIES:
            story_objects.append(GovernanceStory(
                story_key=s["story_key"],
                story_title=s["story_title"],
                story_phase=s["story_phase"],
                description=s["description"],
                is_active=True,
                created_at=datetime.utcnow(),
            ))
        db.add_all(story_objects)
        db.flush()

        # ── Link workflows to stories via story_key
        # Story 1: Marcus Johnson stale access workflow (workflow title contains "Marcus")
        marcus_wf = db.query(GovernanceWorkflow).filter(
            GovernanceWorkflow.title.ilike("%Marcus%")
        ).first()
        if marcus_wf:
            marcus_wf.story_key = "engineer_team_move"

        # Story 2: CyberArk stale review workflow
        cyberark_wf = db.query(GovernanceWorkflow).filter(
            GovernanceWorkflow.title.ilike("%CyberArk%")
        ).first()
        if cyberark_wf:
            cyberark_wf.story_key = "cyberark_orphaned_safe"

        # Story 3: AWS unused privileged roles workflow
        aws_wf = db.query(GovernanceWorkflow).filter(
            GovernanceWorkflow.title.ilike("%AWS%")
        ).first()
        if aws_wf:
            aws_wf.story_key = "aws_package_sprawl"

        db.commit()

        linked = sum([
            1 if marcus_wf else 0,
            1 if cyberark_wf else 0,
            1 if aws_wf else 0,
        ])
        print(f"  [seed_stories] seeded {len(STORIES)} stories, linked {linked} workflows.")

    except Exception as e:
        db.rollback()
        print(f"  [seed_stories] ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_stories()
