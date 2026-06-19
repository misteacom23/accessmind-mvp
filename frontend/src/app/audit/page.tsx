"use client"
import { useEffect, useState, useMemo } from "react"
import { ScrollText, AlertTriangle, Filter, CheckCircle2, XCircle, Plus, RefreshCw, ArrowLeftRight, Clock, Calendar, Zap } from "lucide-react"
import { api } from "@/lib/api"
import type { AuditLog } from "@/types"
import { PageHeader } from "@/components/PageHeader"

const PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  FINDING_CREATED:         <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><Plus size={13} className="text-blue-600" /></div>,
  FINDING_STATUS_UPDATED:  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center"><RefreshCw size={13} className="text-amber-600" /></div>,
  REMEDIATION_LAUNCHED:    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center"><Zap size={13} className="text-indigo-600" /></div>,
  APPROVAL_CREATED:        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center"><ArrowLeftRight size={13} className="text-purple-600" /></div>,
  APPROVAL_APPROVED:       <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 size={13} className="text-emerald-600" /></div>,
  APPROVAL_REJECTED:       <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center"><XCircle size={13} className="text-red-600" /></div>,
  EXCEPTION_CREATED:       <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center"><Calendar size={13} className="text-amber-600" /></div>,
  EXCEPTION_EXPIRED:       <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center"><Clock size={13} className="text-orange-600" /></div>,
  EXCEPTION_REVOKED:       <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><XCircle size={13} className="text-gray-500" /></div>,
}

const ACTION_COLORS: Record<string, string> = {
  FINDING_CREATED:        "text-blue-700 bg-blue-50 border-blue-200",
  FINDING_STATUS_UPDATED: "text-amber-700 bg-amber-50 border-amber-200",
  REMEDIATION_LAUNCHED:   "text-indigo-700 bg-indigo-50 border-indigo-200",
  APPROVAL_CREATED:       "text-purple-700 bg-purple-50 border-purple-200",
  APPROVAL_APPROVED:      "text-emerald-700 bg-emerald-50 border-emerald-200",
  APPROVAL_REJECTED:      "text-red-700 bg-red-50 border-red-200",
  EXCEPTION_CREATED:      "text-amber-700 bg-amber-50 border-amber-200",
  EXCEPTION_EXPIRED:      "text-orange-700 bg-orange-50 border-orange-200",
  EXCEPTION_REVOKED:      "text-gray-600 bg-gray-50 border-gray-200",
}

const ACTION_LABELS: Record<string, string> = {
  FINDING_CREATED:        "Finding Created",
  FINDING_STATUS_UPDATED: "Status Updated",
  REMEDIATION_LAUNCHED:   "Remediation Launched",
  APPROVAL_CREATED:       "Approval Created",
  APPROVAL_APPROVED:      "Approved",
  APPROVAL_REJECTED:      "Rejected",
  EXCEPTION_CREATED:      "Exception Granted",
  EXCEPTION_EXPIRED:      "Exception Expired",
  EXCEPTION_REVOKED:      "Exception Revoked",
}

const ACTION_TYPES = [
  "All",
  "REMEDIATION_LAUNCHED",
  "FINDING_CREATED",
  "FINDING_STATUS_UPDATED",
  "APPROVAL_CREATED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "EXCEPTION_CREATED",
  "EXCEPTION_EXPIRED",
  "EXCEPTION_REVOKED",
]

export default function AuditPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState("")
  const [typeFilter, setTypeFilter] = useState("All")
  const [page, setPage]       = useState(1)

  useEffect(() => {
    api.auditLogs()
      .then(res => setLogs(res.logs))
      .catch(() => setError("Could not load audit logs."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { setPage(1) }, [search, typeFilter])

  const filtered = useMemo(() => logs.filter(l => {
    const q = search.toLowerCase()
    const matchSearch =
      l.details?.toLowerCase().includes(q) ||
      l.performed_by?.toLowerCase().includes(q) ||
      l.action_type?.toLowerCase().includes(q)
    const matchType = typeFilter === "All" || l.action_type === typeFilter
    return matchSearch && matchType
  }), [logs, search, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Summary cards — only action types that have entries
  const summaryTypes = ACTION_TYPES.slice(1).filter(t => logs.some(l => l.action_type === t))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading audit logs…</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Log"
        subtitle="Complete chronological record of all governance actions in AccessMind."
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 mb-6">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      {summaryTypes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {summaryTypes.map(type => {
            const count = logs.filter(l => l.action_type === type).length
            const color = ACTION_COLORS[type] ?? "text-gray-600 bg-gray-50 border-gray-200"
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? "All" : type)}
                className={`rounded-xl border p-3 text-left transition-all ${color} ${typeFilter === type ? "ring-2 ring-offset-1 ring-indigo-400" : "hover:opacity-80"}`}
              >
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs mt-0.5 opacity-80 leading-tight">{ACTION_LABELS[type]}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Log table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>
                {t === "All" ? "All Actions" : ACTION_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          {(search || typeFilter !== "All") && (
            <button
              onClick={() => { setSearch(""); setTypeFilter("All") }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {/* Entries */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <ScrollText size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No audit entries found.</p>
            {(search || typeFilter !== "All") && (
              <button
                onClick={() => { setSearch(""); setTypeFilter("All") }}
                className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 block mx-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {paginated.map(log => (
                <div key={log.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {ACTION_ICONS[log.action_type] ?? (
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                        <Clock size={13} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ACTION_COLORS[log.action_type] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
                        {ACTION_LABELS[log.action_type] ?? log.action_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        by <span className="font-medium text-gray-700">{log.performed_by}</span>
                      </span>
                      {log.target_type && (
                        <span className="text-xs text-gray-400">
                          → {log.target_type} #{log.target_id}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-700 leading-relaxed">{log.details}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-gray-400 mt-0.5 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white">
              <p className="text-xs text-gray-400">
                Showing <span className="font-medium text-gray-600">{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-medium text-gray-600">{filtered.length}</span> entries
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
                        className={`text-xs w-8 h-8 rounded-lg font-medium transition-colors ${p === page ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"}`}
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
    </div>
  )
}
