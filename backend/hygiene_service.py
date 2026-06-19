import re
from datetime import datetime, date
from typing import List, Dict
from sqlalchemy.orm import Session

SYSTEM_GOVERNANCE_ROUTING: Dict[str, Dict[str, str]] = {
    "Active Directory": {"owner": "Identity & Access Manager", "queue": "IAM Governance Team", "escalation": "CISO"},
    "Microsoft Azure": {"owner": "Cloud Operations Manager", "queue": "Cloud Governance Team", "escalation": "VP Infrastructure"},
    "Amazon Web Services": {"owner": "Cloud Operations Manager", "queue": "Cloud Governance Team", "escalation": "VP Infrastructure"},
    "CyberArk PAM": {"owner": "PAM Governance Lead", "queue": "PAM Governance Team", "escalation": "CISO"},
    "SAP S/4HANA": {"owner": "ERP Security Governance Lead", "queue": "ERP Governance Team", "escalation": "CFO Office"},
    "Okta IAM": {"owner": "Identity & Access Manager", "queue": "IAM Governance Team", "escalation": "CISO"},
    "ServiceNow ITSM": {"owner": "ITSM Platform Owner", "queue": "Platform Governance Team", "escalation": "VP IT Operations"},
    "ServiceNow GRC": {"owner": "GRC Programme Manager", "queue": "GRC Governance Team", "escalation": "Chief Risk Officer"},
    "Splunk SIEM": {"owner": "Security Operations Manager", "queue": "SIEM Governance Team", "escalation": "CISO"},
    "GitHub Enterprise": {"owner": "Engineering Governance Lead", "queue": "DevOps Governance Team", "escalation": "VP Engineering"},
    "Jira Software": {"owner": "Engineering Governance Lead", "queue": "DevOps Governance Team", "escalation": "VP Engineering"},
    "Confluence": {"owner": "Engineering Governance Lead", "queue": "DevOps Governance Team", "escalation": "VP Engineering"},
    "Workday HCM": {"owner": "HR Systems Governance Lead", "queue": "HR Governance Team", "escalation": "CHRO"},
    "ADP Workforce Now": {"owner": "HR Systems Governance Lead", "queue": "HR Governance Team", "escalation": "CHRO"},
    "Microsoft Defender XDR": {"owner": "Security Operations Manager", "queue": "Security Governance Team", "escalation": "CISO"},
    "Microsoft Sentinel": {"owner": "Security Operations Manager", "queue": "Security Governance Team", "escalation": "CISO"},
    "CrowdStrike Falcon": {"owner": "Security Operations Manager", "queue": "Security Governance Team", "escalation": "CISO"},
    "Xero": {"owner": "Finance Systems Governance Lead", "queue": "Finance Governance Team", "escalation": "CFO"},
    "Greenhouse ATS": {"owner": "HR Systems Governance Lead", "queue": "HR Governance Team", "escalation": "CHRO"},
    "Terraform Cloud": {"owner": "Cloud Operations Manager", "queue": "DevOps Governance Team", "escalation": "VP Infrastructure"},
    "VMware vSphere": {"owner": "Infrastructure Governance Lead", "queue": "Infrastructure Governance Team", "escalation": "VP Infrastructure"},
    "Ansible Tower": {"owner": "Infrastructure Governance Lead", "queue": "DevOps Governance Team", "escalation": "VP Infrastructure"},
    "SharePoint Online": {"owner": "Collaboration Platform Owner", "queue": "M365 Governance Team", "escalation": "VP IT Operations"},
    "Microsoft Power BI": {"owner": "Data Governance Lead", "queue": "Data Governance Team", "escalation": "Chief Data Officer"},
    "RSA Archer": {"owner": "GRC Programme Manager", "queue": "GRC Governance Team", "escalation": "Chief Risk Officer"},
    "Cornerstone LMS": {"owner": "HR Systems Governance Lead", "queue": "HR Governance Team", "escalation": "CHRO"},
    "SolarWinds NPM": {"owner": "Infrastructure Governance Lead", "queue": "Infrastructure Governance Team", "escalation": "VP Infrastructure"},
    "Veeam Backup": {"owner": "Infrastructure Governance Lead", "queue": "Infrastructure Governance Team", "escalation": "VP Infrastructure"},
}

