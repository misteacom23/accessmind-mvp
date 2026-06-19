"use client"
import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { trendsApi } from "@/lib/api"
import type { TrendSnapshot } from "@/types"

interface Props {
  metricType: string
  label: string
  color?: string
  days?: number
  height?: number
  showReference?: number
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" })
}

function CustomTooltip({ active, payload, label, metricLabel }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  metricLabel: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">
        {Number(payload[0].value).toFixed(1)}
        <span className="text-xs font-normal text-slate-400 ml-1">{metricLabel}</span>
      </p>
    </div>
  )
}

export default function TrendChart({
  metricType,
  label,
  color = "#3b82f6",
  days = 30,
  height = 120,
  showReference,
}: Props) {
  const [data, setData]       = useState<TrendSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    trendsApi.snapshots({ metric_type: metricType, days })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [metricType, days])

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-600 text-xs" style={{ height }}>
        No trend data available
      </div>
    )
  }

  const min = Math.min(...data.map(d => d.value))
  const max = Math.max(...data.map(d => d.value))
  const padding = (max - min) * 0.15 || 5

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 5)}
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => Number(v).toFixed(0)}
        />
        <Tooltip content={<CustomTooltip metricLabel={label} />} />
        {showReference !== undefined && (
          <ReferenceLine
            y={showReference}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "#0f172a", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
