from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Employee

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/")
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).filter(Employee.employment_status == "active").all()
    result = []
    for emp in employees:
        access = [
            {
                "group_name": ea.group.group_name,
                "system_name": ea.group.system_name,
                "team_owner": ea.group.team_owner,
                "is_privileged": ea.group.is_privileged,
            }
            for ea in emp.employee_access
        ]
        result.append({
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "current_team": emp.current_team,
            "previous_team": emp.previous_team,
            "role": emp.role,
            "employment_status": emp.employment_status,
            "access_count": len(access),
            "access": access,
        })
    return {"employees": result, "total": len(result)}


@router.get("/{employee_id}")
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    access = [
        {
            "group_name": ea.group.group_name,
            "system_name": ea.group.system_name,
            "team_owner": ea.group.team_owner,
            "is_privileged": ea.group.is_privileged,
            "granted_date": str(ea.granted_date) if ea.granted_date else None,
        }
        for ea in emp.employee_access
    ]
    return {
        "id": emp.id,
        "name": emp.name,
        "email": emp.email,
        "current_team": emp.current_team,
        "previous_team": emp.previous_team,
        "role": emp.role,
        "employment_status": emp.employment_status,
        "access": access,
    }
