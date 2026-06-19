from sqlalchemy.orm import Session
from models import Employee, EmployeeAccess, AccessGroup, Finding
from risk_service import calculate_stale_access_risk


def detect_movers(db: Session) -> dict:
    movers = (
        db.query(Employee)
        .filter(
            Employee.previous_team.isnot(None),
            Employee.employment_status == "active",
        )
        .all()
    )

    new_findings_created = 0

    for emp in movers:
        for ea in emp.employee_access:
            group: AccessGroup = ea.group

            if group.team_owner != emp.previous_team:
                continue

            # Use centralised risk engine
            risk_level = calculate_stale_access_risk(group, emp.current_team, emp.previous_team)

            reason = (
                f"{emp.name} transferred from {emp.previous_team} to {emp.current_team} "
                f"but still holds '{group.group_name}' which is owned by {emp.previous_team}."
            )
            recommendation = (
                f"Remove '{group.group_name}' — this access is no longer required "
                f"following the team transfer to {emp.current_team}."
            )

            exists = (
                db.query(Finding)
                .filter(
                    Finding.employee_id == emp.id,
                    Finding.reason == reason,
                    Finding.status.in_(["Open", "Under Review"]),
                )
                .first()
            )
            if exists:
                continue

            finding = Finding(
                employee_id=emp.id,
                finding_type="stale_access",
                risk_level=risk_level,
                reason=reason,
                recommendation=recommendation,
                status="Open",
            )
            db.add(finding)
            new_findings_created += 1

    db.commit()

    open_findings = (
        db.query(Finding)
        .filter(
            Finding.finding_type == "stale_access",
            Finding.status.in_(["Open", "Under Review"]),
        )
        .all()
    )

    results = []
    for f in open_findings:
        emp = f.employee
        results.append({
            "finding_id": f.id,
            "employee_id": emp.id,
            "employee_name": emp.name,
            "current_team": emp.current_team,
            "previous_team": emp.previous_team,
            "risk_level": f.risk_level,
            "reason": f.reason,
            "recommendation": f.recommendation,
            "status": f.status,
        })

    return {
        "new_findings_created": new_findings_created,
        "total_open_mover_findings": len(results),
        "findings": results,
    }
