'use client'
import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { api } from '@/lib/api'
import type { GovernanceHygieneCluster, GovernanceDebtScore, HygieneClusterType, HygienePriority, HygieneStatus } from '@/types'
import { ShieldAlert, UserX, UserMinus, Layers, Clock, RefreshCw, X, ChevronRight, AlertTriangle, Building2, Users, Target, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'

const CLUSTER_TYPE_META: Record<HygieneClusterType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  unused_privileged:  { label: 'Unused Privileged',  icon: ShieldAlert, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'     },
  missing_owner:      { label: 'Missing Owner',       icon: UserMinus,   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20'},
  orphaned_roles:     { label: 'Orphaned Roles',      icon: UserX,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20'},
  duplicate_variants: { label: 'Duplicate Variants',  icon: Layers,      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
  stale_review:       { label: 'Stale Reviews',       icon: Clock,       color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20'},
}
const PRIORITY_META: Record<HygienePriority, { label: string; dot: string; text: string; border: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500',    text: 'text-red-400',    border: 'border-l-red-500'    },
  high:     { label: 'High',     dot: 'bg-orange-500', text: 'text-orange-400', border: 'border-l-orange-500' },
  medium:   { label: 'Medium',   dot: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-l-yellow-500' },
  low:      { label: 'Low',      dot: 'bg-blue-500',   text: 'text-blue-400',   border: 'border-l-blue-400'   },
}
const STATUS_META: Record<HygieneStatus, { label: string; color: string }> = {
  new:                     { label: 'New',                     color: 'bg-gray-700 text-gray-300'        },
  under_review:            { label: 'Under Review',            color: 'bg-blue-900/60 text-blue-300'     },
  accepted_risk:           { label: 'Accepted Risk',           color: 'bg-yellow-900/60 text-yellow-300' },
  owner_assigned:          { label: 'Owner Assigned',          color: 'bg-purple-900/60 text-purple-300' },
  remediation_in_progress: { label: 'Remediation In Progress', color: 'bg-indigo-900/60 text-indigo-300' },
  archived:                { label: 'Archived',                color: 'bg-gray-800 text-gray-500'        },
  resolved:                { label: 'Resolved',                color: 'bg-green-900/60 text-green-300'   },
}
const WORKFLOW_STATUSES: HygieneStatus[] = ['new','under_review','accepted_risk','owner_assigned','remediation_in_progress','archived','resolved']
const PRIORITY_ORDER: HygienePriority[] = ['critical','high','medium','low']
const SLA_DAYS_MAP: Record<string, number> = { critical: 7, high: 14, medium: 30, low: 60 }

function getClusterSla(cluster: GovernanceHygieneCluster): { label: string; colour: string } {
  const detected = cluster.last_detected_at ? new Date(cluster.last_detected_at) : null
  if (!detected) return { label: 'No date', colour: 'text-slate-500' }
  const daysSince = Math.floor((Date.now() - detected.getTime()) / 86400000)
  const sla = SLA_DAYS_MAP[cluster.priority] || 14
  if (cluster.status === 'resolved' || cluster.status === 'archived') return { label: 'Resolved', colour: 'text-green-400' }
  if (daysSince > sla * 2) return { label: `${daysSince}d — Critical breach`, colour: 'text-red-400' }
  if (daysSince > sla)     return { label: `${daysSince}d — SLA breached`,    colour: 'text-orange-400' }
  if (daysSince > sla * 0.7) return { label: `${daysSince}d — Due soon`,      colour: 'text-yellow-400' }
  return { label: `${daysSince}d — On track`, colour: 'text-slate-400' }
}

const SYSTEM_TO_PLATFORM: Record<string, string> = {
  'Active Directory': 'entra', 'Microsoft Azure': 'entra', 'Microsoft Defender XDR': 'entra',
  'Microsoft Sentinel': 'entra', 'Microsoft Power BI': 'entra', 'SharePoint Online': 'entra',
  'Okta IAM': 'okta', 'ServiceNow ITSM': 'servicenow', 'ServiceNow GRC': 'servicenow',
  'SAP S/4HANA': 'sailpoint', 'Workday HCM': 'sailpoint', 'ADP Workforce Now': 'sailpoint',
  'Cornerstone LMS': 'sailpoint', 'Greenhouse ATS': 'sailpoint', 'Xero': 'sailpoint',
  'RSA Archer': 'sailpoint', 'CyberArk PAM': 'cyberark', 'Amazon Web Services': 'sailpoint',
  'Splunk SIEM': 'sailpoint', 'GitHub Enterprise': 'sailpoint', 'Jira Software': 'sailpoint',
  'Confluence': 'sailpoint', 'Terraform Cloud': 'sailpoint', 'VMware vSphere': 'sailpoint',
  'Ansible Tower': 'sailpoint', 'CrowdStrike Falcon': 'sailpoint', 'SolarWinds NPM': 'sailpoint',
  'Veeam Backup': 'sailpoint',
}
const PLATFORM_LINKS: Record<string, { label: string; url: string }> = {
  sailpoint:  { label: 'SailPoint IdentityNow', url: 'https://identitynow.sailpoint.com' },
  entra:      { label: 'Microsoft Entra ID',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesManagementMenuBlade' },
  servicenow: { label: 'ServiceNow',            url: 'https://servicenow.com' },
  okta:       { label: 'Okta Admin',            url: 'https://login.okta.com' },
  cyberark:   { label: 'CyberArk PAM',          url: 'https://cyberark.cloud/privileged-access' },
}
function getActionLink(systemName: string) {
  const platform = SYSTEM_TO_PLATFORM[systemName]
  if (platform && PLATFORM_LINKS[platform]) return { ...PLATFORM_LINKS[platform], isGoverningPlatform: true }
  return { ...PLATFORM_LINKS['sailpoint'], isGoverningPlatform: true }
}
function debtHealthLabel(score: number): { label: string; color: string } {
  if (score === 0)  return { label: 'Clean',    color: 'text-green-400'  }
  if (score < 50)   return { label: 'Healthy',  color: 'text-green-400'  }
  if (score < 150)  return { label: 'Moderate', color: 'text-yellow-400' }
  if (score < 300)  return { label: 'Elevated', color: 'text-orange-400' }
  return                   { label: 'Critical', color: 'text-red-400'    }
}

function KpiCard({ label, value, sub, valueColor = 'text-white' }: { label: string; value: string | number; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function DebtBar({ systemName, score, maxScore }: { systemName: string; score: number; maxScore: number }) {
  const pct   = maxScore > 0 ? (score / maxScore) * 100 : 0
  const color = score >= 100 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-xs text-gray-400 truncate">{systemName}</div>
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-right text-xs font-semibold text-gray-300">{score}</div>
    </div>
  )
}

function ClusterCard({ cluster, onReview, onStatusChange }: {
  cluster: GovernanceHygieneCluster
  onReview: (c: GovernanceHygieneCluster) => void
  onStatusChange: (id: number, status: HygieneStatus) => void
}) {
  const typeMeta     = CLUSTER_TYPE_META[cluster.cluster_type]
  const priorityMeta = PRIORITY_META[cluster.priority]
  const statusMeta   = STATUS_META[cluster.status]
  const TypeIcon     = typeMeta.icon
  const consoleLink  = getActionLink(cluster.system_name)
  const [updating, setUpdating] = useState(false)

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as HygieneStatus
    setUpdating(true)
    try {
      await api.updateClusterStatus(cluster.id, { status: newStatus })
      onStatusChange(cluster.id, newStatus)
    } finally { setUpdating(false) }
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 border-l-4 ${priorityMeta.border} rounded-lg p-4 hover:border-gray-600 transition-colors`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-md ${typeMeta.bg} border flex items-center justify-center`}>
            <TypeIcon className={`w-4 h-4 ${typeMeta.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-medium uppercase tracking-wide ${typeMeta.color}`}>{typeMeta.label}</span>
              <span className="text-gray-600">·</span>
              <span className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
                <span className={`text-xs font-medium ${priorityMeta.text}`}>{priorityMeta.label}</span>
              </span>
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{cluster.title}</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{cluster.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {cluster.governance_owner && (
                <span className="flex items-center gap-1 text-xs text-gray-500"><Users className="w-3 h-3" />{cluster.governance_owner}</span>
              )}
              {cluster.governance_queue && (
                <span className="flex items-center gap-1 text-xs text-gray-500"><Target className="w-3 h-3" />{cluster.governance_queue}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="flex items-start gap-1.5 flex-1">
                <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-300 leading-relaxed">{cluster.recommendation}</p>
              </div>
              {consoleLink && (
                <a href={consoleLink.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded px-2 py-1 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  {consoleLink.isGoverningPlatform ? 'Remediate via ' : 'Open in '}{consoleLink.label}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <span className="text-xs text-gray-500">Debt</span>
            <div className="text-lg font-bold text-white leading-none">{cluster.governance_debt_score}</div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 block mb-0.5">SLA</span>
            {(() => { const sla = getClusterSla(cluster); return <span className={`text-xs font-medium ${sla.colour}`}>{sla.label}</span> })()}
          </div>
          <div className="relative">
            {updating && <Loader2 className="absolute right-6 top-1.5 w-3 h-3 text-gray-400 animate-spin" />}
            <select value={cluster.status} onChange={handleStatusChange} disabled={updating}
              className={`text-xs px-2 py-1 pr-6 rounded border-0 outline-none appearance-none cursor-pointer ${statusMeta.color}`}
              style={{ backgroundImage: 'none' }}>
              {WORKFLOW_STATUSES.map(s => (
                <option key={s} value={s} className="bg-gray-800 text-gray-200">{STATUS_META[s].label}</option>
              ))}
            </select>
            <svg className="absolute right-1.5 top-1.5 w-3 h-3 pointer-events-none opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <button onClick={() => onReview(cluster)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
            Review <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ClusterModal({ cluster, onClose, onStatusChange }: {
  cluster: GovernanceHygieneCluster
  onClose: () => void
  onStatusChange: (id: number, status: HygieneStatus) => void
}) {
  const typeMeta     = CLUSTER_TYPE_META[cluster.cluster_type]
  const priorityMeta = PRIORITY_META[cluster.priority]
  const TypeIcon     = typeMeta.icon
  const consoleLink  = getActionLink(cluster.system_name)
  const [selectedStatus, setSelectedStatus] = useState<HygieneStatus>(cluster.status)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    if (selectedStatus === cluster.status) { onClose(); return }
    setSaving(true)
    try {
      await api.updateClusterStatus(cluster.id, { status: selectedStatus })
      onStatusChange(cluster.id, selectedStatus)
      setSaved(true)
      setTimeout(onClose, 600)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-gray-700">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg ${typeMeta.bg} border flex items-center justify-center shrink-0`}>
              <TypeIcon className={`w-5 h-5 ${typeMeta.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-medium uppercase tracking-wide ${typeMeta.color}`}>{typeMeta.label}</span>
                <span className="flex items-center gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
                  <span className={`text-xs ${priorityMeta.text}`}>{priorityMeta.label}</span>
                </span>
              </div>
              <h2 className="text-sm font-semibold text-white leading-snug">{cluster.title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{cluster.system_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-300 leading-relaxed">{cluster.description}</p>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Affected Roles ({cluster.affected_count})</h3>
            <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700/50 max-h-44 overflow-y-auto">
              {cluster.affected_role_names.map(name => (
                <div key={name} className="px-3 py-2 text-xs text-gray-300 font-mono">{name}</div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {cluster.governance_owner && (
              <div className="flex items-center gap-2 text-xs">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Owner:</span>
                <span className="text-gray-200">{cluster.governance_owner}</span>
              </div>
            )}
            {cluster.governance_queue && (
              <div className="flex items-center gap-2 text-xs">
                <Target className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Queue:</span>
                <span className="text-gray-200">{cluster.governance_queue}</span>
              </div>
            )}
            {cluster.escalation_target && (
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Escalation:</span>
                <span className="text-gray-200">{cluster.escalation_target}</span>
              </div>
            )}
          </div>
          <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Recommended Action</p>
            <p className="text-sm text-indigo-200 leading-relaxed">{cluster.recommendation}</p>
          </div>
          {consoleLink && (
            <a href={consoleLink.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between bg-gray-800 border border-gray-700 hover:border-indigo-500 rounded-lg px-3 py-2.5 transition-colors group">
              <span className="text-xs text-gray-300 group-hover:text-white">
                {consoleLink.isGoverningPlatform ? 'Remediate via ' : 'Take action in '}{consoleLink.label}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 transition-colors" />
            </a>
          )}
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400">Governance Debt Score</span>
            <span className="text-sm font-bold text-white">{cluster.governance_debt_score}</span>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Workflow Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {WORKFLOW_STATUSES.map(s => (
                <button key={s} onClick={() => setSelectedStatus(s)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                    selectedStatus === s ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || saved}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg transition-colors font-medium">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving</> : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HygienePage() {
  const [clusters, setClusters]   = useState<GovernanceHygieneCluster[]>([])
  const [debtData, setDebtData]   = useState<GovernanceDebtScore | null>(null)
  const [loading, setLoading]     = useState(true)
  const [scanning, setScanning]   = useState(false)
  const [error, setError]         = useState('')
  const [filterType, setFilterType]       = useState<HygieneClusterType | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<HygienePriority | 'all'>('all')
  const [filterStatus, setFilterStatus]   = useState<'active' | 'all'>('active')
  const [selectedCluster, setSelectedCluster] = useState<GovernanceHygieneCluster | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [clustersRes, debtRes] = await Promise.all([api.hygieneClusters(), api.debtScore()])
      setClusters(clustersRes.clusters)
      setDebtData(debtRes)
    } catch { setError('Failed to load governance hygiene data.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleScan() {
    setScanning(true)
    try { await api.runHygieneScan(); await load() }
    catch { setError('Scan failed. Please try again.') }
    finally { setScanning(false) }
  }

  function handleStatusChange(id: number, status: HygieneStatus) {
    setClusters(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const ACTIVE_STATUSES: HygieneStatus[] = ['new','under_review','owner_assigned','remediation_in_progress']
  const resetPage = () => setPage(1)

  const filtered = clusters.filter(c => {
    if (filterType !== 'all' && c.cluster_type !== filterType) return false
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false
    if (filterStatus === 'active' && !ACTIVE_STATUSES.includes(c.status)) return false
    return true
  })

  const grouped: Record<HygienePriority, GovernanceHygieneCluster[]> = { critical: [], high: [], medium: [], low: [] }
  for (const c of filtered) grouped[c.priority].push(c)

  const maxDebtScore = debtData?.system_scores?.[0]?.debt_score ?? 1
  const allSorted    = PRIORITY_ORDER.flatMap(p => grouped[p])
  const totalPages   = Math.max(1, Math.ceil(allSorted.length / PAGE_SIZE))
  const paginated    = allSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const paginatedGrouped: Record<HygienePriority, GovernanceHygieneCluster[]> = { critical: [], high: [], medium: [], low: [] }
  for (const c of paginated) paginatedGrouped[c.priority].push(c)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Governance Hygiene" subtitle="Governance debt intelligence across your IAM ecosystem" />
        <button onClick={handleScan} disabled={scanning || loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Scanning...' : 'Run Scan'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>}

      {/* KPI cards */}
      {debtData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Global Debt Score" value={debtData.global_score} sub={debtHealthLabel(debtData.global_score).label} valueColor={debtHealthLabel(debtData.global_score).color} />
          <KpiCard label="Active Clusters"   value={debtData.total_clusters} sub="Requiring attention" />
          <KpiCard label="Critical"          value={debtData.priority_counts?.critical ?? 0} sub="Highest priority" valueColor={(debtData.priority_counts?.critical ?? 0) > 0 ? 'text-red-400' : 'text-white'} />
          <KpiCard label="Roles Affected"    value={debtData.total_affected_roles} sub="Across all systems" />
        </div>
      )}

      {/* ── Debt by system — moved here, above filters ── */}
      {debtData && debtData.system_scores.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-200">Top Governance Debt by System</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {debtData.system_scores.slice(0, 8).map(({ system_name, debt_score }) => (
              <DebtBar key={system_name} systemName={system_name} score={debt_score} maxScore={maxDebtScore} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 flex-wrap">
          <button onClick={() => { setFilterType('all'); resetPage() }}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterType === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            All Types
          </button>
          {(Object.keys(CLUSTER_TYPE_META) as HygieneClusterType[]).map(t => (
            <button key={t} onClick={() => { setFilterType(t); resetPage() }}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterType === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {CLUSTER_TYPE_META[t].label}
            </button>
          ))}
        </div>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value as HygienePriority | 'all'); resetPage() }}
          className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 outline-none">
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as 'active' | 'all'); resetPage() }}
          className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 outline-none">
          <option value="active">Active Issues</option>
          <option value="all">All Statuses</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} cluster{filtered.length !== 1 ? 's' : ''}{totalPages > 1 ? ` — page ${page} of ${totalPages}` : ''}
        </span>
      </div>

      {/* Cluster list */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-400 text-sm">No governance hygiene issues match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {PRIORITY_ORDER.map(priority => {
            const items = paginatedGrouped[priority]
            if (items.length === 0) return null
            const meta = PRIORITY_META[priority]
            return (
              <div key={priority}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                  <span className="text-gray-600 text-xs">-- {items.length} cluster{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {items.map(c => (
                    <ClusterCard key={c.id} cluster={c} onReview={setSelectedCluster} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors">
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded-lg transition-colors ${p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg disabled:opacity-40 hover:border-gray-500 transition-colors">
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {selectedCluster && (
        <ClusterModal
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status)
            setSelectedCluster(prev => prev && prev.id === id ? { ...prev, status } : prev)
          }}
        />
      )}
    </div>
  )
}
