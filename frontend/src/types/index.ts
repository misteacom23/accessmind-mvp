export interface DashboardStats {
  total_employees: number;
  total_findings: number;
  open_findings: number;
  under_review: number;
  exception_active: number;
  high_risk_findings: number;
  movers_detected: number;
  critical_open: number;
  resolved_this_month: number;
  approvals_this_week: number;
  active_exceptions: number;
  privileged_stale: number;
  avg_resolution_days: number | null;
}

export interface AccessGroup {
  group_name: string;
  system_name: string;
  team_owner: string;
  is_privileged: boolean;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  current_team: string;
  previous_team: string | null;
  role: string;
  employment_status: string;
  access_count?: number;
  access?: AccessGroup[];
}

export interface RecommendedAccess {
  group: string;
  system: string;
  confidence: number;
  is_privileged: boolean;
  team_owner: string;
}

export interface RecommendationResult {
  team: string;
  role: string;
  peer_count: number;
  recommended_access: RecommendedAccess[];
  message?: string;
}

export interface MoverFinding {
  finding_id: number;
  employee_id: number;
  employee_name: string;
  current_team: string;
  previous_team: string;
  risk_level: string;
  reason: string;
  recommendation: string;
  status: string;
}

export interface MoverResult {
  new_findings_created: number;
  total_open_mover_findings: number;
  findings: MoverFinding[];
}

export interface Finding {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_email?: string;
  employee_role?: string;
  current_team: string;
  previous_team: string | null;
  finding_type: string;
  risk_level: string;
  reason: string;
  recommendation: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
  access?: AccessGroup[];
  exceptions?: FindingException[];
}

export interface FindingException {
  id: number;
  access_group_name: string;
  business_justification: string;
  approved_by: string;
  expiry_date: string;
  status: string;
  created_at?: string;
}

export interface ApprovalRequest {
  id: number;
  finding_id: number;
  employee_id: number;
  employee_name: string;
  employee_role?: string;
  current_team: string;
  previous_team: string | null;
  request_type: string;
  access_group_name: string;
  approver_name: string | null;
  status: string;
  decision_notes: string | null;
  risk_level: string;
  finding_reason: string;
  finding_recommendation: string;
  finding_status: string;
  created_at?: string;
  decided_at?: string | null;
}

export interface AuditLog {
  id: number;
  action_type: string;
  performed_by: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  created_at: string;
}

export interface AccessException {
  id: number;
  finding_id: number;
  employee_id: number;
  employee_name: string;
  employee_role?: string;
  current_team: string;
  access_group_name: string;
  business_justification: string;
  approved_by: string;
  expiry_date: string;
  status: string;
  risk_level: string;
  finding_reason: string;
  created_at?: string;
  updated_at?: string;
  revoked_at?: string | null;
}

export interface Connector {
  id: number
  name: string
  platform: string
  connector_type: string
  status: 'active' | 'inactive' | 'coming_soon'
  description: string
  base_url: string | null
  last_sync_at: string | null
  sync_status: string
  record_count: number
  remediation_action_count: number
  created_at: string
}

export interface RemediationAction {
  id: number
  finding_id: number
  action_type: string
  target_platform: string
  status: string
  external_reference: string
  performed_by: string
  notes: string | null
  created_at: string
}

// ── Phase 4B — Governance Hygiene types ──────────────────────────────────────

export type HygieneClusterType =
  | 'orphaned_roles'
  | 'missing_owner'
  | 'unused_privileged'
  | 'duplicate_variants'
  | 'stale_review'

export type HygienePriority = 'critical' | 'high' | 'medium' | 'low'

export type HygieneStatus =
  | 'new'
  | 'under_review'
  | 'accepted_risk'
  | 'owner_assigned'
  | 'remediation_in_progress'
  | 'archived'
  | 'resolved'

export interface GovernanceHygieneCluster {
  id: number
  cluster_type: HygieneClusterType
  system_name: string
  title: string
  description: string
  affected_count: number
  affected_role_names: string[]
  priority: HygienePriority
  governance_owner: string | null
  governance_queue: string | null
  escalation_target: string | null
  recommendation: string | null
  status: HygieneStatus
  governance_debt_score: number
  last_detected_at: string | null
  created_at: string
  updated_at: string
}

export interface SystemDebtScore {
  system_name: string
  debt_score: number
}

export interface GovernanceDebtScore {
  global_score: number
  system_scores: SystemDebtScore[]
  cluster_type_counts: Record<string, number>
  priority_counts: Record<string, number>
  total_clusters: number
  total_affected_roles: number
}

// ─────────────────────────────────────────────
// PHASE 4C — GOVERNANCE WORKFLOW AUTOMATION
// ─────────────────────────────────────────────

