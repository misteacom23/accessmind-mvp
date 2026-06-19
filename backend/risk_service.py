"""
Centralised Risk Engine — Phase 2.5
-------------------------------------
Single source of truth for all risk calculations.

Risk levels:
  Critical — privileged access to crown-jewel systems (AD, Azure Global Admin, CyberArk, AWS IAM)
  High     — privileged access from previous team
  Medium   — standard non-privileged stale access
  Low      — informational / minor shared drives
"""

from models import AccessGroup

# Systems that escalate risk to Critical when stale + privileged
CRITICAL_SYSTEM_KEYWORDS = [
    "ad-domain", "azure-global", "aws-iam", "cyberark",
    "okta-app", "ansible-tower", "backup-admin", "splunk-admin",
    "workday-payroll", "adp-payroll", "sap-finance-admin",
    "grc-platform-admin", "servicenow-admin", "vmware-vsphere",
]

# Systems that are High even if not privileged
HIGH_SYSTEM_KEYWORDS = [
    "sentinel-incident", "crowdstrike-soc", "splunk-power",
    "terraform-cloud", "azure-subscription", "aws-production",
    "grc-platform-editor", "workday-hr-admin",
]

# SharePoint and shared drives are always Medium at most
LOW_RISK_KEYWORDS = ["sharepoint", "confluence", "jira", "readme"]


def calculate_stale_access_risk(
    group: AccessGroup,
    current_team: str,
    previous_team: str,
) -> str:
    """
    Calculate risk level for a stale access finding.

    Rules (first match wins):
      1. Privileged + critical system keyword → Critical
      2. Non-privileged + high system keyword → High
      3. Privileged → High
      4. SharePoint / collaboration tools → Low
      5. Everything else → Medium
    """
    group_lower = group.group_name.lower()

    is_critical = any(kw in group_lower for kw in CRITICAL_SYSTEM_KEYWORDS)
    is_high_system = any(kw in group_lower for kw in HIGH_SYSTEM_KEYWORDS)
    is_low = any(kw in group_lower for kw in LOW_RISK_KEYWORDS)

    if group.is_privileged and is_critical:
        return "Critical"

    if is_high_system and not is_low:
        return "High"

    if group.is_privileged:
        return "High"

    if is_low:
        return "Low"

    return "Medium"


def risk_sort_order(risk_level: str) -> int:
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    return order.get(risk_level, 99)


def is_high_priority(risk_level: str) -> bool:
    return risk_level in ("Critical", "High")