DEFAULT_ROUTING = {"owner": "IAM Governance Team", "queue": "IAM Governance Queue", "escalation": "CISO"}

DEBT_WEIGHTS = {
    "unused_privileged": 10,
    "missing_owner": 7,
    "stale_review_365": 5,
    "stale_review_180": 3,
    "stale_review_90": 2,
    "duplicate_variants": 3,
    "orphaned_roles": 2,
}

RECOMMENDATIONS = {
    "orphaned_roles": "Review and archive roles with no active assignments to reduce entitlement sprawl and unnecessary attack surface.",
    "missing_owner": "Assign governance owners to all roles to ensure accountability, review coverage, and clear escalation paths.",
    "unused_privileged": "Immediately review and revoke unused privileged entitlements. Unassigned privileged roles represent significant attack surface and audit risk.",
    "duplicate_variants": "Consolidate duplicate role variants into a unified role structure per system. Merge overlapping entitlements and retire legacy naming patterns.",
    "stale_review": "Schedule governance reviews for all overdue roles. Consider automated review reminder workflows to prevent future review debt accumulation.",
}


def get_routing(system_name: str) -> dict:
    return SYSTEM_GOVERNANCE_ROUTING.get(system_name, DEFAULT_ROUTING)


def normalize_role_name(name: str) -> str:
    n = name.lower()
    for suffix in ["-prd", "-prod", "-production", "-dev", "-development", "-test",
                   "-testing", "-uat", "-stg", "-staging", "-dr", "-sandbox"]:
        n = re.sub(rf"{re.escape(suffix)}$", "", n)
    for suffix in ["-readonly", "-read-only", "-readwrite", "-read-write", "-read",
                   "-ro", "-rw", "-reader", "-writer", "-viewer", "-view", "-admin",
                   "-administrator", "-full", "-full-access", "-contributor",
                   "-operator", "-write", "-execute", "-privileged", "-priv"]:
        n = re.sub(rf"{re.escape(suffix)}$", "", n)
    return n.strip("-_ ")


def _debt_for_cluster(cluster_type: str, count: int, max_stale_days: int = 0) -> int:
    if cluster_type == "unused_privileged":
        return DEBT_WEIGHTS["unused_privileged"] * count
    if cluster_type == "missing_owner":
        return DEBT_WEIGHTS["missing_owner"] * count
    if cluster_type == "duplicate_variants":
        return DEBT_WEIGHTS["duplicate_variants"] * count
    if cluster_type == "orphaned_roles":
        return DEBT_WEIGHTS["orphaned_roles"] * count
    if cluster_type == "stale_review":
        if max_stale_days >= 365:
            w = DEBT_WEIGHTS["stale_review_365"]
        elif max_stale_days >= 180:
            w = DEBT_WEIGHTS["stale_review_180"]
        else:
            w = DEBT_WEIGHTS["stale_review_90"]
        return w * count
    return 0


def _priority_for_missing_owner(count: int, has_privileged: bool) -> str:
    if has_privileged:
        return "critical"
    return "high"


def _priority_for_duplicates(count: int) -> str:
    return "high" if count >= 5 else "medium"


def _priority_for_stale(max_days: int) -> str:
    if max_days >= 365:
        return "high"
    if max_days >= 180:
        return "medium"
    return "low"


