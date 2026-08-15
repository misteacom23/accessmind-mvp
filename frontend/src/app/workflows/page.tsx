'use client'
import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { workflowApi } from '@/lib/api'
import type { GovernanceWorkflow, WorkflowTimelineEvent } from '@/types'

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const PRIORITY_COLOURS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}
const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  under_review: 'bg-purple-500/20 text-purple-400',
  owner_assigned: 'bg-teal-500/20 text-teal-400',
  remediation_in_progress: 'bg-indigo-500/20 text-indigo-400',
  accepted_risk: 'bg-slate-500/20 text-slate-400',
  resolved: 'bg-green-500/20 text-green-400',
  archived: 'bg-slate-600/20 text-slate-500',
}
const SLA_COLOURS: Record<string, string> = {
  on_track: 'bg-green-500',
  due_soon: 'bg-yellow-500',
  breached: 'bg-orange-500',
  critical_breach: 'bg-red-500',
  resolved: 'bg-slate-500',
}
const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  privileged_access_review: 'Privileged Review',
  owner_assignment: 'Owner Assignment',
  stale_review_remediation: 'Stale Review',
  stale_access_remediation: 'Stale Access',
  stale_review: 'Stale Review',
  orphaned_role_cleanup: 'Orphaned Role',
  role_consolidation: 'Role Consolidation',
  governance_review: 'Governance Review',
}
const ESCALATION_LABELS: Record<number, string> = {
  0: 'On Track',
  1: 'Escalated',
  2: 'Critical Escalation',
  3: 'Governance Lead',
}
const ESCALATION_COLOURS: Record<number, string> = {
  0: 'text-slate-400',
  1: 'text-orange-400',
  2: 'text-red-400',
  3: 'text-red-500',
}
const EVENT_ICONS: Record<string, string> = {
  workflow_created: '⚡',
  sla_breach: '⚠️',
  sla_critical_breach: '🚨',
  status_changed: '↻',
  owner_assigned: '��',
  remediation_routed: '→',
  workflow_updated: '✎',
}
const TERMINAL = new Set(['resolved', 'archived', 'accepted_risk'])
const PAGE_SIZE = 4

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDatetime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function slaLabel(wf: GovernanceWorkflow) {
  if (wf.sla_status === 'resolved') return 'Resolved'
  if (wf.sla_status === 'critical_breach') return `${wf.overdue_days}d critical breach`
  if (wf.sla_status === 'breached') return `${wf.overdue_days}d overdue`
  if (wf.sla_status === 'due_soon') return `Due in ${wf.days_remaining}d`
  return `${wf.days_remaining ?? wf.sla_days}d remaining`
}
function slaBarWidth(wf: GovernanceWorkflow) {
  if (wf.sla_status === 'resolved') return '100%'
  if (wf.sla_status === 'breached' || wf.sla_status === 'critical_breach') return '100%'
  if (wf.days_remaining === null) return '50%'
  const used = wf.sla_days - (wf.days_remaining ?? 0)
  return `${Math.min(100, Math.round((used / wf.sla_days) * 100))}%`
}

