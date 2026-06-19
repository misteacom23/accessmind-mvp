from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import AccessPackage, AccessPackageRole, RoleCatalogue

# ─────────────────────────────────────────────
# PACKAGE HYGIENE DETECTION
# ─────────────────────────────────────────────

def detect_package_hygiene_issues(db: Session) -> dict:
    packages = db.query(AccessPackage).filter(
        AccessPackage.status != "archived"
    ).all()

    orphaned = []
    stale = []
    ownerless = []
    high_risk = []
    now = datetime.utcnow()
    stale_threshold = now - timedelta(days=90)

    for pkg in packages:
        role_count = db.query(AccessPackageRole).filter(
            AccessPackageRole.package_id == pkg.id
        ).count()

        if role_count == 0:
            orphaned.append(pkg.package_name)

        if not pkg.governance_owner or pkg.governance_owner.strip() == "":
            ownerless.append(pkg.package_name)

        if pkg.last_reviewed_date is None or pkg.last_reviewed_date < stale_threshold:
            stale.append(pkg.package_name)

        if pkg.risk_level == "critical" and (
            pkg.last_reviewed_date is None or pkg.last_reviewed_date < stale_threshold
        ):
            high_risk.append(pkg.package_name)

    return {
        "orphaned": orphaned,
        "stale": stale,
        "ownerless": ownerless,
        "high_risk": high_risk,
        "total_packages": len(packages),
        "issues_found": len(orphaned) + len(stale) + len(ownerless) + len(high_risk),
    }


# ─────────────────────────────────────────────
# GET PACKAGES WITH ROLE DETAIL
# ─────────────────────────────────────────────

def get_packages_with_roles(db: Session, system_scope: str = None) -> list:
    query = db.query(AccessPackage).filter(AccessPackage.status != "archived")
    if system_scope:
        query = query.filter(AccessPackage.system_scope == system_scope)

    packages = query.all()
    result = []

    for pkg in packages:
        package_roles = db.query(AccessPackageRole).filter(
            AccessPackageRole.package_id == pkg.id
        ).all()

        role_ids = [pr.role_id for pr in package_roles]
        roles = db.query(RoleCatalogue).filter(
            RoleCatalogue.id.in_(role_ids)
        ).all() if role_ids else []

        now = datetime.utcnow()
        stale_threshold = now - timedelta(days=90)
        is_stale = (
            pkg.last_reviewed_date is None or
            pkg.last_reviewed_date < stale_threshold
        )

        result.append({
            "id": pkg.id,
            "package_name": pkg.package_name,
            "description": pkg.description,
            "governance_owner": pkg.governance_owner,
            "risk_level": pkg.risk_level,
            "system_scope": pkg.system_scope,
            "status": pkg.status,
            "is_stale": is_stale,
            "last_reviewed_date": pkg.last_reviewed_date.isoformat() if pkg.last_reviewed_date else None,
            "role_count": len(roles),
            "roles": [
                {
                    "id": r.id,
                    "role_name": r.role_name,
                    "application": r.application,
                    "is_privileged": r.is_privileged,
                    "access_type": r.access_type,
                }
                for r in roles
            ],
            "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
        })

    return result


# ─────────────────────────────────────────────
# GET PACKAGES FOR A SPECIFIC ROLE
# ─────────────────────────────────────────────

def get_packages_for_role(db: Session, role_id: int) -> list:
    package_roles = db.query(AccessPackageRole).filter(
        AccessPackageRole.role_id == role_id
    ).all()

    package_ids = [pr.package_id for pr in package_roles]
    if not package_ids:
        return []

    packages = db.query(AccessPackage).filter(
        AccessPackage.id.in_(package_ids)
    ).all()

    return [
        {
            "id": p.id,
            "package_name": p.package_name,
            "risk_level": p.risk_level,
            "system_scope": p.system_scope,
            "governance_owner": p.governance_owner,
        }
        for p in packages
    ]


# ─────────────────────────────────────────────
# SEED DEMO PACKAGES
# ─────────────────────────────────────────────

