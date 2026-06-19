from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import GovernanceCampaign, CampaignReviewItem, RoleCatalogue, Employee

def seed_campaign_items(db: Session):
    existing = db.query(CampaignReviewItem).first()
    if existing:
        return

    now = datetime.utcnow()
    employees = db.query(Employee).limit(20).all()
    if not employees:
        return

    campaigns = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.status.in_(["active", "completed"])
    ).all()

    for campaign in campaigns:
        roles = db.query(RoleCatalogue)
        if campaign.campaign_type == "privileged_review":
            roles = roles.filter(RoleCatalogue.is_privileged == True)
        if campaign.target_system:
            roles = roles.filter(RoleCatalogue.application == campaign.target_system)
        roles = roles.limit(campaign.total_targets or 10).all()

        if not roles:
            roles = db.query(RoleCatalogue).limit(campaign.total_targets or 10).all()

        confirmed_needed = campaign.confirmed_count
        rejected_needed = campaign.rejected_count
        pending_needed = campaign.pending_count

        for i, role in enumerate(roles):
            emp = employees[i % len(employees)]

            if confirmed_needed > 0:
                status = "confirmed"
                reviewed_at = now - timedelta(days=3)
                confirmed_needed -= 1
            elif rejected_needed > 0:
                status = "rejected"
                reviewed_at = now - timedelta(days=2)
                rejected_needed -= 1
            elif pending_needed > 0:
                status = "pending"
                reviewed_at = None
                pending_needed -= 1
            else:
                status = "confirmed"
                reviewed_at = now - timedelta(days=1)

            item = CampaignReviewItem(
                campaign_id=campaign.id,
                employee_id=emp.id,
                role_id=role.id,
                assigned_to=role.approval_owner or getattr(emp, 'name', getattr(emp, 'full_name', 'Unassigned')),
                status=status,
                reviewed_at=reviewed_at,
                created_at=campaign.launched_at or now,
            )
            db.add(item)

    db.commit()
    print("[seed_campaign_items] Review items seeded.")
