'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { api } from '@/lib/api'
import { canCreateRequests, getUser } from '@/lib/auth'
import { Finding, Connector, RemediationAction } from '@/types'

const RISK_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800',
  High:     'bg-orange-100 text-orange-800',
  Medium:   'bg-yellow-100 text-yellow-800',
  Low:      'bg-blue-100 text-blue-800',
}
const STATUS_COLORS: Record<string, string> = {
  'Open':             'bg-gray-100 text-gray-700',
  'Under Review':     'bg-blue-100 text-blue-700',
  'Resolved':         'bg-green-100 text-green-700',
  'Exception Active': 'bg-purple-100 text-purple-700',
}
const FINDING_TYPE_LABELS: Record<string, string> = {
  stale_access:     'Stale Access',
  inactive_account: 'Inactive Account',
  orphaned_access:  'Orphaned Access',
  excessive_access: 'Excessive Access',
}
const PLATFORM_LABELS: Record<string, string> = {
  sailpoint:  'SailPoint IdentityNow',
  entra:      'Microsoft Entra ID',
  servicenow: 'ServiceNow ITSM',
  okta:       'Okta',
  cyberark:   'CyberArk PAM',
}
const SYSTEM_TO_PLATFORM: Record<string, string> = {
  'Active Directory':       'entra',
  'Microsoft Azure':        'entra',
  'Microsoft Defender XDR': 'entra',
  'Microsoft Sentinel':     'entra',
  'Microsoft Power BI':     'entra',
  'Okta IAM':               'okta',
  'ServiceNow ITSM':        'servicenow',
  'ServiceNow GRC':         'servicenow',
  'CyberArk PAM':           'cyberark',
  'Splunk SIEM':            'sailpoint',
}

const PAGE_SIZE = 15

function getRelevantConnectors(finding: Finding, connectors: Connector[]): Connector[] {
  const active = connectors.filter(c => c.status === 'active')
  if (!finding.access || finding.access.length === 0) return active
  const platforms = new Set(finding.access.map((a: any) => SYSTEM_TO_PLATFORM[a.system_name]).filter(Boolean))
  if (platforms.size === 0) return active
  const matched = active.filter(c => platforms.has(c.platform) || c.platform === 'servicenow')
  return matched.length > 0 ? matched : active
}

type ActionView = 'choice' | 'remediation' | 'exception' | 'success'
type BulkMode = 'remediation' | 'exception'