// ─────────────────────────────────────────────
// TIMELINE DRAWER
// ─────────────────────────────────────────────
function TimelineDrawer({ workflow, onClose }: { workflow: GovernanceWorkflow; onClose: () => void }) {
  const [events, setEvents] = useState<WorkflowTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    workflowApi.timeline(workflow.id).then((data) => {
      const timeline = data as { events: WorkflowTimelineEvent[] }
      setEvents(timeline.events || [])
      setLoading(false)
    })
  }, [workflow.id])
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1117] border-l border-slate-700/50 flex flex-col h-full overflow-hidden">
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Timeline</p>
            <h2 className="text-white font-semibold text-sm leading-snug max-w-xs">{workflow.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{workflow.external_reference}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none mt-1">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-slate-500 text-sm">Loading timeline...</p>
          ) : events.length === 0 ? (
            <p className="text-slate-500 text-sm">No timeline events yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/50" />
              <div className="space-y-6">
                {events.map((ev, i) => (
                  <div key={ev.id || i} className="relative flex gap-4 pl-10">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base flex-shrink-0">
                      {EVENT_ICONS[ev.event_type] || '●'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm leading-snug">{ev.description}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-slate-500">{ev.actor || 'system'}</span>
                        <span className="text-xs text-slate-600">{formatDatetime(ev.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-700/50 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 mb-0.5">Governance Owner</p>
              <p className="text-white">{workflow.governance_owner || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Connector</p>
              <p className="text-white">{workflow.connector_name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Due Date</p>
              <p className="text-white">{formatDate(workflow.due_date)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Escalation Target</p>
              <p className="text-white">{workflow.escalation_target || '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// RECOMMENDATION ROW
// ─────────────────────────────────────────────
const REC_STYLES = {
  critical: 'border-red-500/30 bg-red-500/5 text-red-400',
  warning:  'border-amber-500/30 bg-amber-500/5 text-amber-400',
  info:     'border-blue-500/20 bg-blue-500/5 text-blue-400',
}
const REC_ICONS = { critical: '!', warning: '→', info: 'i' }

function RecommendationRow({ rec }: { rec: { action: string; reason: string; urgency: string } }) {
  return (
    <div className={`flex gap-2.5 p-2.5 rounded-lg border text-xs ${REC_STYLES[rec.urgency as keyof typeof REC_STYLES] ?? REC_STYLES.info}`}>
      <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
        {REC_ICONS[rec.urgency as keyof typeof REC_ICONS] ?? 'i'}
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-snug">{rec.action}</p>
        <p className="opacity-70 mt-0.5 leading-relaxed">{rec.reason}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PLATFORM BANNER
// ─────────────────────────────────────────────
const PLATFORM_LINKS: Record<string, { label: string; url: string }> = {
  sailpoint:  { label: 'SailPoint IdentityNow', url: 'https://identitynow.sailpoint.com' },
  entra:      { label: 'Microsoft Entra ID',    url: 'https://entra.microsoft.com' },
  okta:       { label: 'Okta Admin',            url: 'https://admin.okta.com' },
  cyberark:   { label: 'CyberArk PAM',          url: 'https://docs.cyberark.com' },
  servicenow: { label: 'ServiceNow ITSM',       url: 'https://www.servicenow.com' },
}
const CONNECTOR_NAME_LINKS: Record<string, { label: string; url: string }> = {
  'SailPoint IdentityNow': { label: 'SailPoint IdentityNow', url: 'https://identitynow.sailpoint.com' },
  'Microsoft Entra ID':    { label: 'Microsoft Entra ID',    url: 'https://entra.microsoft.com' },
  'CyberArk PAM':          { label: 'CyberArk PAM',          url: 'https://docs.cyberark.com' },
  'ServiceNow ITSM':       { label: 'ServiceNow ITSM',       url: 'https://www.servicenow.com' },
}
function getPlatformLink(platform: string | null, name: string | null) {
  if (platform && PLATFORM_LINKS[platform]) return PLATFORM_LINKS[platform]
  if (name && CONNECTOR_NAME_LINKS[name]) return CONNECTOR_NAME_LINKS[name]
  return null
}
function PlatformBanner({ platform, name }: { platform: string | null; name: string | null }) {
  const pl = getPlatformLink(platform, name)
  if (!pl) return null
  return (
    <div className="mb-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-400">Remediation platform</p>
        <p className="text-xs text-white font-medium">{pl.label}</p>
      </div>
      <a href={pl.url} target="_blank" rel="noopener noreferrer"
        className="text-xs text-blue-300 hover:text-blue-200 px-3 py-1.5 rounded border border-blue-500/40 hover:border-blue-400 transition-colors">
        Open in Platform
      </a>
    </div>
  )
}

// ─────────────────────────────────────────────
// WORKFLOW CARD
// ─────────────────────────────────────────────
function WorkflowCard({ workflow, onOpenTimeline, onStatusChange }: {
  workflow: GovernanceWorkflow
  onOpenTimeline: (wf: GovernanceWorkflow) => void
  onStatusChange: (id: number, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const isTerminal = TERMINAL.has(workflow.status)

  async function handleStatusChange(newStatus: string) {
    setUpdating(true)
    await workflowApi.update(workflow.id, { status: newStatus })
    onStatusChange(workflow.id, newStatus)
    setUpdating(false)
  }

  return (
    <div className={`bg-[#0f1117] border rounded-lg p-5 transition-all ${
      workflow.escalation_level >= 2 ? 'border-red-500/40' :
      workflow.escalation_level === 1 ? 'border-orange-500/30' : 'border-slate-700/50'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOURS[workflow.priority]}`}>
              {workflow.priority.toUpperCase()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOURS[workflow.status] || 'bg-slate-700 text-slate-400'}`}>
              {workflow.status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-600">
              {WORKFLOW_TYPE_LABELS[workflow.workflow_type] || workflow.workflow_type}
            </span>
          </div>
          <h3 className="text-white text-sm font-medium leading-snug">{workflow.title}</h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-slate-500 font-mono">{workflow.external_reference}</p>
          {workflow.escalation_level > 0 && (
            <p className={`text-xs font-medium mt-0.5 ${ESCALATION_COLOURS[workflow.escalation_level]}`}>
              {ESCALATION_LABELS[workflow.escalation_level]}
            </p>
          )}
        </div>
      </div>
      {workflow.description && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{workflow.description}</p>
      )}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">SLA</span>
          <span className={`text-xs font-medium ${
            workflow.sla_status === 'on_track' ? 'text-green-400' :
            workflow.sla_status === 'due_soon' ? 'text-yellow-400' :
            workflow.sla_status === 'breached' ? 'text-orange-400' :
            workflow.sla_status === 'critical_breach' ? 'text-red-400' : 'text-slate-400'
          }`}>{slaLabel(workflow)}</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${SLA_COLOURS[workflow.sla_status]}`}
            style={{ width: slaBarWidth(workflow) }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4 text-xs">
        <div><span className="text-slate-600">Owner </span><span className="text-slate-300">{workflow.governance_owner || '—'}</span></div>
        <div><span className="text-slate-600">Queue </span><span className="text-slate-300">{workflow.governance_queue || '—'}</span></div>
        <div><span className="text-slate-600">Connector </span><span className="text-slate-300">{workflow.connector_name || '—'}</span></div>
        <div><span className="text-slate-600">Due </span><span className="text-slate-300">{formatDate(workflow.due_date)}</span></div>
      </div>
      <PlatformBanner platform={workflow.connector_platform} name={workflow.connector_name} />
      {workflow.recommendations && workflow.recommendations.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {workflow.recommendations.map((rec, i) => <RecommendationRow key={i} rec={rec} />)}
        </div>
      )}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
        <button onClick={() => onOpenTimeline(workflow)}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500 transition-colors">
          Timeline
        </button>
        {!isTerminal && (
          <>
            {workflow.status === 'open' && (
              <button disabled={updating} onClick={() => handleStatusChange('under_review')}
                className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded border border-blue-500/30 hover:border-blue-500/60 transition-colors disabled:opacity-50">
                Mark Under Review
              </button>
            )}
            {workflow.status === 'under_review' && (
              <button disabled={updating} onClick={() => handleStatusChange('remediation_in_progress')}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded border border-indigo-500/30 transition-colors disabled:opacity-50">
                Start Remediation
              </button>
            )}
            <button disabled={updating} onClick={() => handleStatusChange('resolved')}
              className="text-xs text-green-400 hover:text-green-300 px-3 py-1.5 rounded border border-green-500/30 transition-colors disabled:opacity-50 ml-auto">
              Resolve
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PAGINATED QUEUE SECTION
// ─────────────────────────────────────────────
function QueueSection({ title, items, accent, onOpenTimeline, onStatusChange }: {
  title: string
  items: GovernanceWorkflow[]
  accent: string
  onOpenTimeline: (wf: GovernanceWorkflow) => void
  onStatusChange: (id: number, status: string) => void
}) {
  const [page, setPage] = useState(0)
  if (items.length === 0) return null

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paged = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1.5 h-1.5 rounded-full ${accent}`} />
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</h2>
        <span className="text-xs text-slate-600 ml-1">({items.length})</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {paged.map(wf => (
          <WorkflowCard
            key={wf.id}
            workflow={wf}
            onOpenTimeline={onOpenTimeline}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5 pt-4 border-t border-slate-700">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-4 py-2 rounded-lg bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Prev
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                  i === page
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-700 text-slate-300 border-slate-500 hover:bg-slate-600 hover:text-white"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-xs px-4 py-2 rounded-lg bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function WorkflowsPage() {
  const [workflows, setWorkflows]         = useState<GovernanceWorkflow[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<GovernanceWorkflow | null>(null)
  const [filterStatus, setFilterStatus]   = useState<string>('active')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [triggering, setTriggering]       = useState(false)
  const [sweeping, setSweeping]           = useState(false)
  const [summary, setSummary]             = useState<{
    active: number; escalated: number; overdue: number; critical_open: number
  } | null>(null)

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (filterStatus === 'active') params.active_only = true
    else if (filterStatus) params.status = filterStatus
    if (filterPriority) params.priority = filterPriority
    const data = await workflowApi.list(params as Parameters<typeof workflowApi.list>[0])
    setWorkflows((data as GovernanceWorkflow[]) || [])
    setLoading(false)
  }, [filterStatus, filterPriority])

  useEffect(() => {
    loadWorkflows()
    workflowApi.queueSummary()
      .then((data) => setSummary(data as {
        active: number
        escalated: number
        overdue: number
        critical_open: number
      }))
      .catch(() => {})
  }, [loadWorkflows])

  async function handleAutoTrigger() {
    setTriggering(true)
    await workflowApi.autoTrigger()
    await loadWorkflows()

    const s = await workflowApi.queueSummary()

    setSummary(s as {
      active: number
      escalated: number
      overdue: number
      critical_open: number
    })

    setTriggering(false)
  }

  async function handleSlaSweep() {
    setSweeping(true)
    await workflowApi.slaSweep()
    await loadWorkflows()
    setSweeping(false)
  }

  function handleStatusChange(id: number, newStatus: string) {
    setWorkflows(prev => prev.map(wf => wf.id === id ? { ...wf, status: newStatus } : wf))
  }

  const escalated = workflows.filter(w => w.escalation_level >= 2)
  const overdue   = workflows.filter(w => w.escalation_level === 1)
  const active    = workflows.filter(w => w.escalation_level === 0 && !TERMINAL.has(w.status))
  const resolved  = workflows.filter(w => TERMINAL.has(w.status))

  return (
    <div>
      <PageHeader
        title="Governance Workflows"
        subtitle="Governance operations queue — SLA tracking, escalation management, and remediation orchestration."
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active',       value: summary.active,       colour: 'text-blue-400'  },
            { label: 'Escalated',    value: summary.escalated,    colour: 'text-orange-400' },
            { label: 'Overdue',      value: summary.overdue,      colour: 'text-red-400'    },
            { label: 'Critical Open',value: summary.critical_open,colour: 'text-red-500'    },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0f1117] border border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-semibold ${stat.colour}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
          {[
            { label: 'Active',   value: 'active'   },
            { label: 'All',      value: ''         },
            { label: 'Resolved', value: 'resolved' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filterStatus === opt.value ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2">
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={handleSlaSweep} disabled={sweeping}
            className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50">
            {sweeping ? 'Running...' : 'SLA Sweep'}
          </button>
          <button onClick={handleAutoTrigger} disabled={triggering}
            className="text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
            {triggering ? 'Running...' : '⚡ Auto-Trigger'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">No workflows found</p>
          <p className="text-slate-600 text-xs mt-1">Try changing your filters or run Auto-Trigger to generate workflows from hygiene clusters.</p>
        </div>
      ) : (
        <>
          <QueueSection title="Critical Escalation"    items={escalated} accent="bg-red-500"    onOpenTimeline={setSelectedWorkflow} onStatusChange={handleStatusChange} />
          <QueueSection title="Escalated — SLA Breached" items={overdue} accent="bg-orange-500" onOpenTimeline={setSelectedWorkflow} onStatusChange={handleStatusChange} />
          <QueueSection title="Active"                 items={active}    accent="bg-blue-500"   onOpenTimeline={setSelectedWorkflow} onStatusChange={handleStatusChange} />
          <QueueSection title="Resolved / Archived"   items={resolved}  accent="bg-slate-500"  onOpenTimeline={setSelectedWorkflow} onStatusChange={handleStatusChange} />
        </>
      )}

      {selectedWorkflow && (
        <TimelineDrawer workflow={selectedWorkflow} onClose={() => setSelectedWorkflow(null)} />
      )}
    </div>
  )
}
