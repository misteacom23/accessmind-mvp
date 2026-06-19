from datetime import date, timedelta
from database import SessionLocal
from models import RoleCatalogue


def seed_governance_roles():
    db = SessionLocal()
    try:
        sentinel = db.query(RoleCatalogue).filter(
            RoleCatalogue.role_name == "Splunk-ReadOnly-Legacy"
        ).first()
        if sentinel:
            print("[seed_governance_roles] Already seeded. Skipping.")
            return

        today = date.today()

        demo_roles = [
            # Unused Privileged — CyberArk (CRITICAL)
            RoleCatalogue(role_name="CyberArk-VaultAdmin-DR",
                application="CyberArk PAM", environment="PRD", access_type="Privileged Admin",
                description="Disaster recovery vault admin — rarely activated",
                is_privileged=True, owner_team="PAM Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=290), assigned_user_count=0),
            RoleCatalogue(role_name="CyberArk-BreakGlass-Emergency",
                application="CyberArk PAM", environment="PRD", access_type="Privileged Admin",
                description="Break-glass emergency admin access",
                is_privileged=True, owner_team="PAM Governance Team", approval_owner="PAM Governance Lead",
                last_reviewed_date=today - timedelta(days=210), assigned_user_count=0),
            # Unused Privileged — Azure (CRITICAL)
            RoleCatalogue(role_name="Azure-GlobalAdmin-BreakGlass",
                application="Microsoft Azure", environment="PRD", access_type="Privileged Admin",
                description="Global admin break-glass — emergency use only",
                is_privileged=True, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=310), assigned_user_count=0),
            RoleCatalogue(role_name="Azure-SubscriptionOwner-Legacy",
                application="Microsoft Azure", environment="PRD", access_type="Privileged Admin",
                description="Legacy subscription owner from deprecated project team",
                is_privileged=True, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=460), assigned_user_count=0),
            # Unused Privileged — Active Directory (CRITICAL)
            RoleCatalogue(role_name="AD-DomainAdmin-Legacy",
                application="Active Directory", environment="PRD", access_type="Privileged Admin",
                description="Legacy domain admin — unused since team restructure",
                is_privileged=True, owner_team="IAM Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=430), assigned_user_count=0),
            # Missing Owners — AWS (HIGH)
            RoleCatalogue(role_name="AWS-S3-ReadOnly-Legacy",
                application="Amazon Web Services", environment="PRD", access_type="Read Only",
                description="Legacy S3 read-only — original owner left organisation",
                is_privileged=False, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=400), assigned_user_count=0),
            RoleCatalogue(role_name="AWS-EC2-Operator-Old",
                application="Amazon Web Services", environment="PRD", access_type="Operator",
                description="Old EC2 operator from previous infrastructure team",
                is_privileged=False, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=320), assigned_user_count=0),
            RoleCatalogue(role_name="AWS-CloudWatch-Viewer",
                application="Amazon Web Services", environment="PRD", access_type="Read Only",
                description="CloudWatch read access — monitoring team",
                is_privileged=False, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=150), assigned_user_count=3),
            RoleCatalogue(role_name="AWS-IAM-ReadOnly",
                application="Amazon Web Services", environment="PRD", access_type="Read Only",
                description="IAM read-only for audit purposes",
                is_privileged=False, owner_team="Cloud Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=200), assigned_user_count=2),
            # Duplicate Variants — Splunk (MEDIUM/HIGH)
            RoleCatalogue(role_name="Splunk-Read",
                application="Splunk SIEM", environment="PRD", access_type="Read Only",
                description="Splunk read access",
                is_privileged=False, owner_team="SIEM Governance Team", approval_owner="Security Operations Manager",
                last_reviewed_date=today - timedelta(days=120), assigned_user_count=4),
            RoleCatalogue(role_name="Splunk-ReadOnly-Legacy",
                application="Splunk SIEM", environment="PRD", access_type="Read Only",
                description="Splunk read-only — legacy naming convention",
                is_privileged=False, owner_team="SIEM Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=260), assigned_user_count=1),
            RoleCatalogue(role_name="Splunk-RO",
                application="Splunk SIEM", environment="PRD", access_type="Read Only",
                description="Splunk RO — oldest naming convention, pre-standardisation",
                is_privileged=False, owner_team="SIEM Governance Team", approval_owner="",
                last_reviewed_date=None, assigned_user_count=0),
            RoleCatalogue(role_name="Splunk-Reader-PRD",
                application="Splunk SIEM", environment="PRD", access_type="Read Only",
                description="Splunk reader production variant",
                is_privileged=False, owner_team="SIEM Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=390), assigned_user_count=2),
            # Duplicate Variants — GitHub
            RoleCatalogue(role_name="GitHub-ReadOnly",
                application="GitHub Enterprise", environment="PRD", access_type="Read Only",
                description="GitHub read-only access",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="Engineering Governance Lead",
                last_reviewed_date=today - timedelta(days=95), assigned_user_count=8),
            RoleCatalogue(role_name="GitHub-Read",
                application="GitHub Enterprise", environment="PRD", access_type="Read Only",
                description="GitHub read access — legacy name",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=310), assigned_user_count=2),
            RoleCatalogue(role_name="GitHub-RO",
                application="GitHub Enterprise", environment="PRD", access_type="Read Only",
                description="GitHub RO — oldest naming standard",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="",
                last_reviewed_date=None, assigned_user_count=0),
            # Duplicate Variants — Jira
            RoleCatalogue(role_name="Jira-ReadOnly",
                application="Jira Software", environment="PRD", access_type="Read Only",
                description="Jira read-only access",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="Engineering Governance Lead",
                last_reviewed_date=today - timedelta(days=80), assigned_user_count=6),
            RoleCatalogue(role_name="Jira-RO-Legacy",
                application="Jira Software", environment="PRD", access_type="Read Only",
                description="Legacy Jira read-only",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=200), assigned_user_count=0),
            # Stale Reviews — SAP
            RoleCatalogue(role_name="SAP-FI-Viewer",
                application="SAP S/4HANA", environment="PRD", access_type="Read Only",
                description="SAP Finance viewer role",
                is_privileged=False, owner_team="ERP Governance Team", approval_owner="ERP Security Governance Lead",
                last_reviewed_date=today - timedelta(days=410), assigned_user_count=6),
            RoleCatalogue(role_name="SAP-MM-Reader",
                application="SAP S/4HANA", environment="PRD", access_type="Read Only",
                description="SAP Materials Management read access",
                is_privileged=False, owner_team="ERP Governance Team", approval_owner="ERP Security Governance Lead",
                last_reviewed_date=today - timedelta(days=500), assigned_user_count=4),
            RoleCatalogue(role_name="SAP-HR-ReadOnly",
                application="SAP S/4HANA", environment="PRD", access_type="Read Only",
                description="SAP HR module read access",
                is_privileged=False, owner_team="ERP Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=380), assigned_user_count=3),
            # Stale Reviews — ServiceNow
            RoleCatalogue(role_name="SNOW-Approver-Extended",
                application="ServiceNow ITSM", environment="PRD", access_type="Approver",
                description="Extended approver access — original team restructured",
                is_privileged=False, owner_team="Platform Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=195), assigned_user_count=3),
            RoleCatalogue(role_name="SNOW-ITSM-ReadOnly-Ext",
                application="ServiceNow ITSM", environment="PRD", access_type="Read Only",
                description="External read-only access for contractor view",
                is_privileged=False, owner_team="Platform Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=250), assigned_user_count=1),
            # Orphaned — Terraform
            RoleCatalogue(role_name="Terraform-Runner-Legacy",
                application="Terraform Cloud", environment="PRD", access_type="Operator",
                description="Legacy Terraform runner — old pipeline",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="",
                last_reviewed_date=today - timedelta(days=270), assigned_user_count=0),
            RoleCatalogue(role_name="Terraform-ReadOnly-Old",
                application="Terraform Cloud", environment="PRD", access_type="Read Only",
                description="Terraform read-only — deprecated access pattern",
                is_privileged=False, owner_team="DevOps Governance Team", approval_owner="",
                last_reviewed_date=None, assigned_user_count=0),
        ]

        for role in demo_roles:
            db.add(role)
        db.commit()
        print(f"[seed_governance_roles] Seeded {len(demo_roles)} governance demo roles.")

    except Exception as exc:
        db.rollback()
        print(f"[seed_governance_roles] Error: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_governance_roles()
