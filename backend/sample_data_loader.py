"""
Enterprise Seed Data — AccessMind Phase 2.5
-------------------------------------------
Realistic enterprise data modelling a mid-size technology company (~2000 employees).
This seed represents a cross-section of 20 employees across 7 departments.

Departments:
  - Cyber Security
  - Infrastructure Operations
  - Cloud Engineering
  - Human Resources
  - Finance
  - Risk & Compliance
  - Enterprise Applications

Access groups use real enterprise system naming conventions.
Stale access scenarios are realistic and contextually meaningful.
"""

from datetime import date
from database import SessionLocal, engine
from models import Base, Employee, AccessGroup, EmployeeAccess, Finding

Base.metadata.create_all(bind=engine)

# ── Access Groups ─────────────────────────────────────────────────────────────
# Fields: group_name, system_name, team_owner, is_privileged

ACCESS_GROUPS = [
    # Cyber Security
    {"group_name": "Sentinel-Incident-Responder",    "system_name": "Microsoft Sentinel",      "team_owner": "Cyber Security",           "is_privileged": True},
    {"group_name": "Sentinel-ReadOnly",              "system_name": "Microsoft Sentinel",      "team_owner": "Cyber Security",           "is_privileged": False},
    {"group_name": "CrowdStrike-ReadOnly",           "system_name": "CrowdStrike Falcon",      "team_owner": "Cyber Security",           "is_privileged": False},
    {"group_name": "CrowdStrike-SOC-Analyst",        "system_name": "CrowdStrike Falcon",      "team_owner": "Cyber Security",           "is_privileged": False},
    {"group_name": "Splunk-Power-User",              "system_name": "Splunk SIEM",             "team_owner": "Cyber Security",           "is_privileged": False},
    {"group_name": "Splunk-Admin",                   "system_name": "Splunk SIEM",             "team_owner": "Cyber Security",           "is_privileged": True},
    {"group_name": "CyberArk-Vault-Operator",        "system_name": "CyberArk PAM",            "team_owner": "Cyber Security",           "is_privileged": True},
    {"group_name": "Cyber-Security-SharePoint",      "system_name": "SharePoint Online",       "team_owner": "Cyber Security",           "is_privileged": False},
    {"group_name": "Defender-Security-Reader",       "system_name": "Microsoft Defender XDR",  "team_owner": "Cyber Security",           "is_privileged": False},

    # Infrastructure Operations
    {"group_name": "AD-Domain-Admins",               "system_name": "Active Directory",        "team_owner": "Infrastructure Operations","is_privileged": True},
    {"group_name": "AD-Service-Accounts",            "system_name": "Active Directory",        "team_owner": "Infrastructure Operations","is_privileged": True},
    {"group_name": "VMware-vSphere-Admin",           "system_name": "VMware vSphere",          "team_owner": "Infrastructure Operations","is_privileged": True},
    {"group_name": "Ansible-Tower-Operator",         "system_name": "Ansible Tower",           "team_owner": "Infrastructure Operations","is_privileged": True},
    {"group_name": "Network-Monitor-ReadOnly",       "system_name": "SolarWinds NPM",          "team_owner": "Infrastructure Operations","is_privileged": False},
    {"group_name": "Infra-Ops-SharePoint",           "system_name": "SharePoint Online",       "team_owner": "Infrastructure Operations","is_privileged": False},
    {"group_name": "Backup-Admin-Veeam",             "system_name": "Veeam Backup",            "team_owner": "Infrastructure Operations","is_privileged": True},

    # Cloud Engineering
    {"group_name": "Azure-Subscription-Contributor", "system_name": "Microsoft Azure",         "team_owner": "Cloud Engineering",        "is_privileged": True},
    {"group_name": "Azure-Global-Administrator",     "system_name": "Microsoft Azure",         "team_owner": "Cloud Engineering",        "is_privileged": True},
    {"group_name": "AWS-Production-ReadOnly",        "system_name": "Amazon Web Services",     "team_owner": "Cloud Engineering",        "is_privileged": False},
    {"group_name": "AWS-IAM-Administrator",          "system_name": "Amazon Web Services",     "team_owner": "Cloud Engineering",        "is_privileged": True},
    {"group_name": "GitHub-Engineering-Maintainer",  "system_name": "GitHub Enterprise",       "team_owner": "Cloud Engineering",        "is_privileged": False},
    {"group_name": "Terraform-Cloud-Operator",       "system_name": "Terraform Cloud",         "team_owner": "Cloud Engineering",        "is_privileged": True},
    {"group_name": "Cloud-Engineering-SharePoint",   "system_name": "SharePoint Online",       "team_owner": "Cloud Engineering",        "is_privileged": False},

    # Human Resources
    {"group_name": "Workday-HR-Administrator",       "system_name": "Workday HCM",             "team_owner": "Human Resources",          "is_privileged": True},
    {"group_name": "Workday-Payroll-Manager",        "system_name": "Workday HCM",             "team_owner": "Human Resources",          "is_privileged": True},
    {"group_name": "Workday-Employee-ReadOnly",      "system_name": "Workday HCM",             "team_owner": "Human Resources",          "is_privileged": False},
    {"group_name": "Greenhouse-Recruiter",           "system_name": "Greenhouse ATS",          "team_owner": "Human Resources",          "is_privileged": False},
    {"group_name": "HR-SharePoint",                  "system_name": "SharePoint Online",       "team_owner": "Human Resources",          "is_privileged": False},
    {"group_name": "LearningMgmt-Admin",             "system_name": "Cornerstone LMS",         "team_owner": "Human Resources",          "is_privileged": False},

    # Finance
    {"group_name": "SAP-Finance-Editor",             "system_name": "SAP S/4HANA",             "team_owner": "Finance",                  "is_privileged": False},
    {"group_name": "SAP-Finance-Admin",              "system_name": "SAP S/4HANA",             "team_owner": "Finance",                  "is_privileged": True},
    {"group_name": "Xero-Accounts-Payable",          "system_name": "Xero",                    "team_owner": "Finance",                  "is_privileged": False},
    {"group_name": "ADP-Payroll-Admin",              "system_name": "ADP Workforce Now",       "team_owner": "Finance",                  "is_privileged": True},
    {"group_name": "PowerBI-Finance-Workspace",      "system_name": "Microsoft Power BI",      "team_owner": "Finance",                  "is_privileged": False},
    {"group_name": "Finance-SharePoint",             "system_name": "SharePoint Online",       "team_owner": "Finance",                  "is_privileged": False},

    # Risk & Compliance
    {"group_name": "GRC-Platform-Editor",            "system_name": "ServiceNow GRC",          "team_owner": "Risk & Compliance",        "is_privileged": False},
    {"group_name": "GRC-Platform-Admin",             "system_name": "ServiceNow GRC",          "team_owner": "Risk & Compliance",        "is_privileged": True},
    {"group_name": "Archer-Risk-Analyst",            "system_name": "RSA Archer",              "team_owner": "Risk & Compliance",        "is_privileged": False},
    {"group_name": "Compliance-SharePoint",          "system_name": "SharePoint Online",       "team_owner": "Risk & Compliance",        "is_privileged": False},

    # Enterprise Applications
    {"group_name": "ServiceNow-Change-Manager",      "system_name": "ServiceNow ITSM",         "team_owner": "Enterprise Applications",  "is_privileged": False},
    {"group_name": "ServiceNow-Admin",               "system_name": "ServiceNow ITSM",         "team_owner": "Enterprise Applications",  "is_privileged": True},
    {"group_name": "Okta-App-Administrator",         "system_name": "Okta IAM",                "team_owner": "Enterprise Applications",  "is_privileged": True},
    {"group_name": "Jira-Project-Administrator",     "system_name": "Jira Software",           "team_owner": "Enterprise Applications",  "is_privileged": False},
    {"group_name": "Confluence-Space-Admin",         "system_name": "Confluence",              "team_owner": "Enterprise Applications",  "is_privileged": False},
    {"group_name": "EA-SharePoint",                  "system_name": "SharePoint Online",       "team_owner": "Enterprise Applications",  "is_privileged": False},
]