def seed_demo_packages(db: Session):
    existing = db.query(AccessPackage).first()
    if existing:
        return

    now = datetime.utcnow()

    demo_packages = [
        {
            "package_name": "Finance-Analyst-Package",
            "description": "Standard access bundle for Finance Analysts covering ERP, project tracking, and collaboration tools.",
            "governance_owner": "Head of Finance Technology",
            "risk_level": "medium",
            "system_scope": "SAP ERP",
            "last_reviewed_date": now - timedelta(days=45),
            "status": "active",
            "role_names": ["SAP-Finance-Read", "Jira-Finance"],
        },
        {
            "package_name": "Cloud-Ops-Admin-Package",
            "description": "Elevated administrative access for Cloud Operations engineers. Includes production deployment rights.",
            "governance_owner": "Cloud Operations Manager",
            "risk_level": "critical",
            "system_scope": "AWS",
            "last_reviewed_date": now - timedelta(days=210),
            "status": "active",
            "role_names": ["AWS-Admin", "Terraform-Deploy", "GitHub-Org-Admin"],
        },
        {
            "package_name": "HR-Manager-Package",
            "description": "HR management access including employee data, payroll view, and Workday administration.",
            "governance_owner": "HRIS Platform Owner",
            "risk_level": "high",
            "system_scope": "Workday",
            "last_reviewed_date": now - timedelta(days=95),
            "status": "active",
            "role_names": ["Workday-HR-Admin"],
        },
        {
            "package_name": "Security-Ops-Package",
            "description": "Security operations tooling access for SOC analysts including SIEM and endpoint detection.",
            "governance_owner": "Security Operations Lead",
            "risk_level": "critical",
            "system_scope": "Microsoft Sentinel",
            "last_reviewed_date": now - timedelta(days=30),
            "status": "active",
            "role_names": ["Sentinel-Reader", "Defender-Analyst"],
        },
        {
            "package_name": "Dev-Standard-Package",
            "description": "Standard developer access for engineering teams. Source control, CI/CD, and project management.",
            "governance_owner": "Engineering Platform Owner",
            "risk_level": "low",
            "system_scope": "GitHub",
            "last_reviewed_date": now - timedelta(days=20),
            "status": "active",
            "role_names": ["GitHub-Developer", "Jira-Developer"],
        },
        {
            "package_name": "Legacy-Reporting-Package",
            "description": "Deprecated reporting bundle. Pending migration to new BI platform.",
            "governance_owner": "",
            "risk_level": "medium",
            "system_scope": "SAP ERP",
            "last_reviewed_date": None,
            "status": "active",
            "role_names": [],
        },
        {
            "package_name": "PAM-Vault-Admin-Package",
            "description": "CyberArk vault administration and privileged session management.",
            "governance_owner": "CyberArk Platform Admin",
            "risk_level": "critical",
            "system_scope": "CyberArk PAM",
            "last_reviewed_date": now - timedelta(days=400),
            "status": "active",
            "role_names": ["CyberArk-Vault-Admin"],
        },
        {
            "package_name": "ITSM-Analyst-Package",
            "description": "ServiceNow ITSM access for IT service desk analysts.",
            "governance_owner": "ITSM Platform Manager",
            "risk_level": "low",
            "system_scope": "ServiceNow ITSM",
            "last_reviewed_date": now - timedelta(days=60),
            "status": "active",
            "role_names": ["ServiceNow-ITSM-Analyst"],
        },
    ]

    for pkg_data in demo_packages:
        role_names = pkg_data.pop("role_names")

        pkg = AccessPackage(
            package_name=pkg_data["package_name"],
            description=pkg_data["description"],
            governance_owner=pkg_data["governance_owner"],
            risk_level=pkg_data["risk_level"],
            system_scope=pkg_data["system_scope"],
            last_reviewed_date=pkg_data["last_reviewed_date"],
            status=pkg_data["status"],
            stale_finding_count=0,
            created_at=now,
            updated_at=now,
        )
        db.add(pkg)
        db.flush()

        for role_name in role_names:
            role = db.query(RoleCatalogue).filter(
                RoleCatalogue.role_name == role_name
            ).first()
            if role:
                link = AccessPackageRole(
                    package_id=pkg.id,
                    role_id=role.id,
                    added_at=now,
                )
                db.add(link)

    db.commit()
    run_package_intelligence(db)


# ─────────────────────────────────────────────
# PHASE 4D — PACKAGE INTELLIGENCE
# ─────────────────────────────────────────────

