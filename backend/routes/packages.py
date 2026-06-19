from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from database import get_db
from models import AccessPackage, AccessPackageRole, RoleCatalogue
from package_service import (
    get_packages_with_roles,
    get_packages_for_role,
    detect_package_hygiene_issues
)
from routes.auth import get_current_user

router = APIRouter(prefix="/governance/packages", tags=["packages"])

VALID_STATUSES = {"active", "archived", "under_review"}


# ─────────────────────────────────────────────
# LIST PACKAGES
# ─────────────────────────────────────────────

@router.get("")
def list_packages(
    system_scope: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    packages = get_packages_with_roles(db, system_scope=system_scope)

    if risk_level:
        packages = [p for p in packages if p["risk_level"] == risk_level]
    if status:
        packages = [p for p in packages if p["status"] == status]

    return packages


# ─────────────────────────────────────────────
# GET SINGLE PACKAGE
# ─────────────────────────────────────────────

@router.get("/{package_id}")
def get_package(
    package_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pkg = db.query(AccessPackage).filter(
        AccessPackage.id == package_id
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    packages = get_packages_with_roles(db)
    match = next((p for p in packages if p["id"] == package_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Package not found")
    return match


# ─────────────────────────────────────────────
# GET PACKAGES FOR A ROLE
# ─────────────────────────────────────────────

@router.get("/by-role/{role_id}")
def packages_for_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = db.query(RoleCatalogue).filter(RoleCatalogue.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return get_packages_for_role(db, role_id=role_id)


# ─────────────────────────────────────────────
# PACKAGE HYGIENE DETECTION
# ─────────────────────────────────────────────

@router.get("/hygiene/scan")
def package_hygiene_scan(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return detect_package_hygiene_issues(db)


# ─────────────────────────────────────────────
# UPDATE PACKAGE
# ─────────────────────────────────────────────

@router.patch("/{package_id}")
def update_package(
    package_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pkg = db.query(AccessPackage).filter(
        AccessPackage.id == package_id
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    now = datetime.utcnow()

    if "status" in payload:
        if payload["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {payload['status']}"
            )
        pkg.status = payload["status"]

    if "governance_owner" in payload:
        pkg.governance_owner = payload["governance_owner"]

    if "risk_level" in payload:
        pkg.risk_level = payload["risk_level"]

    if "last_reviewed_date" in payload:
        pkg.last_reviewed_date = now

    pkg.updated_at = now
    db.commit()
    db.refresh(pkg)

    packages = get_packages_with_roles(db)
    match = next((p for p in packages if p["id"] == package_id), None)
    return match


# ─────────────────────────────────────────────
# PACKAGE SUMMARY STATS
# ─────────────────────────────────────────────

@router.get("/summary/pkg-overview")
def packages_overview(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from datetime import timedelta
    all_packages = db.query(AccessPackage).filter(
        AccessPackage.status != "archived"
    ).all()

    now = datetime.utcnow()
    stale_threshold = now - timedelta(days=90)

    total = len(all_packages)
    critical = sum(1 for p in all_packages if p.risk_level == "critical")
    ownerless = sum(
        1 for p in all_packages
        if not p.governance_owner or p.governance_owner.strip() == ""
    )
    stale = sum(
        1 for p in all_packages
        if p.last_reviewed_date is None or p.last_reviewed_date < stale_threshold
    )

    role_counts = []
    for pkg in all_packages:
        count = db.query(AccessPackageRole).filter(
            AccessPackageRole.package_id == pkg.id
        ).count()
        role_counts.append(count)

    orphaned = sum(1 for c in role_counts if c == 0)

    return {
        "total_packages": total,
        "critical_packages": critical,
        "ownerless_packages": ownerless,
        "stale_packages": stale,
        "orphaned_packages": orphaned,
    }