# ── Employees ─────────────────────────────────────────────────────────────────
# (name, email, current_team, previous_team, role, status)

EMPLOYEES = [
    # Cyber Security — stable
    ("James Thornton",   "j.thornton@corp.internal",   "Cyber Security",           None,                      "SOC Analyst",                  "active"),
    ("Priya Nair",       "p.nair@corp.internal",        "Cyber Security",           None,                      "SOC Analyst",                  "active"),
    ("Marcus Webb",      "m.webb@corp.internal",        "Cyber Security",           None,                      "Security Architect",           "active"),
    ("Fatima Al-Hassan", "f.alhassan@corp.internal",    "Cyber Security",           None,                      "Security Architect",           "active"),

    # Cyber Security — mover (from Infrastructure Operations)
    ("Daniel Okonkwo",   "d.okonkwo@corp.internal",     "Cyber Security",           "Infrastructure Operations","SOC Analyst",                  "active"),

    # Infrastructure Operations — stable
    ("Rachel Simmons",   "r.simmons@corp.internal",     "Infrastructure Operations",None,                      "Infrastructure Administrator",  "active"),
    ("Connor Walsh",     "c.walsh@corp.internal",        "Infrastructure Operations",None,                      "Infrastructure Administrator",  "active"),

    # Infrastructure Operations — mover (from Cloud Engineering)
    ("Yuki Tanaka",      "y.tanaka@corp.internal",      "Infrastructure Operations","Cloud Engineering",        "Infrastructure Administrator",  "active"),

    # Cloud Engineering — stable
    ("Sophie Laurent",   "s.laurent@corp.internal",     "Cloud Engineering",        None,                      "Cloud Engineer",                "active"),
    ("Arjun Mehta",      "a.mehta@corp.internal",       "Cloud Engineering",        None,                      "Cloud Engineer",                "active"),
    ("Ben Okafor",       "b.okafor@corp.internal",      "Cloud Engineering",        None,                      "Cloud Engineer",                "active"),

    # Cloud Engineering — mover (from Cyber Security)
    ("Natalie Cruz",     "n.cruz@corp.internal",        "Cloud Engineering",        "Cyber Security",           "Cloud Engineer",                "active"),

    # Human Resources — stable
    ("Tom Eriksson",     "t.eriksson@corp.internal",    "Human Resources",          None,                      "HR Operations Lead",            "active"),
    ("Aisha Kamara",     "a.kamara@corp.internal",      "Human Resources",          None,                      "HR Operations Lead",            "active"),

    # Finance — stable
    ("Oliver Grant",     "o.grant@corp.internal",       "Finance",                  None,                      "Finance Manager",               "active"),
    ("Mei Lin",          "m.lin@corp.internal",         "Finance",                  None,                      "Finance Manager",               "active"),

    # Finance — mover (from Risk & Compliance)
    ("Samuel Adeyemi",   "s.adeyemi@corp.internal",     "Finance",                  "Risk & Compliance",        "Finance Manager",               "active"),

    # Risk & Compliance — stable
    ("Claire Bouchard",  "c.bouchard@corp.internal",    "Risk & Compliance",        None,                      "Governance Analyst",            "active"),

    # Enterprise Applications — stable
    ("Luca Romano",      "l.romano@corp.internal",      "Enterprise Applications",  None,                      "IAM Engineer",                  "active"),

    # Enterprise Applications — mover (from Infrastructure Operations)
    ("Zara Ahmed",       "z.ahmed@corp.internal",       "Enterprise Applications",  "Infrastructure Operations","Service Delivery Manager",      "active"),
]