export interface GovernanceWorkflow {
  id: number
  workflow_type: string
  source_type: string
  source_id: number | null
  title: string
  description: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: string
  governance_owner: string
  governance_queue: string | null
  connector_id: number | null
  connector_name: string | null
  connector_platform: string | null
  external_reference: string | null
  sla_days: number
  due_date: string | null
  created_at: string | null
  updated_at: string | null
  first_reviewed_at: string | null
  escalated_at: string | null
  resolved_at: string | null
  escalation_level: number
  escalation_target: string | null
  notes: string | null
  sla_status: 'on_track' | 'due_soon' | 'breached' | 'critical_breach' | 'resolved'
  overdue_days: number
  days_remaining: number | null
  recommendations?: { action: string; reason: string; urgency: 'critical' | 'warning' | 'info' }[]
}

export interface WorkflowTimelineEvent {
  id: number
  event_type: string
  actor: string | null
  description: string
  event_metadata: Record<string, unknown> | null
  created_at: string | null
}

export interface WorkflowTimeline {
  workflow_id: number
  workflow_title: string
  events: WorkflowTimelineEvent[]
}

export interface WorkflowQueueSummary {
  total_workflows: number
  active: number
  escalated: number
  overdue: number
  resolved: number
  critical_open: number
  high_open: number
}

export interface GovernanceCampaign {
  id: number
  campaign_name: string
  campaign_type: string
  target_system: string | null
  target_access_type: string | null
  status: 'draft' | 'active' | 'completed' | 'archived'
  created_by: string
  launched_at: string | null
  due_date: string | null
  completion_pct: number
  total_targets: number
  confirmed_count: number
  rejected_count: number
  pending_count: number
  is_overdue: boolean
  days_remaining: number | null
  created_at: string | null
  updated_at: string | null
}

export interface CampaignReviewItem {
  id: number
  campaign_id: number
  employee_id: number | null
  employee_name: string | null
  role_id: number | null
  role_name: string | null
  application: string | null
  is_privileged: boolean
  assigned_to: string | null
  status: 'pending' | 'confirmed' | 'rejected' | 'escalated'
  reviewed_at: string | null
  review_notes: string | null
  escalated_at: string | null
  created_at: string | null
}

export interface CampaignsOverview {
  total: number
  active: number
  draft: number
  completed: number
  overdue: number
  avg_completion_pct: number
  pending_reviews: number
}

export interface AccessPackage {
  id: number
  package_name: string
  description: string | null
  governance_owner: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  system_scope: string | null
  status: string
  is_stale: boolean
  last_reviewed_date: string | null
  role_count: number
  roles: PackageRole[]
  risk_score: number
  overlap_flag: boolean
  duplicate_flag: boolean
  created_at: string | null
}

export interface PackageRole {
  id: number
  role_name: string
  application: string
  is_privileged: boolean
  access_type: string | null
}

export interface PackagesOverview {
  total_packages: number
  critical_packages: number
  ownerless_packages: number
  stale_packages: number
  orphaned_packages: number
}

export interface GovernanceNotification {
  id: number
  notification_type: 'sla_breach' | 'escalation' | 'workflow_created' | 'package_issue' | 'campaign_overdue'
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  target_user_role: string | null
  is_read: boolean
  is_dismissed: boolean
  related_workflow_id: number | null
  related_campaign_id: number | null
  created_at: string | null
  read_at: string | null
}

export interface NotificationsResponse {
  notifications: GovernanceNotification[]
  unread_count: number
}

export interface TrendSnapshot {
  date: string
  value: number
  system_scope: string | null
  governance_queue: string | null
}

export interface TrendMetric {
  current: number
  previous: number
  delta: number
  delta_pct: number
  direction: 'up' | 'down' | 'flat'
}

export interface TrendSummary {
  debt_score: TrendMetric
  open_workflows: TrendMetric
  escalation_count: TrendMetric
  remediation_throughput: TrendMetric
  stale_access_count: TrendMetric
}

export interface HotspotSystem {
  system: string
  debt_score: number
  as_of: string
}

export interface WorkloadQueue {
  queue: string
  total: number
  escalated: number
  critical: number
  overloaded: boolean
}

export interface WorkloadOwner {
  owner: string
  total: number
  escalated: number
  overloaded: boolean
}

export interface WorkloadIntelligence {
  queues: WorkloadQueue[]
  owners: WorkloadOwner[]
  sla_breached: number
  sla_due_soon: number
}

export interface GovernanceStory {
  id: number
  story_key: string
  story_title: string
  story_phase: 'detection' | 'escalation' | 'resolution'
  description: string | null
  is_active: boolean
  created_at: string | null
}
