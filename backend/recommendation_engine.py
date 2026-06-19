from sqlalchemy.orm import Session
from models import Employee, EmployeeAccess, AccessGroup

CONFIDENCE_THRESHOLD = 50

def recommend_access(team: str, role: str, db: Session) -> dict:
    peers = (
        db.query(Employee)
        .filter(
            Employee.current_team == team,
            Employee.role == role,
            Employee.employment_status == "active",
        )
        .all()
    )

    total = len(peers)

    if total == 0:
        return {
            "team": team,
            "role": role,
            "peer_count": 0,
            "recommended_access": [],
            "message": f"No existing employees found with team='{team}' and role='{role}'.",
        }

    group_counts: dict[int, int] = {}
    for peer in peers:
        for ea in peer.employee_access:
            group_counts[ea.group_id] = group_counts.get(ea.group_id, 0) + 1

    recommendations = []
    for group_id, count in group_counts.items():
        confidence = round((count / total) * 100)
        if confidence >= CONFIDENCE_THRESHOLD:
            group = db.query(AccessGroup).filter(AccessGroup.id == group_id).first()
            if group:
                recommendations.append(
                    {
                        "group": group.group_name,
                        "system": group.system_name,
                        "confidence": confidence,
                        "is_privileged": group.is_privileged,
                        "team_owner": group.team_owner,
                    }
                )

    recommendations.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "team": team,
        "role": role,
        "peer_count": total,
        "recommended_access": recommendations,
    }