# ── Access Assignments ────────────────────────────────────────────────────────
# Stale access marked with ← STALE

EMPLOYEE_ACCESS = {
    # Cyber Security — stable SOC Analysts
    "James Thornton": [
        "Sentinel-Incident-Responder", "CrowdStrike-SOC-Analyst",
        "Splunk-Power-User", "Defender-Security-Reader", "Cyber-Security-SharePoint",
    ],
    "Priya Nair": [
        "Sentinel-Incident-Responder", "CrowdStrike-SOC-Analyst",
        "Splunk-Power-User", "Defender-Security-Reader", "Cyber-Security-SharePoint",
    ],

    # Cyber Security — stable Security Architects
    "Marcus Webb": [
        "Sentinel-Incident-Responder", "CrowdStrike-SOC-Analyst", "Splunk-Power-User",
        "CyberArk-Vault-Operator", "Defender-Security-Reader", "Cyber-Security-SharePoint",
    ],
    "Fatima Al-Hassan": [
        "Sentinel-Incident-Responder", "CrowdStrike-SOC-Analyst", "Splunk-Power-User",
        "CyberArk-Vault-Operator", "Defender-Security-Reader", "Cyber-Security-SharePoint",
    ],

    # Mover: Infrastructure Operations → Cyber Security
    # Stale: AD-Domain-Admins (Critical), Ansible-Tower-Operator (High), Infra-Ops-SharePoint (Medium)
    "Daniel Okonkwo": [
        "Sentinel-Incident-Responder", "CrowdStrike-SOC-Analyst", "Splunk-Power-User",
        "Cyber-Security-SharePoint",
        "AD-Domain-Admins",        # ← STALE Critical
        "Ansible-Tower-Operator",  # ← STALE High
        "Infra-Ops-SharePoint",    # ← STALE Medium
    ],

    # Infrastructure Operations — stable
    "Rachel Simmons": [
        "AD-Domain-Admins", "VMware-vSphere-Admin", "Ansible-Tower-Operator",
        "Network-Monitor-ReadOnly", "Backup-Admin-Veeam", "Infra-Ops-SharePoint",
    ],
    "Connor Walsh": [
        "AD-Domain-Admins", "VMware-vSphere-Admin", "Ansible-Tower-Operator",
        "Network-Monitor-ReadOnly", "Infra-Ops-SharePoint",
    ],

    # Mover: Cloud Engineering → Infrastructure Operations
    # Stale: Azure-Subscription-Contributor (Critical), GitHub-Engineering-Maintainer (Medium)
    "Yuki Tanaka": [
        "AD-Domain-Admins", "VMware-vSphere-Admin", "Network-Monitor-ReadOnly",
        "Infra-Ops-SharePoint",
        "Azure-Subscription-Contributor",  # ← STALE Critical
        "GitHub-Engineering-Maintainer",   # ← STALE Medium
    ],

    # Cloud Engineering — stable
    "Sophie Laurent": [
        "Azure-Subscription-Contributor", "AWS-Production-ReadOnly",
        "GitHub-Engineering-Maintainer", "Terraform-Cloud-Operator",
        "Cloud-Engineering-SharePoint",
    ],
    "Arjun Mehta": [
        "Azure-Subscription-Contributor", "AWS-Production-ReadOnly",
        "GitHub-Engineering-Maintainer", "Terraform-Cloud-Operator",
        "Cloud-Engineering-SharePoint",
    ],
    "Ben Okafor": [
        "Azure-Subscription-Contributor", "AWS-Production-ReadOnly",
        "GitHub-Engineering-Maintainer", "Cloud-Engineering-SharePoint",
    ],

    # Mover: Cyber Security → Cloud Engineering
    # Stale: CyberArk-Vault-Operator (Critical), Splunk-Power-User (High), Cyber-Security-SharePoint (Medium)
    "Natalie Cruz": [
        "Azure-Subscription-Contributor", "AWS-Production-ReadOnly",
        "GitHub-Engineering-Maintainer", "Cloud-Engineering-SharePoint",
        "CyberArk-Vault-Operator",       # ← STALE Critical
        "Splunk-Power-User",             # ← STALE High
        "Cyber-Security-SharePoint",     # ← STALE Medium
    ],

    # Human Resources — stable
    "Tom Eriksson": [
        "Workday-HR-Administrator", "Workday-Payroll-Manager",
        "Greenhouse-Recruiter", "HR-SharePoint", "LearningMgmt-Admin",
    ],
    "Aisha Kamara": [
        "Workday-HR-Administrator", "Workday-Payroll-Manager",
        "Greenhouse-Recruiter", "HR-SharePoint",
    ],

    # Finance — stable
    "Oliver Grant": [
        "SAP-Finance-Editor", "SAP-Finance-Admin", "ADP-Payroll-Admin",
        "PowerBI-Finance-Workspace", "Finance-SharePoint",
    ],
    "Mei Lin": [
        "SAP-Finance-Editor", "Xero-Accounts-Payable",
        "PowerBI-Finance-Workspace", "Finance-SharePoint",
    ],

    # Mover: Risk & Compliance → Finance
    # Stale: GRC-Platform-Admin (Critical), Archer-Risk-Analyst (Medium)
    "Samuel Adeyemi": [
        "SAP-Finance-Editor", "PowerBI-Finance-Workspace", "Finance-SharePoint",
        "GRC-Platform-Admin",    # ← STALE Critical
        "Archer-Risk-Analyst",   # ← STALE Medium
    ],

    # Risk & Compliance — stable
    "Claire Bouchard": [
        "GRC-Platform-Editor", "GRC-Platform-Admin",
        "Archer-Risk-Analyst", "Compliance-SharePoint",
    ],

    # Enterprise Applications — stable
    "Luca Romano": [
        "Okta-App-Administrator", "ServiceNow-Change-Manager",
        "Jira-Project-Administrator", "Confluence-Space-Admin", "EA-SharePoint",
    ],

    # Mover: Infrastructure Operations → Enterprise Applications
    # Stale: AD-Domain-Admins (Critical), VMware-vSphere-Admin (Critical), Backup-Admin-Veeam (High)
    "Zara Ahmed": [
        "ServiceNow-Change-Manager", "Jira-Project-Administrator",
        "Confluence-Space-Admin", "EA-SharePoint",
        "AD-Domain-Admins",       # ← STALE Critical
        "VMware-vSphere-Admin",   # ← STALE Critical
        "Backup-Admin-Veeam",     # ← STALE High
    ],
}