def compute_risk_score(db: Session, pkg: AccessPackage) -> int:
    """
    Weighted risk score 0–100 for a package.
    Components:
      - Base risk level:       critical=40, high=25, medium=15, low=5
      - Stale review penalty:  +20 if >90 days, +30 if >180 days, +40 if >365 days
      - Missing owner penalty: +20
      - Orphaned (no roles):   +15
      - Privileged roles:      +5 per privileged role (max +20)
    """
    score = {"critical": 40, "high": 25, "medium": 15, "low": 5}.get(
        pkg.risk_level or "low", 5
    )

    now = datetime.utcnow()
    if pkg.last_reviewed_date is None:
        score += 40
    else:
        days_stale = (now - pkg.last_reviewed_date).days
        if days_stale > 365:
            score += 40
        elif days_stale > 180:
            score += 30
        elif days_stale > 90:
            score += 20

    if not pkg.governance_owner or pkg.governance_owner.strip() == "":
        score += 20

    package_roles = db.query(AccessPackageRole).filter(
        AccessPackageRole.package_id == pkg.id
    ).all()
    role_ids = [pr.role_id for pr in package_roles]

    if not role_ids:
        score += 15
    else:
        roles = db.query(RoleCatalogue).filter(
            RoleCatalogue.id.in_(role_ids)
        ).all()
        privileged_count = sum(1 for r in roles if r.is_privileged)
        score += min(20, privileged_count * 5)

    return min(100, score)


def detect_overlaps(db: Session) -> dict[int, bool]:
    """
    Two packages overlap if they share more than 50% of the same roles.
    Returns a dict of {package_id: True/False}.
    """
    packages = db.query(AccessPackage).filter(
        AccessPackage.status != "archived"
    ).all()

    pkg_role_sets: dict[int, set] = {}
    for pkg in packages:
        links = db.query(AccessPackageRole).filter(
            AccessPackageRole.package_id == pkg.id
        ).all()
        pkg_role_sets[pkg.id] = {l.role_id for l in links}

    overlap_flags: dict[int, bool] = {pkg.id: False for pkg in packages}

    pkg_ids = list(pkg_role_sets.keys())
    for i in range(len(pkg_ids)):
        for j in range(i + 1, len(pkg_ids)):
            a, b = pkg_ids[i], pkg_ids[j]
            roles_a, roles_b = pkg_role_sets[a], pkg_role_sets[b]
            if not roles_a or not roles_b:
                continue
            intersection = roles_a & roles_b
            smaller = min(len(roles_a), len(roles_b))
            if smaller > 0 and len(intersection) / smaller > 0.5:
                overlap_flags[a] = True
                overlap_flags[b] = True

    return overlap_flags


def detect_duplicates(db: Session) -> dict[int, bool]:
    """
    Two packages are duplicates if they share the same system_scope + risk_level
    AND overlap by more than 80% of roles.
    Returns a dict of {package_id: True/False}.
    """
    packages = db.query(AccessPackage).filter(
        AccessPackage.status != "archived"
    ).all()

    pkg_role_sets: dict[int, set] = {}
    for pkg in packages:
        links = db.query(AccessPackageRole).filter(
            AccessPackageRole.package_id == pkg.id
        ).all()
        pkg_role_sets[pkg.id] = {l.role_id for l in links}

    duplicate_flags: dict[int, bool] = {pkg.id: False for pkg in packages}

    for i in range(len(packages)):
        for j in range(i + 1, len(packages)):
            a, b = packages[i], packages[j]
            if a.system_scope != b.system_scope:
                continue
            if a.risk_level != b.risk_level:
                continue
            roles_a, roles_b = pkg_role_sets[a.id], pkg_role_sets[b.id]
            if not roles_a or not roles_b:
                continue
            intersection = roles_a & roles_b
            smaller = min(len(roles_a), len(roles_b))
            if smaller > 0 and len(intersection) / smaller > 0.8:
                duplicate_flags[a.id] = True
                duplicate_flags[b.id] = True

    return duplicate_flags


def run_package_intelligence(db: Session) -> dict:
    """
    Runs all three intelligence passes and writes results to the database.
    Called after seeding and from the hygiene scan endpoint.
    Returns a summary of findings.
    """
    packages = db.query(AccessPackage).filter(
        AccessPackage.status != "archived"
    ).all()

    overlap_flags   = detect_overlaps(db)
    duplicate_flags = detect_duplicates(db)

    overlap_count   = 0
    duplicate_count = 0

    for pkg in packages:
        pkg.risk_score     = compute_risk_score(db, pkg)
        pkg.overlap_flag   = overlap_flags.get(pkg.id, False)
        pkg.duplicate_flag = duplicate_flags.get(pkg.id, False)
        if pkg.overlap_flag:
            overlap_count += 1
        if pkg.duplicate_flag:
            duplicate_count += 1

    db.commit()
    print(f"  [package_intelligence] scored {len(packages)} packages — "
          f"{overlap_count} overlaps, {duplicate_count} duplicates detected.")
    return {
        "packages_scored": len(packages),
        "overlaps":        overlap_count,
        "duplicates":      duplicate_count,
    }