// ── Selected findings summary panel (used inside bulk modal) ──────────────────
function FindingsSummaryPanel({ selected }: { selected: Finding[] }) {
  const byEmployee = useMemo(() => {
    const groups: Record<string, Finding[]> = {}
    selected.forEach(f => {
      if (!groups[f.employee_name]) groups[f.employee_name] = []
      groups[f.employee_name].push(f)
    })
    return groups
  }, [selected])

  return (
    <div className="mb-5 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {selected.length} finding{selected.length > 1 ? 's' : ''} selected
        </p>
        <p className="text-xs text-gray-400">{Object.keys(byEmployee).length} employee{Object.keys(byEmployee).length > 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
        {Object.entries(byEmployee).map(([emp, findings]) => (
          <div key={emp} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-800">{emp}</p>
              <span className="text-[10px] text-gray-400">{findings.length} finding{findings.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1.5">
              {findings.map(f => (
                <div key={f.id} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${RISK_COLORS[f.risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                    {f.risk_level}
                  </span>
                  <p className="text-xs text-gray-500 leading-snug">{f.reason ?? (FINDING_TYPE_LABELS[f.finding_type] ?? f.finding_type)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bulk action bar ────────────────────────────────────────────────────────────
function BulkActionBar({ selectedIds, findings, onClear, onRemediate, onException }: {
  selectedIds: Set<number>
  findings: Finding[]
  onClear: () => void
  onRemediate: () => void
  onException: () => void
}) {
  if (selectedIds.size === 0) return null
  const employees = new Set(findings.filter(f => selectedIds.has(f.id)).map(f => f.employee_name))
  const label = employees.size === 1
    ? `${selectedIds.size} finding${selectedIds.size > 1 ? 's' : ''} · ${[...employees][0]}`
    : `${selectedIds.size} findings · ${employees.size} employees`

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-3.5 border border-gray-700">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="w-px h-4 bg-gray-600" />
      <button onClick={onRemediate} className="text-sm font-semibold text-indigo-400 hover:text-indigo-200 transition-colors">
        Remediate all
      </button>
      <button onClick={onException} className="text-sm font-semibold text-amber-400 hover:text-amber-200 transition-colors">
        Grant exception
      </button>
      <button onClick={onClear} className="ml-1 text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none">×</button>
    </div>
  )
}

// ── Bulk modal ─────────────────────────────────────────────────────────────────
function BulkModal({ selectedIds, findings, connectors, user, initialMode, onClose, onDone }: {
  selectedIds: Set<number>
  findings: Finding[]
  connectors: Connector[]
  user: any
  initialMode: BulkMode
  onClose: () => void
  onDone: () => void
}) {
  const [view, setView] = useState<'remediation' | 'exception' | 'success'>(initialMode)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [justification, setJustification] = useState('')
  const [expiry, setExpiry] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ succeeded: number; failed: number } | null>(null)

  const selected = findings.filter(f => selectedIds.has(f.id))
  const activeConnectors = connectors.filter(c => c.status === 'active')

  const handleBulkRemediate = async () => {
    if (!selectedPlatform) return
    setLoading(true)
    let succeeded = 0, failed = 0
    for (const f of selected) {
      try {
        await api.launchRemediation({
          finding_id: f.id, action_type: 'remove_access',
          target_platform: selectedPlatform,
          connector_id: selectedConnectorId ?? undefined,
          notes: notes || undefined,
        })
        succeeded++
      } catch { failed++ }
    }
    setResults({ succeeded, failed })
    setView('success')
    setLoading(false)
    onDone()
  }

  const handleBulkException = async () => {
    if (!justification || !expiry) return
    setLoading(true)
    let succeeded = 0, failed = 0
    for (const f of selected) {
      try {
        await api.createException({
          finding_id: f.id, access_group_name: f.finding_type,
          business_justification: justification,
          approved_by: user?.name ?? 'System', expiry_date: expiry,
        })
        succeeded++
      } catch { failed++ }
    }
    setResults({ succeeded, failed })
    setView('success')
    setLoading(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {view === 'remediation' ? 'Bulk Remediation' : view === 'exception' ? 'Bulk Exception' : 'Action Complete'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {view === 'remediation' && 'Route all selected findings to a connected platform'}
                {view === 'exception' && 'Apply a temporary exception across all selected findings'}
                {view === 'success' && 'Governance actions have been processed'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Always show what's being actioned (except on success) */}
          {view !== 'success' && <FindingsSummaryPanel selected={selected} />}

          {/* Toggle between modes */}
          {view !== 'success' && (
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setView('remediation')}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${view === 'remediation' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'}`}
              >
                Remediate all
              </button>
              <button
                onClick={() => setView('exception')}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${view === 'exception' ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-200 hover:text-amber-600'}`}
              >
                Grant exception
              </button>
            </div>
          )}

          {/* Remediation form */}
          {view === 'remediation' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Select the platform to route all {selected.length} findings to. A separate governance task will be created for each.</p>
              <div className="space-y-2 mb-4">
                {activeConnectors.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedPlatform(c.platform); setSelectedConnectorId(c.id) }}
                    className={`w-full flex items-center justify-between p-3 border-2 rounded-xl transition-colors text-left ${selectedPlatform === c.platform ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}`}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{c.connector_type.toUpperCase()}</span>
                    </div>
                    {selectedPlatform === c.platform && <span className="text-indigo-600 text-xs font-medium">Selected ✓</span>}
                  </button>
                ))}
              </div>
              <div className="mb-5">
                <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add context for the receiving system..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                />
              </div>
              <button
                onClick={handleBulkRemediate}
                disabled={!selectedPlatform || loading}
                className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? `Remediating ${selected.length} findings...` : `Launch Remediation for ${selected.length} Finding${selected.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Exception form */}
          {view === 'exception' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">One justification and expiry will be applied to all {selected.length} selected findings.</p>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Business Justification</label>
                  <textarea
                    value={justification} onChange={e => setJustification(e.target.value)}
                    placeholder="Explain why this access should be temporarily retained..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Expiry Date</label>
                  <input
                    type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button
                onClick={handleBulkException}
                disabled={!justification || !expiry || loading}
                className="w-full bg-amber-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Granting exceptions...' : `Grant Exception for ${selected.length} Finding${selected.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Success */}
          {view === 'success' && results && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">
                {results.succeeded} of {selected.length} action{selected.length > 1 ? 's' : ''} completed
              </p>
              {results.failed > 0 && (
                <p className="text-xs text-red-500 mt-1">{results.failed} failed — check the audit log for details</p>
              )}
              <button onClick={onClose} className="mt-5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function FindingsPage() {
  const [findings, setFindings]               = useState<Finding[]>([])
  const [stats, setStats]                     = useState<any>(null)
  const [loading, setLoading]                 = useState(true)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [search, setSearch]                   = useState('')
  const [riskFilter, setRiskFilter]           = useState('')
  const [statusFilter, setStatusFilter]       = useState('')
  const [modalLoading, setModalLoading]       = useState(false)
  const [actionView, setActionView]           = useState<ActionView>('choice')
  const [connectors, setConnectors]           = useState<Connector[]>([])
  const [remediationActions, setRemediationActions]   = useState<RemediationAction[]>([])
  const [selectedPlatform, setSelectedPlatform]       = useState('')
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null)
  const [remediationNotes, setRemediationNotes]       = useState('')
  const [remediationResult, setRemediationResult]     = useState<RemediationAction | null>(null)
  const [exceptionJustification, setExceptionJustification] = useState('')
  const [exceptionExpiry, setExceptionExpiry]         = useState('')
  const [page, setPage]                       = useState(1)
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set())
  const [bulkModal, setBulkModal]             = useState<BulkMode | null>(null)

  const user = getUser()
  const isAuditor = user?.role === 'auditor'
  const canAct = canCreateRequests(user?.role ?? '')

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (riskFilter) params.risk_level = riskFilter
      if (statusFilter) params.status = statusFilter
      const [{ findings: f }, s] = await Promise.all([api.findings(params), api.stats()])
      setFindings(f)
      setStats(s)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [riskFilter, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    api.connectors()
      .then((data) => setConnectors(data as Connector[]))
      .catch(console.error)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return findings
    const q = search.toLowerCase()
    return findings.filter(f =>
      f.employee_name?.toLowerCase().includes(q) ||
      f.reason?.toLowerCase().includes(q) ||
      f.finding_type?.toLowerCase().includes(q)
    )
  }, [findings, search])

  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [search, riskFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const employeeGroups = useMemo(() => {
    const groups: Record<string, number[]> = {}
    filtered.forEach(f => {
      if (!groups[f.employee_name]) groups[f.employee_name] = []
      groups[f.employee_name].push(f.id)
    })
    return groups
  }, [filtered])

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectAllForEmployee = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = employeeGroups[name] ?? []
    setSelectedIds(prev => {
      const n = new Set(prev)
      const allSelected = ids.every(id => n.has(id))
      ids.forEach(id => allSelected ? n.delete(id) : n.add(id))
      return n
    })
  }

  const openFinding = async (finding: Finding) => {
    if (selectedIds.size > 0) return
    setSelectedFinding(finding)
    setActionView('choice')
    setRemediationResult(null)
    setSelectedPlatform('')
    setSelectedConnectorId(null)
    setRemediationNotes('')
    setExceptionJustification('')
    setExceptionExpiry('')
    try {
      setRemediationActions(
        (await api.remediationActions(finding.id)) as RemediationAction[]
      )
    } catch {
      setRemediationActions([])
    }
  }

  const closeModal = () => { setSelectedFinding(null); setRemediationActions([]) }

  const handleLaunchRemediation = async () => {
    if (!selectedFinding || !selectedPlatform) return
    setModalLoading(true)
    try {
      const result = await api.launchRemediation({
        finding_id: selectedFinding.id, action_type: 'remove_access',
        target_platform: selectedPlatform, connector_id: selectedConnectorId ?? undefined,
        notes: remediationNotes || undefined,
      })
      setRemediationResult(result as RemediationAction); setActionView('success'); fetchData()
    } catch (err) { console.error(err) }
    finally { setModalLoading(false) }
  }

  const handleGrantException = async () => {
    if (!selectedFinding || !exceptionJustification || !exceptionExpiry) return
    setModalLoading(true)
    try {
      await api.createException({
        finding_id: selectedFinding.id, access_group_name: selectedFinding.finding_type,
        business_justification: exceptionJustification,
        approved_by: user?.name ?? 'System', expiry_date: exceptionExpiry,
      })
      setRemediationResult(null); setActionView('success'); fetchData()
    } catch (err) { console.error(err) }
    finally { setModalLoading(false) }
  }

  const activeConnectors = selectedFinding
    ? getRelevantConnectors(selectedFinding, connectors)
    : connectors.filter(c => c.status === 'active')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Stale Access Findings" subtitle="Review and orchestrate remediation across your IAM ecosystem" />

      {isAuditor && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 flex items-center gap-2">
          <span>👁</span> Viewing as <strong>Auditor</strong> — read-only. Governance actions are disabled.
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Critical',     value: stats.critical_open,      color: 'text-red-600'    },
            { label: 'High Risk',    value: stats.high_risk_findings, color: 'text-orange-500' },
            { label: 'Under Review', value: stats.under_review,       color: 'text-blue-600'   },
            { label: 'Open',         value: stats.open_findings,      color: 'text-gray-700'   },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search employee or reason..."
          className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Risk Levels</option>
          {['Critical', 'High', 'Medium', 'Low'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          {['Open', 'Under Review', 'Resolved', 'Exception Active'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || riskFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setRiskFilter(''); setStatusFilter('') }} className="text-sm text-gray-400 hover:text-gray-600 px-3">Clear</button>
        )}
      </div>

      {!isAuditor && canAct && filtered.length > 0 && selectedIds.size === 0 && (
        <p className="text-xs text-gray-400 mb-3">Tip: select multiple findings to remediate or grant exceptions in bulk.</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading findings...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No findings match your filters.</p>
            {(search || riskFilter || statusFilter) && (
              <button onClick={() => { setSearch(''); setRiskFilter(''); setStatusFilter('') }} className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 block mx-auto">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {!isAuditor && canAct && <th className="pl-4 py-3 w-8" />}
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Finding Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Risk</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Detected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(f => {
                  const isChecked = selectedIds.has(f.id)
                  const empCount  = employeeGroups[f.employee_name]?.length ?? 0
                  const allEmpSelected = employeeGroups[f.employee_name]?.every(id => selectedIds.has(id))
                  return (
                    <tr
                      key={f.id}
                      className={`transition-colors ${isChecked ? 'bg-indigo-50/60' : 'hover:bg-gray-50'} ${selectedIds.size > 0 ? 'cursor-default' : 'cursor-pointer'}`}
                      onClick={() => openFinding(f)}
                    >
                      {!isAuditor && canAct && (
                        <td className="pl-4 py-3 w-8" onClick={e => toggleSelect(f.id, e)}>
                          <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded border-gray-300 text-indigo-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{f.employee_name}</span>
                          {empCount > 1 && (
                            <button
                              onClick={e => selectAllForEmployee(f.employee_name, e)}
                              title={allEmpSelected ? `Deselect all ${empCount} findings` : `Select all ${empCount} findings for ${f.employee_name}`}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-colors shrink-0 ${
                                allEmpSelected
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                              }`}
                            >
                              {empCount}×
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {FINDING_TYPE_LABELS[f.finding_type] ?? f.finding_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[f.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
                          {f.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{f.reason}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {f.created_at ? new Date(f.created_at).toLocaleDateString('en-AU') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-indigo-600 text-xs font-medium">Review →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white">
              <p className="text-xs text-gray-400">
                Showing <span className="font-medium text-gray-600">{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-medium text-gray-600">{filtered.length}</span> findings
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center gap-1.5">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-gray-300">…</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={`text-xs w-8 h-8 rounded-lg font-medium transition-colors ${p === page ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:hover:bg-transparent transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bulk bar */}
      {!isAuditor && canAct && (
        <BulkActionBar
          selectedIds={selectedIds} findings={findings}
          onClear={() => setSelectedIds(new Set())}
          onRemediate={() => setBulkModal('remediation')}
          onException={() => setBulkModal('exception')}
        />
      )}

      {/* Bulk modal — opens directly to the triggered action */}
      {bulkModal && (
        <BulkModal
          selectedIds={selectedIds} findings={findings} connectors={connectors}
          user={user} initialMode={bulkModal}
          onClose={() => setBulkModal(null)}
          onDone={() => { fetchData(); setSelectedIds(new Set()) }}
        />
      )}

      {/* Single finding modal */}
      {(selectedFinding || modalLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            {!selectedFinding ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedFinding.employee_name}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {FINDING_TYPE_LABELS[selectedFinding.finding_type] ?? selectedFinding.finding_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[selectedFinding.risk_level]}`}>{selectedFinding.risk_level}</span>
                    <button onClick={closeModal} className="text-gray-300 hover:text-gray-600 text-2xl leading-none ml-1">×</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Status</span>
                    <p className="mt-1"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedFinding.status]}`}>{selectedFinding.status}</span></p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Detected</span>
                    <p className="mt-1 text-gray-700">{selectedFinding.created_at ? new Date(selectedFinding.created_at).toLocaleDateString('en-AU') : '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Reason</span>
                    <p className="mt-1 text-gray-700">{selectedFinding.reason}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Recommendation</span>
                    <p className="mt-1 text-gray-700">{selectedFinding.recommendation}</p>
                  </div>
                </div>

                {remediationActions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Remediation History</h3>
                    <div className="space-y-2">
                      {remediationActions.map(ra => (
                        <div key={ra.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-indigo-800">{PLATFORM_LABELS[ra.target_platform] ?? ra.target_platform}</span>
                            <span className="font-mono text-xs text-indigo-400 ml-2">{ra.external_reference}</span>
                          </div>
                          <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full capitalize">{ra.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isAuditor && canAct && (
                  <div className="border-t border-gray-100 pt-6">
                    {actionView === 'choice' && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-4">Governance Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => setActionView('remediation')} className="flex flex-col items-start p-4 border-2 border-indigo-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left">
                            <span className="text-indigo-700 font-medium text-sm mb-1">Launch Remediation</span>
                            <span className="text-gray-400 text-xs">Route to SailPoint, Entra, or ServiceNow</span>
                          </button>
                          <button onClick={() => setActionView('exception')} className="flex flex-col items-start p-4 border-2 border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors text-left">
                            <span className="text-gray-700 font-medium text-sm mb-1">Grant Temporary Exception</span>
                            <span className="text-gray-400 text-xs">Allow access with business justification</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {actionView === 'remediation' && (
                      <div>
                        <button onClick={() => setActionView('choice')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 block">← Back</button>
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Launch Remediation</h3>
                        <p className="text-xs text-gray-400 mb-4">Select a connected platform. A governance task will be generated and tracked with a reference ID.</p>
                        <div className="space-y-2 mb-4">
                          {activeConnectors.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">No active connectors configured.</p>
                          ) : activeConnectors.map(c => (
                            <button key={c.id} onClick={() => { setSelectedPlatform(c.platform); setSelectedConnectorId(c.id) }}
                              className={`w-full flex items-center justify-between p-3 border-2 rounded-xl transition-colors text-left ${selectedPlatform === c.platform ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}`}>
                              <div>
                                <span className="text-sm font-medium text-gray-800">{c.name}</span>
                                <span className="text-xs text-gray-400 ml-2">{c.connector_type.toUpperCase()}</span>
                              </div>
                              {selectedPlatform === c.platform && <span className="text-indigo-600 text-xs font-medium">Selected ✓</span>}
                            </button>
                          ))}
                        </div>
                        <div className="mb-4">
                          <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
                          <textarea value={remediationNotes} onChange={e => setRemediationNotes(e.target.value)} placeholder="Add context for the receiving system..." className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={3} />
                        </div>
                        <button onClick={handleLaunchRemediation} disabled={!selectedPlatform || modalLoading} className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          {modalLoading ? 'Launching...' : 'Launch Remediation'}
                        </button>
                      </div>
                    )}
                    {actionView === 'exception' && (
                      <div>
                        <button onClick={() => setActionView('choice')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 block">← Back</button>
                        <h3 className="text-sm font-medium text-gray-700 mb-4">Grant Temporary Exception</h3>
                        <div className="space-y-3 mb-4">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Business Justification</label>
                            <textarea value={exceptionJustification} onChange={e => setExceptionJustification(e.target.value)} placeholder="Explain why this access should be temporarily retained..." className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={3} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Expiry Date</label>
                            <input type="date" value={exceptionExpiry} onChange={e => setExceptionExpiry(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </div>
                        <button onClick={handleGrantException} disabled={!exceptionJustification || !exceptionExpiry || modalLoading} className="w-full bg-gray-800 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          {modalLoading ? 'Granting...' : 'Grant Exception'}
                        </button>
                      </div>
                    )}
                    {actionView === 'success' && (
                      <div className="text-center py-6">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {remediationResult ? (
                          <>
                            <p className="text-sm font-semibold text-gray-800 mb-1">Remediation Launched</p>
                            <p className="text-xs text-gray-400 mb-3">Routed to {PLATFORM_LABELS[remediationResult.target_platform] ?? remediationResult.target_platform}</p>
                            <p className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2 rounded-xl inline-block">{remediationResult.external_reference}</p>
                            <p className="text-xs text-gray-300 mt-2">Track this reference in your connected platform</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-gray-700">Exception granted successfully.</p>
                        )}
                        <button onClick={closeModal} className="mt-5 text-sm text-indigo-600 hover:text-indigo-800 block mx-auto">Close</button>
                      </div>
                    )}
                  </div>
                )}

                {isAuditor && (
                  <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
                    Governance actions unavailable in auditor view.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