def load(db):
    # ── Access Groups ─────────────────────────────────────────────────────────
    group_map: dict[str, AccessGroup] = {}
    for ag_data in ACCESS_GROUPS:
        existing = db.query(AccessGroup).filter(
            AccessGroup.group_name == ag_data["group_name"]
        ).first()
        if not existing:
            ag = AccessGroup(**ag_data)
            db.add(ag)
            db.flush()
            group_map[ag.group_name] = ag
        else:
            group_map[ag_data["group_name"]] = existing

    # ── Employees ─────────────────────────────────────────────────────────────
    emp_map: dict[str, Employee] = {}
    for row in EMPLOYEES:
        name, email, current_team, previous_team, role, status = row
        existing = db.query(Employee).filter(Employee.email == email).first()
        if not existing:
            emp = Employee(
                name=name,
                email=email,
                current_team=current_team,
                previous_team=previous_team,
                role=role,
                employment_status=status,
            )
            db.add(emp)
            db.flush()
            emp_map[name] = emp
        else:
            emp_map[name] = existing

    # ── Access Assignments ────────────────────────────────────────────────────
    for emp_name, groups in EMPLOYEE_ACCESS.items():
        emp = emp_map.get(emp_name)
        if not emp:
            continue
        for gname in groups:
            group = group_map.get(gname)
            if not group:
                continue
            exists = db.query(EmployeeAccess).filter(
                EmployeeAccess.employee_id == emp.id,
                EmployeeAccess.group_id == group.id,
            ).first()
            if not exists:
                ea = EmployeeAccess(
                    employee_id=emp.id,
                    group_id=group.id,
                    granted_date=date(2024, 1, 15),
                )
                db.add(ea)

    db.commit()
    print("Enterprise seed data loaded successfully.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        load(db)
    finally:
        db.close()