def run_hygiene_scan(db: Session) -> List[dict]:
    from models import RoleCatalogue

    roles = db.query(RoleCatalogue).all()
    today = datetime.utcnow().date()
    clusters: List[dict] = []

    by_system: Dict[str, list] = {}
    for r in roles:
        by_system.setdefault(r.application, []).append(r)

    for system_name, system_roles in by_system.items():
        routing = get_routing(system_name)

        # 1. Unused privileged
        unused_priv = [r for r in system_roles if r.is_privileged and (r.assigned_user_count or 0) == 0]
        if unused_priv:
            n = len(unused_priv)
            clusters.append({
                "cluster_type": "unused_privileged",
                "system_name": system_name,
                "title": f"{n} unused privileged {'role' if n == 1 else 'roles'} in {system_name}",
                "description": (
                    f"{'This privileged role has' if n == 1 else f'These {n} privileged roles have'} "
                    f"zero active assignments. Unassigned privileged entitlements represent "
                    f"significant attack surface and must be reviewed immediately."
                ),
                "affected_count": n,
                "affected_role_names": [r.role_name for r in unused_priv],
                "priority": "critical",
                "governance_owner": routing["owner"],
                "governance_queue": routing["queue"],
                "escalation_target": routing["escalation"],
                "recommendation": RECOMMENDATIONS["unused_privileged"],
                "status": "new",
                "governance_debt_score": _debt_for_cluster("unused_privileged", n),
            })

        # 2. Missing governance owners
        missing_owner = [r for r in system_roles if not r.approval_owner or r.approval_owner.strip() == ""]
        if missing_owner:
            n = len(missing_owner)
            has_priv = any(r.is_privileged for r in missing_owner)
            clusters.append({
                "cluster_type": "missing_owner",
                "system_name": system_name,
                "title": f"{n} {system_name} {'role lacks' if n == 1 else 'roles lack'} a governance owner",
                "description": (
                    "Roles without assigned governance owners create accountability gaps, "
                    "blind spots in review coverage, and unclear escalation paths."
                    + (" Includes privileged roles." if has_priv else "")
                ),
                "affected_count": n,
                "affected_role_names": [r.role_name for r in missing_owner],
                "priority": _priority_for_missing_owner(n, has_priv),
                "governance_owner": routing["owner"],
                "governance_queue": routing["queue"],
                "escalation_target": routing["escalation"],
                "recommendation": RECOMMENDATIONS["missing_owner"],
                "status": "new",
                "governance_debt_score": _debt_for_cluster("missing_owner", n),
            })

        # 3. Orphaned roles (non-privileged, zero assignments)
        orphaned = [r for r in system_roles if not r.is_privileged and (r.assigned_user_count or 0) == 0]
        if orphaned:
            n = len(orphaned)
            clusters.append({
                "cluster_type": "orphaned_roles",
                "system_name": system_name,
                "title": f"{n} orphaned {'role' if n == 1 else 'roles'} detected in {system_name}",
                "description": (
                    f"{'This role has' if n == 1 else f'These {n} roles have'} zero active assignments "
                    f"and no recent governance activity. Candidates for archival to reduce role catalogue clutter."
                ),
                "affected_count": n,
                "affected_role_names": [r.role_name for r in orphaned],
                "priority": "medium",
                "governance_owner": routing["owner"],
                "governance_queue": routing["queue"],
                "escalation_target": routing["escalation"],
                "recommendation": RECOMMENDATIONS["orphaned_roles"],
                "status": "new",
                "governance_debt_score": _debt_for_cluster("orphaned_roles", n),
            })

        # 4. Duplicate variants
        name_groups: Dict[str, list] = {}
        for r in system_roles:
            key = normalize_role_name(r.role_name)
            if key:
                name_groups.setdefault(key, []).append(r)

        dup_groups = {k: v for k, v in name_groups.items() if len(v) > 1}
        seen_ids: set = set()
        unique_dup_roles = []
        for group in dup_groups.values():
            for r in group:
                if r.id not in seen_ids:
                    seen_ids.add(r.id)
                    unique_dup_roles.append(r)

        if unique_dup_roles:
            n = len(unique_dup_roles)
            clusters.append({
                "cluster_type": "duplicate_variants",
                "system_name": system_name,
                "title": f"{n} duplicate role variants detected in {system_name}",
                "description": (
                    f"Role variants with overlapping names suggest entitlement sprawl and inconsistent role design. "
                    f"{len(dup_groups)} overlapping name {'group' if len(dup_groups) == 1 else 'groups'} identified."
                ),
                "affected_count": n,
                "affected_role_names": [r.role_name for r in unique_dup_roles],
                "priority": _priority_for_duplicates(n),
                "governance_owner": routing["owner"],
                "governance_queue": routing["queue"],
                "escalation_target": routing["escalation"],
                "recommendation": RECOMMENDATIONS["duplicate_variants"],
                "status": "new",
                "governance_debt_score": _debt_for_cluster("duplicate_variants", n),
            })

        # 5. Stale reviews
        stale = []
        never_reviewed = []
        for r in system_roles:
            if not r.last_reviewed_date:
                never_reviewed.append(r)
            elif (today - r.last_reviewed_date).days >= 90:
                stale.append(r)

        all_stale = stale + never_reviewed
        if all_stale:
            n = len(all_stale)
            stale_day_values = [(today - r.last_reviewed_date).days for r in stale if r.last_reviewed_date]
            max_days = max(stale_day_values) if stale_day_values else 999

            if never_reviewed:
                desc = (
                    f"{len(never_reviewed)} {'role has' if len(never_reviewed) == 1 else 'roles have'} never been reviewed."
                    + (f" An additional {len(stale)} {'role is' if len(stale) == 1 else 'roles are'} overdue." if stale else "")
                )
            elif max_days >= 365:
                desc = f"{n} {'role has' if n == 1 else 'roles have'} not been reviewed in over 365 days."
            elif max_days >= 180:
                desc = f"{n} {'role has' if n == 1 else 'roles have'} not been reviewed in over 180 days."
            else:
                desc = f"{n} {'role has' if n == 1 else 'roles have'} not been reviewed in over 90 days."

            clusters.append({
                "cluster_type": "stale_review",
                "system_name": system_name,
                "title": f"{n} {system_name} {'role is' if n == 1 else 'roles are'} overdue for governance review",
                "description": desc,
                "affected_count": n,
                "affected_role_names": [r.role_name for r in all_stale],
                "priority": _priority_for_stale(max_days),
                "governance_owner": routing["owner"],
                "governance_queue": routing["queue"],
                "escalation_target": routing["escalation"],
                "recommendation": RECOMMENDATIONS["stale_review"],
                "status": "new",
                "governance_debt_score": _debt_for_cluster("stale_review", n, max_days),
            })

    clusters.sort(key=lambda c: c["governance_debt_score"], reverse=True)
    return clusters


