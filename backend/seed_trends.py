"""
seed_trends.py — Phase 4D
Generates 30 days of synthetic governance trend snapshots.
Idempotent: skips if data already exists.
"""

from datetime import datetime, timedelta
import random
from database import SessionLocal
from models import GovernanceTrendSnapshot


def seed_trends():
    db = SessionLocal()
    try:
        existing = db.query(GovernanceTrendSnapshot).first()
        if existing:
            print("  [seed_trends] already seeded — skipping.")
            return

        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        snapshots = []

        # ── Platform-wide debt score (drifts from 52 → 67 over 30 days with noise)
        debt_base = 52.0
        for i in range(30):
            day = today - timedelta(days=29 - i)
            drift = (i / 29) * 15          # +15 over the month
            noise = random.uniform(-2, 2)
            value = round(min(100, debt_base + drift + noise), 1)
            snapshots.append(GovernanceTrendSnapshot(
                snapshot_date=day,
                metric_type="debt_score",
                metric_value=value,
                system_scope=None,
                governance_queue=None,
            ))

        # ── Open workflows (grows from 12 → 31, with a mid-month resolution dip)
        for i in range(30):
            day = today - timedelta(days=29 - i)
            if i < 12:
                value = 12 + i * 1.2
            elif i < 18:
                value = max(10, 26 - (i - 12) * 2.5)   # resolution sprint dip
            else:
                value = 16 + (i - 18) * 1.5
            value = round(value + random.uniform(-1, 1))
            snapshots.append(GovernanceTrendSnapshot(
                snapshot_date=day,
                metric_type="open_workflows",
                metric_value=max(0, value),
                system_scope=None,
                governance_queue=None,
            ))

        # ── Escalation count (low → spike at day 20 → still elevated)
        for i in range(30):
            day = today - timedelta(days=29 - i)
            if i < 15:
                value = random.randint(1, 4)
            elif i < 22:
                value = random.randint(6, 11)   # escalation spike
            else:
                value = random.randint(4, 8)
            snapshots.append(GovernanceTrendSnapshot(
                snapshot_date=day,
                metric_type="escalation_count",
                metric_value=value,
                system_scope=None,
                governance_queue=None,
            ))

        # ── Remediation throughput — workflows resolved in rolling 7-day window
        for i in range(30):
            day = today - timedelta(days=29 - i)
            if i < 10:
                value = random.randint(1, 3)
            elif i < 18:
                value = random.randint(4, 7)    # active resolution period
            else:
                value = random.randint(2, 5)
            snapshots.append(GovernanceTrendSnapshot(
                snapshot_date=day,
                metric_type="remediation_throughput",
                metric_value=value,
                system_scope=None,
                governance_queue=None,
            ))

        # ── Stale access count (slowly growing — governance backlog building)
        for i in range(30):
            day = today - timedelta(days=29 - i)
            value = round(18 + (i / 29) * 14 + random.uniform(-1.5, 1.5), 1)
            snapshots.append(GovernanceTrendSnapshot(
                snapshot_date=day,
                metric_type="stale_access_count",
                metric_value=max(0, value),
                system_scope=None,
                governance_queue=None,
            ))

        # ── Per-system debt scores (last 7 days only — for hotspot table)
        systems = [
            ("AWS",                  58, 12),
            ("CyberArk PAM",         72,  8),
            ("Active Directory",     61,  5),
            ("SAP ERP",              55,  9),
            ("Microsoft Sentinel",   48,  3),
            ("GitHub",               41,  6),
            ("ServiceNow ITSM",      37,  2),
        ]
        for sys_name, base_score, volatility in systems:
            for i in range(7):
                day = today - timedelta(days=6 - i)
                value = round(base_score + random.uniform(-volatility, volatility), 1)
                snapshots.append(GovernanceTrendSnapshot(
                    snapshot_date=day,
                    metric_type="debt_score",
                    metric_value=min(100, max(0, value)),
                    system_scope=sys_name,
                    governance_queue=None,
                ))

        # ── Per-queue open workflow counts (last 7 days)
        queues = [
            ("Cloud Governance Queue",    14),
            ("Identity Governance Queue",  8),
            ("PAM Governance Queue",       6),
            ("Finance Governance Queue",   5),
            ("Security Governance Queue",  9),
        ]
        for queue_name, base_count in queues:
            for i in range(7):
                day = today - timedelta(days=6 - i)
                value = max(0, base_count + random.randint(-2, 3))
                snapshots.append(GovernanceTrendSnapshot(
                    snapshot_date=day,
                    metric_type="open_workflows",
                    metric_value=value,
                    system_scope=None,
                    governance_queue=queue_name,
                ))

        db.bulk_save_objects(snapshots)
        db.commit()
        print(f"  [seed_trends] seeded {len(snapshots)} trend snapshots across 30 days.")

    except Exception as e:
        db.rollback()
        print(f"  [seed_trends] ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_trends()
