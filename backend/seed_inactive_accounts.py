"""
seed_inactive_accounts.py
--------------------------
Seeds 'inactive_account' findings — employees with no login activity
for 45+ days who still retain active access. This is a separate
detection category from stale_access (which covers team transfers).

Idempotent: skips if inactive_account findings already exist.
"""
from datetime import datetime, timezone, timedelta
import random

from database import SessionLocal
from models import Employee, Finding

# Employee name -> (days inactive, system holding the risky access, access group)
# Picked from across teams so the finding type appears in multiple departments.
INACTIVE_PROFILES = [
    {"days": 67,  "system": "Microsoft Entra ID", "access": "Cyber-Security-SharePoint", "risk": "High"},
    {"days": 52,  "system": "AWS",                "access": "AWS-Developer-UAT",          "risk": "Medium"},
    {"days": 91,  "system": "CyberArk PAM",        "access": "CyberArk-Vault-Operator",    "risk": "Critical"},
    {"days": 48,  "system": "SAP ERP",             "access": "Finance-Analyst-Package",    "risk": "Medium"},
    {"days": 73,  "system": "ServiceNow ITSM",     "access": "ServiceNow-Admin-Console",   "risk": "High"},
]

def seed_inactive_accounts():
    db = SessionLocal()
    try:
        existing = db.query(Finding).filter(Finding.finding_type == "inactive_account").first()
        if existing:
            print("  [seed_inactive_accounts] already seeded — skipping.")
            return

        # Pull a handful of active employees to attach inactive findings to.
        # Use employees not already heavily featured in stale_access findings
        # for variety — just grab the first N active employees.
        employees = (
            db.query(Employee)
            .filter(Employee.employment_status == "active")
            .order_by(Employee.id)
            .limit(len(INACTIVE_PROFILES))
            .all()
        )

        if not employees:
            print("  [seed_inactive_accounts] no active employees found — skipping.")
            return

        now = datetime.now(timezone.utc)
        created = 0

        for emp, profile in zip(employees, INACTIVE_PROFILES):
            days = profile["days"]
            reason = (
                f"{emp.name} has not logged in for {days} days but still holds active "
                f"'{profile['access']}' access in {profile['system']}. No login activity "
                f"detected since account was provisioned for current role."
            )
            recommendation = (
                f"Review '{profile['access']}' access for {emp.name} — account shows no "
                f"login activity in {days} days. Consider revoking access or confirming "
                f"continued business need with the employee's manager."
            )
            finding = Finding(
                employee_id=emp.id,
                finding_type="inactive_account",
                risk_level=profile["risk"],
                reason=reason,
                recommendation=recommendation,
                status="Open",
                created_at=now - timedelta(days=random.randint(1, 10)),
                updated_at=now - timedelta(days=random.randint(1, 10)),
            )
            db.add(finding)
            created += 1

        db.commit()
        print(f"  [seed_inactive_accounts] seeded {created} inactive_account findings.")

    except Exception as e:
        db.rollback()
        print(f"  [seed_inactive_accounts] ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_inactive_accounts()
