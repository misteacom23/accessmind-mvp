"use client"
import { useState, useMemo } from "react"
import { ArrowLeftRight, Play, AlertTriangle, CheckCircle2 } from "lucide-react"
import { api, MoverFinding, MoverResult } from "@/lib/api"
import { PageHeader } from "@/components/PageHeader"
import { Badge, riskVariant } from "@/components/Badge"

const PAGE_SIZE = 15

export default function MoversPage() {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<MoverResult | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState("")
  const [riskFilter, setRiskFilter] = useState("")
  const [page, setPage]         = useState(1)

  const runDetection = async () => {
    setLoading(true)
    setError(null)
    setPage(1)
    try {
      const res = await api.detectMovers()
      setResult(res)
    } catch {
      setError("Failed to run mover detection. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return (result?.findings ?? []).filter(f => {
      const q = search.toLowerCase()
      const matchSearch =
        f.employee_name.toLowerCase().includes(q) ||
        f.current_team.toLowerCase().includes(q) ||
        f.previous_team?.toLowerCase().includes(q) ||
        f.risk_level.toLowerCase().includes(q)
      const matchRisk = !riskFilter || f.risk_level === riskFilter
      return matchSearch && matchRisk
    })
  }, [result, search, riskFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }
  const handleRiskChange   = (val: string) => { setRiskFilter(val); setPage(1) }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Mover Detection"
        subtitle="Detect employees who still hold access from their previous team after an internal transfer."
        action={
          <button
            onClick={runDetection} disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Scanning...</>
            ) : (
              <><Play size={14} />Run Detection</>
            )}
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 mb-6">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state — no scan yet */}
      {!result && !error && (
        <div className="bg-white rounded-2xl border border-gray-200 h-72 flex items-center justify-center shadow-sm">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <ArrowLeftRight size={26} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 font-medium">No scan has been run yet.</p>
            <p className="text-xs text-gray-400 mt-1">Click <strong>Run Detection</strong> to scan for stale access.</p>
            <p className="text-xs text-gray-400 mt-3 max-w-xs mx-auto leading-relaxed">
              Findings will auto-clear on the next run once resolved or remediated via the Findings page.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: result.total_open_mover_findings, label: "Open Mover Findings", color: "text-red-600",   bg: "bg-red-50 border-red-200"    },
              { value: result.new_findings_created,      label: "New This Run",         color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
              { value: result.findings.filter(f => f.risk_level === "High" || f.risk_level === "Critical").length, label: "High / Critical Risk", color: "text-red-700", bg: "bg-red-50 border-red-200" },
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* All clear */}
          {result.findings.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">No stale access detected</p>
                <p className="text-xs text-emerald-700 mt-0.5">All movers appear to have correct access for their current team.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Toolbar */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900 text-sm">Stale Access Findings</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{filtered.length} finding{filtered.length !== 1 ? "s" : ""}</p>
                </div>
                <input
                  type="text" placeholder="Search employee or team..."
                  value={search} onChange={e => handleSearchChange(e.target.value)}
                  className="w-52 rounded-xl border border-gray-200 px-3 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={riskFilter} onChange={e => handleRiskChange(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Risk Levels</option>
                  {["Critical", "High", "Medium", "Low"].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {(search || riskFilter) && (
                  <button
                    onClick={() => { handleSearchChange(""); handleRiskChange("") }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-gray-400">No findings match your filters.</p>
                  <button
                    onClick={() => { handleSearchChange(""); handleRiskChange("") }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 block mx-auto"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Employee", "Previous Team", "Current Team", "Risk", "Stale Access", "Recommendation"].map(h => (
                            <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginated.map(f => {
                          const match = f.reason.match(/still holds '([^']+)'/)
                          const staleGroup = match ? match[1] : "—"
                          return (
                            <tr key={f.finding_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">{f.employee_name}</td>
                              <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{f.previous_team}</td>
                              <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{f.current_team}</td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <Badge label={f.risk_level} variant={riskVariant(f.risk_level)} />
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <code className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-mono">{staleGroup}</code>
                              </td>
                              <td className="px-5 py-3.5 max-w-xs">
                                <p className="text-xs text-gray-500 leading-relaxed">{f.recommendation}</p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white">
                      <p className="text-xs text-gray-400">
                        Showing <span className="font-medium text-gray-600">{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-medium text-gray-600">{filtered.length}</span> findings
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                          className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
