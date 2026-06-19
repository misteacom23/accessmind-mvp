"""
AccessMind — Phase 4B
Runs the hygiene detection engine and persists initial cluster data.
Run after seed_role_catalogue.py and seed_governance_roles.py
"""

from database import SessionLocal
from hygiene_service import run_hygiene_scan, upsert_clusters


def seed_hygiene_clusters():
    db = SessionLocal()
    try:
        from models import GovernanceHygieneCluster

        existing = db.query(GovernanceHygieneCluster).count()
        if existing > 0:
            print(f"[seed_hygiene] {existing} clusters already exist. Skipping.")
            return

        cluster_data = run_hygiene_scan(db)
        clusters = upsert_clusters(db, cluster_data)

        by_priority = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for c in clusters:
            by_priority[c.priority] = by_priority.get(c.priority, 0) + 1

        total_debt = sum(c.governance_debt_score for c in clusters)

        print(
            f"[seed_hygiene] Seeded {len(clusters)} hygiene clusters "
            f"(Critical: {by_priority['critical']}, High: {by_priority['high']}, "
            f"Medium: {by_priority['medium']}, Low: {by_priority['low']}). "
            f"Global Debt Score: {total_debt}"
        )

    except Exception as exc:
        db.rollback()
        print(f"[seed_hygiene] Error: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_hygiene_clusters()
