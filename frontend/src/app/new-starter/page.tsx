"use client"
import { useState } from "react"
import { Lightbulb, Users, AlertCircle } from "lucide-react"
import { api, RecommendationResult } from "@/lib/api"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/Badge"

const TEAMS = [
  "Cyber Security",
  "Infrastructure Operations",
  "Cloud Engineering",
  "Human Resources",
  "Finance",
  "Risk & Compliance",
  "Enterprise Applications",
]

const ROLES: Record<string, string[]> = {
  "Cyber Security":            ["SOC Analyst", "Security Architect"],
  "Infrastructure Operations": ["Infrastructure Administrator"],
  "Cloud Engineering":         ["Cloud Engineer"],
  "Human Resources":           ["HR Operations Lead"],
  "Finance":                   ["Finance Manager"],
  "Risk & Compliance":         ["Governance Analyst"],
  "Enterprise Applications":   ["IAM Engineer", "Service Delivery Manager"],
}

export default function NewStarterPage() {
  const [team, setTeam]       = useState("")
  const [role, setRole]       = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<RecommendationResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!team || !role) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await api.recommendAccess({ name: "", team, role })
      setResult(res)
    } catch {
      setError("Failed to generate recommendations. Please check the API is running.")
    } finally {
      setLoading(false)
    }
  }

  const handleTeamChange = (val: string) => {
    setTeam(val)
    setRole("")
    setResult(null)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="New Starter Access"
        subtitle="Generate recommended access groups for a new employee based on their peers."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Left — form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">New Starter Profile</h2>
              <p className="text-xs text-gray-400 mt-0.5">Select department and role to generate peer-based access recommendations</p>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={team}
                  onChange={e => handleTeamChange(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select department…</option>
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  disabled={!team}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select role…</option>
                  {(ROLES[team] ?? []).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || !team || !role}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analysing peers…
                  </>
                ) : (
                  <>
                    <Lightbulb size={15} />
                    Generate Recommendations
                  </>
                )}
              </button>
            </form>
          </div>

          {/* How it works */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">How it works</h3>
            {[
              "Finds all active employees in the same department + role",
              "Analyses every access group they currently hold",
              "Calculates how many peers share each group",
              "Recommends groups held by ≥50% of peers",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2.5 last:mb-0">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-gray-600">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — results */}
        <div className="lg:col-span-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 mb-4">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!result && !error && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Lightbulb size={22} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Recommendations will appear here</p>
                <p className="text-xs text-gray-400 mt-1">Select a department and role to get started.</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">

              {/* Peer summary banner */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    {result.peer_count} peer{result.peer_count !== 1 ? "s" : ""} analysed
                  </p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Recommended access for a new <span className="font-semibold">{result.role}</span> in <span className="font-semibold">{result.team}</span> — {result.recommended_access.length} group{result.recommended_access.length !== 1 ? "s" : ""} recommended
                  </p>
                </div>
              </div>

              {result.message && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{result.message}</p>
                </div>
              )}

              {result.recommended_access.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 text-sm">Recommended Access</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Sorted by confidence — highest first. Use this list to provision access in your IAM platform.</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.recommended_access.map(item => (
                      <div key={item.group} className="px-5 py-3.5 flex items-center gap-4">
                        <div className="w-12 shrink-0 text-center">
                          <span className={`text-lg font-bold ${
                            item.confidence >= 80 ? "text-emerald-600" :
                            item.confidence >= 60 ? "text-amber-500" : "text-gray-400"
                          }`}>
                            {item.confidence}%
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-800">{item.group}</p>
                            {item.is_privileged && <Badge label="Privileged" variant="privileged" />}
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                item.confidence >= 80 ? "bg-emerald-500" :
                                item.confidence >= 60 ? "bg-amber-400" : "bg-gray-300"
                              }`}
                              style={{ width: `${item.confidence}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{item.system}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400">
                      Use this list as a reference when provisioning access in your connected IAM platform (SailPoint, Entra ID, or Okta).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
