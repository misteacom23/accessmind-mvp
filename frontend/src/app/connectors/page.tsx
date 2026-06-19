'use client'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { api } from '@/lib/api'
import { Connector } from '@/types'

const PLATFORM_ICONS: Record<string, string> = {
  sailpoint:  '⚓',
  entra:      '☁',
  servicenow: '🎫',
  okta:       '🔐',
  cyberark:   '🛡',
  splunk:     '📊',
}
const TYPE_COLORS: Record<string, string> = {
  iam:  'bg-indigo-100 text-indigo-700',
  pam:  'bg-red-100 text-red-700',
  itsm: 'bg-purple-100 text-purple-700',
  siem: 'bg-orange-100 text-orange-700',
}

function formatSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Never synced'
  const diffMs  = Date.now() - new Date(lastSyncAt).getTime()
  const mins    = Math.floor(diffMs / 60_000)
  const hours   = Math.floor(diffMs / 3_600_000)
  const days    = Math.floor(diffMs / 86_400_000)
  if (mins < 1)    return 'Just now'
  if (mins < 60)   return `${mins} minute${mins === 1 ? '' : 's'} ago`
  if (hours < 24)  return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days === 1)  return '1 day ago'
  return `${days} days ago`
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    api.connectors()
      .then(setConnectors)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const active      = connectors.filter(c => c.status === 'active')
  const comingSoon  = connectors.filter(c => c.status !== 'active')
  const totalRecords = active.reduce((sum, c) => sum + c.record_count, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Connectors"
        subtitle="Integration ecosystem — source systems and remediation targets"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{active.length}</div>
          <div className="text-xs text-gray-400 mt-1">Active Connectors</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-300">{comingSoon.length}</div>
          <div className="text-xs text-gray-400 mt-1">Coming Soon</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-indigo-600">{totalRecords.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Records Synced</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading connectors...</div>
      ) : (
        <div className="space-y-3">
          {/* Active connectors first */}
          {active.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-5">
              <div className="text-2xl w-10 text-center shrink-0 mt-0.5">
                {PLATFORM_ICONS[c.platform] ?? '⚡'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.connector_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.connector_type.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">{c.description}</p>
                <div className="flex items-center gap-5 text-xs text-gray-500">
                  <span>Last sync: {formatSync(c.last_sync_at)}</span>
                  <span>{c.record_count.toLocaleString()} records</span>
                  {c.remediation_action_count > 0 && (
                    <span className="text-indigo-500">{c.remediation_action_count} remediations routed</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Active
                </span>
                {c.base_url && (
                  <span className="text-xs text-gray-300 font-mono truncate max-w-48">{c.base_url}</span>
                )}
              </div>
            </div>
          ))}

          {/* Coming soon connectors — visually separated */}
          {comingSoon.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-2 pb-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Coming in Phase 5</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {comingSoon.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-5 opacity-55">
                  <div className="text-2xl w-10 text-center shrink-0 mt-0.5">
                    {PLATFORM_ICONS[c.platform] ?? '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-600">{c.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.connector_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.connector_type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{c.description}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                      Coming Soon
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Phase 5 roadmap note */}
      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-400 text-center">
        Full connector sync and provisioning callbacks arrive in Phase 5 — SCIM, OAuth, and webhook-based remediation flows.
      </div>
    </div>
  )
}
