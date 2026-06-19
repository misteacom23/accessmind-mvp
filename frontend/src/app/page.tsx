"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { trendsApi, notificationApi, workflowApi } from "@/lib/api"
import type { TrendSummary, HotspotSystem, GovernanceNotification } from "@/types"
import TrendChart from "@/components/TrendChart"
import WorkloadPanel from "@/components/WorkloadPanel"

function DeltaBadge({ direction, delta_pct }: { direction: string; delta_pct: number }) {
  const abs = Math.abs(delta_pct)
  if (direction === "flat") return <span className="text-xs text-gray-400">No change</span>
  const up = direction === "up"
  return (
    <span className={["text-xs font-medium", up ? "text-red-500" : "text-emerald-600"].join(" ")}>
      {up ? "+" : "-"}{abs}% vs 7d ago
    </span>
  )
}

function KpiCard({ label, value, unit, direction, delta_pct, valueColor }: {
  label: string; value: number; unit?: string
  direction: string; delta_pct: number; valueColor: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end gap-1 mb-2">
        <span className={["text-3xl font-bold", valueColor].join(" ")}>
          {value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
        </span>
        {unit && <span className="text-sm text-gray-400 mb-0.5">{unit}</span>}
      </div>
      <DeltaBadge direction={direction} delta_pct={delta_pct} />
    </div>
  )
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const STORY_PHASE_STYLES: Record<string, string> = {
  detection:  "bg-amber-50 text-amber-700 border-amber-200",
  escalation: "bg-red-50 text-red-700 border-red-200",
  resolution: "bg-emerald-50 text-emerald-700 border-emerald-200",
}

const STORY_META: Record<string, { phase: string; description: string; title: string }> = {
  engineer_team_move: {
    phase: "escalation",
    title: "Engineer Team Transfer — Stale Privileged Access",
    description: "Marcus Johnson moved teams 47 days ago — stale AWS and Terraform access detected, SLA breached, routed to SailPoint.",
  },
  cyberark_orphaned_safe: {
    phase: "detection",
    title: "CyberArk PAM Safe — Missing Governance Owner",
    description: "CyberArk PAM safe with 14 service accounts has no active governance owner — recertification campaign pending.",
  },
  aws_package_sprawl: {
    phase: "detection",
    title: "AWS Admin Package Sprawl — Duplicate Entitlement Paths",
    description: "Three overlapping AWS admin packages detected — governance debt +8 points, consolidation recommendation generated.",
  },
}

const QUICK_ACTIONS = [
  { label: "Workflow Queue",     path: "/workflows",      color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100",  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",  summaryKey: "open_workflows" },
  { label: "Active Campaigns",   path: "/campaigns",      color: "text-purple-600",  bg: "bg-purple-50",  border: "border-purple-100",  icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z", summaryKey: null },
  { label: "Governance Hygiene", path: "/hygiene",        color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100",   icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", summaryKey: null },
  { label: "Role Discovery",     path: "/role-discovery", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", summaryKey: null },
]

export default function GovernanceOperationsDashboard() {
  const router = useRouter()
  const [summary, setSummary]   = useState<TrendSummary | null>(null)
  const [hotspots, setHotspots] = useState<HotspotSystem[]>([])
  const [stories, setStories]   = useState<{ key: string; phase: string; title: string; description: string }[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    const [sum, hot, wfRes] = await Promise.allSettled([
      trendsApi.summary(),
      trendsApi.hotspots(),
      workflowApi.list() as Promise<{ story_key?: string; title: string }[]>,
    ])
    if (sum.status === "fulfilled") setSummary(sum.value)
    if (hot.status === "fulfilled") setHotspots(hot.value)
    if (wfRes.status === "fulfilled") {
      const seen = new Set<string>()
      const items: typeof stories = []
      for (const wf of wfRes.value ?? []) {
        if (wf.story_key && !seen.has(wf.story_key) && STORY_META[wf.story_key]) {
          seen.add(wf.story_key)
          const m = STORY_META[wf.story_key]
          items.push({ key: wf.story_key, ...m })
        }
      }
      setStories(items)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Governance Operations</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide governance intelligence — live operational view</p>
        </div>
        <span className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {/* KPI row */}
      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Governance Debt Score"
            value={summary.debt_score.current}
            unit="/ 100"
            direction={summary.debt_score.direction}
            delta_pct={summary.debt_score.delta_pct}
            valueColor={
              summary.debt_score.current >= 70 ? "text-red-600" :
              summary.debt_score.current >= 50 ? "text-amber-500" : "text-emerald-600"
            }
          />
          <KpiCard
            label="Open Workflows"
            value={summary.open_workflows.current}
            direction={summary.open_workflows.direction}
            delta_pct={summary.open_workflows.delta_pct}
            valueColor="text-gray-900"
          />
          <KpiCard
            label="Active Escalations"
            value={summary.escalation_count.current}
            direction={summary.escalation_count.direction}
            delta_pct={summary.escalation_count.delta_pct}
            valueColor={summary.escalation_count.current > 5 ? "text-red-600" : "text-amber-500"}
          />
          <KpiCard
            label="Remediation (30d)"
            value={summary.remediation_throughput.current}
            unit="resolved"
            direction={summary.remediation_throughput.direction}
            delta_pct={summary.remediation_throughput.delta_pct}
            valueColor="text-emerald-600"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left col — stories → trend → hotspots */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Governance Stories — narrative context first */}
          {loading ? (
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ) : stories.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Active Governance Stories</h2>
              <p className="text-xs text-gray-400 mb-4">Narrative governance scenarios in progress</p>
              <div className="space-y-3">
                {stories.map(s => (
                  <div
                    key={s.key}
                    onClick={() => router.push("/workflows")}
                    className="p-4 rounded-lg border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-xs font-semibold text-gray-900 leading-snug">{s.title}</p>
                      <span className={[
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide shrink-0",
                        STORY_PHASE_STYLES[s.phase] ?? "bg-gray-100 text-gray-500 border-gray-200",
                      ].join(" ")}>
                        {s.phase}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.description}</p>
                    <p className="text-[10px] text-indigo-600 font-medium mt-2">View in Workflows →</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Governance Debt Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Governance Debt Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">30-day platform-wide debt score</p>
              </div>
              {summary && (
                <div className="text-right">
                  <span className={[
                    "text-2xl font-bold",
                    summary.debt_score.current >= 70 ? "text-red-600" :
                    summary.debt_score.current >= 50 ? "text-amber-500" : "text-emerald-600",
                  ].join(" ")}>
                    {summary.debt_score.current.toFixed(1)}
                  </span>
                  <p className="text-[10px] text-gray-400">current score</p>
                </div>
              )}
            </div>
            <TrendChart
              metricType="debt_score"
              label="debt score"
              color="#f59e0b"
              days={30}
              height={140}
              showReference={70}
            />
            <p className="text-[10px] text-gray-400 mt-3">
              Red dashed line = critical threshold (70). Above this triggers governance escalation review.
            </p>
          </div>

          {/* System Governance Hotspots */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">System Governance Hotspots</h2>
            <p className="text-xs text-gray-400 mb-4">Latest debt score per connected system</p>
            {hotspots.length === 0 ? (
              <div className="h-20 flex items-center justify-center text-gray-400 text-xs">No system data available</div>
            ) : (
              <div className="space-y-3">
                {hotspots.map((h, idx) => (
                  <div key={h.system} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 text-right shrink-0">{idx + 1}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate font-medium">{h.system}</span>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={[
                          "h-full rounded-full",
                          h.debt_score >= 70 ? "bg-red-500" :
                          h.debt_score >= 50 ? "bg-amber-400" : "bg-emerald-500",
                        ].join(" ")}
                        style={{ width: `${h.debt_score}%` }}
                      />
                    </div>
                    <span className={[
                      "text-xs font-bold w-8 text-right shrink-0",
                      h.debt_score >= 70 ? "text-red-600" :
                      h.debt_score >= 50 ? "text-amber-500" : "text-emerald-600",
                    ].join(" ")}>
                      {h.debt_score.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right col — quick actions (top) → workload */}
        <div className="space-y-6">

          {/* Quick Actions — 2x2 grid, always visible at top */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.path}
                  onClick={() => router.push(a.path)}
                  className={[
                    "flex flex-col items-start gap-2 p-3 rounded-lg border transition-all hover:shadow-sm hover:scale-[1.02]",
                    a.bg, a.border,
                  ].join(" ")}
                >
                  <div className={["w-7 h-7 rounded-md flex items-center justify-center", a.bg].join(" ")}>
                    <svg className={["w-4 h-4", a.color].join(" ")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={a.icon} />
                    </svg>
                  </div>
                  <span className={["text-xs font-semibold leading-snug text-left", a.color].join(" ")}>
                    {a.label}
                  </span>
                  {a.summaryKey === "open_workflows" && summary && (
                    <span className="text-[10px] text-gray-400">{summary.open_workflows.current} open</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Workload Intelligence */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Workload Intelligence</h2>
            <p className="text-xs text-gray-400 mb-4">Live queue and owner overload analysis</p>
            <WorkloadPanel />
          </div>

        </div>
      </div>
    </div>
  )
}
