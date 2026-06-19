import type {
  DashboardStats,
  Employee,
  RecommendationResult,
  MoverResult,
  Finding,
  ApprovalRequest,
  AuditLog,
  AccessException, GovernanceHygieneCluster, GovernanceDebtScore, HygieneStatus} from '@/types';
import { getToken } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("accessmind_token");
      localStorage.removeItem("accessmind_user");
      window.location.href = "/login";
      return {} as T;
    }
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string; user: import("@/lib/auth").AuthUser }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () => apiFetch<import("@/lib/auth").AuthUser>("/auth/me"),

  // Dashboard
  stats: () => apiFetch<DashboardStats>("/findings/stats"),

  // Employees
  employees: () => apiFetch<{ employees: Employee[]; total: number }>("/employees/"),

  // Recommendations
  recommendAccess: (payload: { name: string; team: string; role: string }) =>
    apiFetch<RecommendationResult>("/recommend-access/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Mover detection
  detectMovers: () => apiFetch<MoverResult>("/detect-movers/", { method: "POST" }),

  // Findings
  findings: (params?: Record<string, string>) => {
    const qs = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : ""
    return apiFetch<{ findings: Finding[]; total: number }>(`/findings/${qs}`)
  },
  getFinding: (id: number) => apiFetch<Finding>(`/findings/${id}`),
  updateFindingStatus: (id: number, status: string) =>
    apiFetch<{ id: number; status: string; message: string }>(
      `/findings/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    ),

  // Approvals
  approvals: () =>
    apiFetch<{ approvals: ApprovalRequest[]; total: number }>("/approval-requests/"),
  getApproval: (id: number) =>
    apiFetch<ApprovalRequest>(`/approval-requests/${id}`),
  createApproval: (payload: {
    finding_id: number;
    access_group_name: string;
    approver_name: string;
    performed_by?: string;
  }) =>
    apiFetch<ApprovalRequest>("/approval-requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approveRequest: (id: number, approver_name: string, decision_notes?: string) =>
    apiFetch<ApprovalRequest>(`/approval-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver_name, decision_notes }),
    }),
  rejectRequest: (id: number, approver_name: string, decision_notes?: string) =>
    apiFetch<ApprovalRequest>(`/approval-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ approver_name, decision_notes }),
    }),

  // Exceptions
  exceptions: () =>
    apiFetch<{ exceptions: AccessException[]; total: number }>("/exceptions/"),
  getExceptionsForFinding: (finding_id: number) =>
    apiFetch<{ exceptions: AccessException[]; finding_id: number }>(
      `/exceptions/finding/${finding_id}`
    ),
  createException: (payload: {
    finding_id: number;
    access_group_name: string;
    business_justification: string;
    approved_by: string;
    expiry_date: string;
  }) =>
    apiFetch<AccessException>("/exceptions/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  revokeException: (id: number, revoked_by: string) =>
    apiFetch<AccessException>(`/exceptions/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ revoked_by }),
    }),

  // Roles
  roles: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<{ roles: unknown[]; total: number; filters: unknown }>(`/roles/${qs}`);
  },
  getRole: (id: number) => apiFetch<unknown>(`/roles/${id}`),

  // Audit logs
  auditLogs: () =>
    apiFetch<{ logs: AuditLog[]; total: number }>("/audit-logs/"),
  connectors: () =>
    apiFetch(`/connectors/`),

  remediationActions: (findingId: number) =>
    apiFetch(`/remediation/${findingId}`),

  launchRemediation: (payload: {
    finding_id: number
    action_type: string
    target_platform: string
    connector_id?: number
    notes?: string
  }) =>
    apiFetch(`/remediation/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  findingTimeline: (finding_id: number) =>
    apiFetch<{ timeline: AuditLog[]; finding_id: number }>(
      `/audit-logs/finding/${finding_id}`
    ),
  // Governance Hygiene [Phase 4B]
  hygieneClusters: (params?: Record<string, string>) => {
    const q = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : ''
    return apiFetch<{ clusters: GovernanceHygieneCluster[]; total: number }>(
      `/governance/hygiene/clusters${q}`
    )
  },
  runHygieneScan: () =>
    apiFetch<{
      message: string
      clusters_detected: number
      priority_summary: Record<string, number>
      scanned_at: string
    }>('/governance/hygiene/scan', { method: 'POST' }),
  updateClusterStatus: (
    id: number,
    payload: {
      status?: HygieneStatus
      governance_owner?: string
      governance_queue?: string
      escalation_target?: string
    }
  ) =>
    apiFetch<GovernanceHygieneCluster>(`/governance/hygiene/clusters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  debtScore: () =>
    apiFetch<GovernanceDebtScore>('/governance/hygiene/debt-score'),

};

// ─────────────────────────────────────────────
// PHASE 4C — GOVERNANCE WORKFLOWS
// ─────────────────────────────────────────────