def upsert_clusters(db: Session, cluster_data: List[dict]) -> list:
    from models import GovernanceHygieneCluster

    result = []
    for data in cluster_data:
        existing = (
            db.query(GovernanceHygieneCluster)
            .filter(
                GovernanceHygieneCluster.cluster_type == data["cluster_type"],
                GovernanceHygieneCluster.system_name == data["system_name"],
            )
            .first()
        )
        if existing:
            existing.title = data["title"]
            existing.description = data["description"]
            existing.affected_count = data["affected_count"]
            existing.affected_role_names = data["affected_role_names"]
            existing.priority = data["priority"]
            existing.governance_owner = data["governance_owner"]
            existing.governance_queue = data["governance_queue"]
            existing.escalation_target = data["escalation_target"]
            existing.recommendation = data["recommendation"]
            existing.governance_debt_score = data["governance_debt_score"]
            existing.last_detected_at = datetime.utcnow()
            existing.updated_at = datetime.utcnow()
            result.append(existing)
        else:
            cluster = GovernanceHygieneCluster(**data, last_detected_at=datetime.utcnow())
            db.add(cluster)
            result.append(cluster)

    db.commit()
    return result


def get_debt_scores(db: Session) -> dict:
    from models import GovernanceHygieneCluster

    active_statuses = ["new", "under_review", "owner_assigned", "remediation_in_progress"]
    clusters = (
        db.query(GovernanceHygieneCluster)
        .filter(GovernanceHygieneCluster.status.in_(active_statuses))
        .all()
    )

    global_score = sum(c.governance_debt_score for c in clusters)

    by_system: Dict[str, int] = {}
    for c in clusters:
        by_system[c.system_name] = by_system.get(c.system_name, 0) + c.governance_debt_score

    system_scores = [
        {"system_name": k, "debt_score": v}
        for k, v in sorted(by_system.items(), key=lambda x: x[1], reverse=True)
    ]

    type_counts: Dict[str, int] = {}
    priority_counts: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for c in clusters:
        type_counts[c.cluster_type] = type_counts.get(c.cluster_type, 0) + 1
        priority_counts[c.priority] = priority_counts.get(c.priority, 0) + 1

    return {
        "global_score": global_score,
        "system_scores": system_scores[:10],
        "cluster_type_counts": type_counts,
        "priority_counts": priority_counts,
        "total_clusters": len(clusters),
        "total_affected_roles": sum(c.affected_count for c in clusters),
    }
