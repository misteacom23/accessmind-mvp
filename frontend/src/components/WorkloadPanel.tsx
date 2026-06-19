"use client"
import { useEffect, useState } from "react"
import { trendsApi } from "@/lib/api"
import type { WorkloadIntelligence } from "@/types"

export default function WorkloadPanel() {
  const [data, setData]       = useState<WorkloadIntelligence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trendsApi.workload()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.queues.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
        No active governance queues
      </div>
    )
  }

  const maxTotal = Math.max(...data.queues.map(q => q.total), 1)

  return (
    <div className="space-y-4">

      {/* ── SLA summary strip */}
      <div className="flex gap-3">
        <div className={[
          "flex-1 rounded-lg px-3 py-2 border",
          data.sla_breached > 0
            ? "bg-red-50 border-red-200"
            : "bg-gray-50 border-gray-200",
        ].join(" ")}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">SLA Breached</p>
          <p className={[
            "text-xl font-bold",
            data.sla_breached > 0 ? "text-red-600" : "text-gray-700",
          ].join(" ")}>
            {data.sla_breached}
          </p>
        </div>
        <div className={[
          "flex-1 rounded-lg px-3 py-2 border",
          data.sla_due_soon > 0
            ? "bg-amber-50 border-amber-200"
            : "bg-gray-50 border-gray-200",
        ].join(" ")}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Due Soon</p>
          <p className={[
            "text-xl font-bold",
            data.sla_due_soon > 0 ? "text-amber-600" : "text-gray-700",
          ].join(" ")}>
            {data.sla_due_soon}
          </p>
        </div>
      </div>

      {/* ── Queue bars */}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
          Governance Queues
        </p>
        <div className="space-y-2">
          {data.queues.slice(0, 6).map(q => (
            <div key={q.queue}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {q.overloaded && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 truncate">{q.queue}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {q.escalated > 0 && (
                    <span className="text-[10px] text-red-600 font-medium">
                      {q.escalated} escalated
                    </span>
                  )}
                  <span className="text-xs font-semibold text-gray-900 w-6 text-right">
                    {q.total}
                  </span>
                </div>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    q.overloaded  ? "bg-red-500"   :
                    q.escalated > 0 ? "bg-amber-500" : "bg-blue-500",
                  ].join(" ")}
                  style={{ width: `${(q.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Owner overload */}
      {data.owners.some(o => o.overloaded) && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
            Overloaded Owners
          </p>
          <div className="space-y-1">
            {data.owners.filter(o => o.overloaded).slice(0, 4).map(o => (
              <div
                key={o.owner}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200"
              >
                <span className="text-xs text-gray-700 truncate">{o.owner}</span>
                <span className="text-xs font-semibold text-amber-600 shrink-0 ml-2">
                  {o.total} workflows
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