export const workflowApi = {
  list: (params?: {
    status?: string
    priority?: string
    workflow_type?: string
    escalation_level?: number
    active_only?: boolean
  }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.priority) qs.set('priority', params.priority)
    if (params?.workflow_type) qs.set('workflow_type', params.workflow_type)
    if (params?.escalation_level !== undefined) qs.set('escalation_level', String(params.escalation_level))
    if (params?.active_only) qs.set('active_only', 'true')
    const q = qs.toString()
    return apiFetch(`/governance/workflows${q ? '?' + q : ''}`)
  },

  get: (id: number) => apiFetch(`/governance/workflows/${id}`),

  timeline: (id: number) => apiFetch(`/governance/workflows/${id}/timeline`),

  update: (id: number, payload: Record<string, unknown>) =>
    apiFetch(`/governance/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  queueSummary: () => apiFetch('/governance/workflows/stats/queue-summary'),

  slaSweep: () => apiFetch('/governance/workflows/actions/sla-sweep', { method: 'POST' }),

  autoTrigger: () => apiFetch('/governance/workflows/actions/run-auto-trigger', { method: 'POST' }),
}

// ─────────────────────────────────────────────
// PHASE 4C — GOVERNANCE CAMPAIGNS
// ─────────────────────────────────────────────

export const campaignApi = {
  list: (params?: { status?: string; campaign_type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.campaign_type) qs.set('campaign_type', params.campaign_type)
    const q = qs.toString()
    return apiFetch(`/governance/campaigns${q ? '?' + q : ''}`)
  },

  get: (id: number) => apiFetch(`/governance/campaigns/${id}`),

  create: (payload: Record<string, unknown>) =>
    apiFetch('/governance/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  launch: (id: number) =>
    apiFetch(`/governance/campaigns/${id}/launch`, { method: 'POST' }),

  items: (id: number, status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return apiFetch(`/governance/campaigns/${id}/items${qs}`)
  },

  actionItem: (campaignId: number, itemId: number, payload: Record<string, unknown>) =>
    apiFetch(`/governance/campaigns/${campaignId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  overview: () => apiFetch('/governance/campaigns/summary/campaign-overview'),
}

// ─────────────────────────────────────────────
// PHASE 4C — ACCESS PACKAGES
// ─────────────────────────────────────────────

export const packageApi = {
  list: (params?: { system_scope?: string; risk_level?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.system_scope) qs.set('system_scope', params.system_scope)
    if (params?.risk_level) qs.set('risk_level', params.risk_level)
    if (params?.status) qs.set('status', params.status)
    const q = qs.toString()
    return apiFetch(`/governance/packages${q ? '?' + q : ''}`)
  },

  get: (id: number) => apiFetch(`/governance/packages/${id}`),

  byRole: (roleId: number) => apiFetch(`/governance/packages/by-role/${roleId}`),

  hygieneScan: () => apiFetch('/governance/packages/hygiene/scan'),

  update: (id: number, payload: Record<string, unknown>) =>
    apiFetch(`/governance/packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  overview: () => apiFetch('/governance/packages/summary/pkg-overview'),
}

// ─────────────────────────────────────────────
// PHASE 4D — NOTIFICATIONS
// ─────────────────────────────────────────────
export const notificationApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.unread_only) qs.set('unread_only', 'true')
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return apiFetch<import('@/types').NotificationsResponse>(
      `/notifications${q ? '?' + q : ''}`
    )
  },
  markRead: (id: number) =>
    apiFetch<import('@/types').GovernanceNotification>(
      `/notifications/${id}/read`,
      { method: 'PATCH' }
    ),
  dismissAll: () =>
    apiFetch<{ dismissed: number }>('/notifications/dismiss-all', { method: 'POST' }),
  seedDemo: () =>
    apiFetch<{ seeded: number }>('/notifications/seed-demo', { method: 'POST' }),
}

// ─────────────────────────────────────────────
// PHASE 4D — TRENDS & WORKLOAD
// ─────────────────────────────────────────────
export const trendsApi = {
  summary: () =>
    apiFetch<import('@/types').TrendSummary>('/governance/trends/summary'),
  snapshots: (params: {
    metric_type: string
    days?: number
    system_scope?: string
    governance_queue?: string
  }) => {
    const qs = new URLSearchParams()
    qs.set('metric_type', params.metric_type)
    if (params.days) qs.set('days', String(params.days))
    if (params.system_scope) qs.set('system_scope', params.system_scope)
    if (params.governance_queue) qs.set('governance_queue', params.governance_queue)
    return apiFetch<import('@/types').TrendSnapshot[]>(
      `/governance/trends/snapshots?${qs.toString()}`
    )
  },
  hotspots: () =>
    apiFetch<import('@/types').HotspotSystem[]>('/governance/trends/hotspots'),
  workload: () =>
    apiFetch<import('@/types').WorkloadIntelligence>('/governance/trends/workload'),
}
