'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { campaignApi } from '@/lib/api'
import type { GovernanceCampaign, CampaignReviewItem, CampaignsOverview } from '@/types'

const PAGE_SIZE = 6

const STATUS_COLOURS: Record<string, string> = {
  draft:     'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  active:    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  archived:  'bg-slate-600/20 text-slate-500 border border-slate-600/30',
}
const TYPE_LABELS: Record<string, string> = {
  privileged_review:   'Privileged Review',
  stale_access_review: 'Stale Access Review',
  recertification:     'Recertification',
  hygiene_campaign:    'Hygiene Campaign',
}
const TYPE_COLOURS: Record<string, string> = {
  privileged_review:   'text-red-400',
  stale_access_review: 'text-orange-400',
  recertification:     'text-blue-400',
  hygiene_campaign:    'text-purple-400',
}
const ITEM_STATUS_COLOURS: Record<string, string> = {
  pending:   'bg-slate-500/20 text-slate-400',
  confirmed: 'bg-green-500/20 text-green-400',
  rejected:  'bg-red-500/20 text-red-400',
  escalated: 'bg-orange-500/20 text-orange-400',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CompletionRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r      = (size - 6) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const colour = pct === 100 ? '#22c55e' : pct >= 75 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={colour} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={colour} fontSize={size === 48 ? 10 : 9}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// ── Review drawer ──────────────────────────────────────────────────────────────
function ReviewDrawer({ campaign, onClose, onRefresh }: {
  campaign: GovernanceCampaign
  onClose: () => void
  onRefresh: () => void
}) {
  const [items, setItems]           = useState<CampaignReviewItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [actioning, setActioning]   = useState<number | null>(null)

  useEffect(() => {
    campaignApi.items(campaign.id, filterStatus || undefined).then((data) => {
      setItems((data as CampaignReviewItem[]) || [])
      setLoading(false)
    })
  }, [campaign.id, filterStatus])

  async function handleAction(item: CampaignReviewItem, decision: string) {
    setActioning(item.id)
    await campaignApi.actionItem(campaign.id, item.id, { decision })
    const updated = await campaignApi.items(campaign.id, filterStatus || undefined)
    setItems((updated as CampaignReviewItem[]) || [])
    setActioning(null)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1117] border-l border-slate-700/50 flex flex-col h-full">
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Review Items</p>
            <h2 className="text-white font-semibold">{campaign.campaign_name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOURS[campaign.status]}`}>{campaign.status}</span>
              <span className="text-xs text-slate-500">{campaign.completion_pct}% complete</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none mt-1">×</button>
        </div>
        <div className="flex gap-1 px-6 pt-4 bg-[#0f1117] border-b border-slate-800 pb-3">
          {[
            { label: 'All', value: '' }, { label: 'Pending', value: 'pending' },
            { label: 'Confirmed', value: 'confirmed' }, { label: 'Rejected', value: 'rejected' },
            { label: 'Escalated', value: 'escalated' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterStatus === opt.value ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <p className="text-slate-500 text-sm">Loading review items...</p>
          ) : items.length === 0 ? (
            <p className="text-slate-500 text-sm">No items found.</p>
          ) : items.map(item => (
            <div key={item.id} className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ITEM_STATUS_COLOURS[item.status]}`}>{item.status}</span>
                    {item.is_privileged && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Privileged</span>}
                  </div>
                  <p className="text-white text-sm font-medium">{item.role_name || '—'}</p>
                  <p className="text-xs text-slate-500">{item.application}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{item.assigned_to || '—'}</p>
                  {item.reviewed_at && <p className="mt-0.5">{formatDate(item.reviewed_at)}</p>}
                </div>
              </div>
              {item.status === 'pending' && campaign.status === 'active' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/40">
                  <button disabled={actioning === item.id} onClick={() => handleAction(item, 'confirmed')}
                    className="text-xs px-3 py-1.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50">
                    Confirm Access
                  </button>
                  <button disabled={actioning === item.id} onClick={() => handleAction(item, 'rejected')}
                    className="text-xs px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                    Reject Access
                  </button>
                  <button disabled={actioning === item.id} onClick={() => handleAction(item, 'escalated')}
                    className="text-xs px-3 py-1.5 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50 ml-auto">
                    Escalate
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Create campaign modal ──────────────────────────────────────────────────────
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ campaign_name: '', campaign_type: 'privileged_review', target_system: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit() {
    if (!form.campaign_name.trim()) { setError('Campaign name is required'); return }
    setSaving(true)
    const payload: Record<string, unknown> = { campaign_name: form.campaign_name, campaign_type: form.campaign_type }
    if (form.target_system.trim()) payload.target_system = form.target_system.trim()
    await campaignApi.create(payload)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0f1117] border border-slate-700/50 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-white font-semibold mb-4">New Governance Campaign</h2>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Campaign Name</label>
            <input type="text" value={form.campaign_name}
              onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
              placeholder="e.g. Q3 Privileged Access Review"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Campaign Type</label>
            <select value={form.campaign_type} onChange={e => setForm(f => ({ ...f, campaign_type: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2">
              <option value="privileged_review">Privileged Access Review</option>
              <option value="stale_access_review">Stale Access Review</option>
              <option value="recertification">Access Recertification</option>
              <option value="hygiene_campaign">Governance Hygiene Campaign</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target System (optional)</label>
            <input type="text" value={form.target_system}
              onChange={e => setForm(f => ({ ...f, target_system: e.target.value }))}
              placeholder="e.g. AWS, SAP ERP, GitHub"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 text-sm py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campaign card ──────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onOpen, onLaunch }: {
  campaign: GovernanceCampaign
  onOpen: (c: GovernanceCampaign) => void
  onLaunch: (id: number) => void
}) {
  const daysLabel = () => {
    if (campaign.days_remaining === null || campaign.status !== 'active') return null
    if (campaign.is_overdue && Math.abs(campaign.days_remaining) === 0) return null // hide 0d overdue
    if (campaign.is_overdue) return <span className="text-orange-400">{Math.abs(campaign.days_remaining)}d overdue</span>
    if (campaign.days_remaining === 0) return <span className="text-yellow-400">Due today</span>
    return <span className="text-slate-400">{campaign.days_remaining}d remaining</span>
  }

  return (
    <div className={`bg-[#0f1117] border rounded-lg p-5 transition-all ${campaign.is_overdue ? 'border-orange-500/40' : 'border-slate-700/50'}`}>
      <div className="flex items-start gap-4 mb-3">
        <CompletionRing pct={campaign.completion_pct} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[campaign.status]}`}>{campaign.status}</span>
            <span className={`text-xs font-medium ${TYPE_COLOURS[campaign.campaign_type] || 'text-slate-400'}`}>
              {TYPE_LABELS[campaign.campaign_type] || campaign.campaign_type}
            </span>
            {campaign.is_overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Overdue</span>
            )}
          </div>
          <h3 className="text-white text-sm font-medium leading-snug">{campaign.campaign_name}</h3>
          {campaign.target_system && <p className="text-xs text-slate-500 mt-0.5">{campaign.target_system}</p>}
        </div>
      </div>

      {campaign.status !== 'draft' && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[
            { label: 'Confirmed', value: campaign.confirmed_count, colour: 'text-green-400' },
            { label: 'Rejected',  value: campaign.rejected_count,  colour: 'text-red-400'   },
            { label: 'Pending',   value: campaign.pending_count,   colour: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/40 rounded-lg py-2">
              <p className={`text-lg font-semibold ${s.colour}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
        <span>Due {formatDate(campaign.due_date)}</span>
        {daysLabel() && <><span>·</span>{daysLabel()}</>}
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-800">
        {campaign.status === 'draft' && (
          <button onClick={() => onLaunch(campaign.id)}
            className="text-xs px-3 py-1.5 rounded border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
            Launch Campaign
          </button>
        )}
        {campaign.status === 'active' && (
          <button onClick={() => onOpen(campaign)}
            className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            Review Items ({campaign.pending_count} pending)
          </button>
        )}
        {campaign.status === 'completed' && (
          <button onClick={() => onOpen(campaign)}
            className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-white transition-colors">
            View Results
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const [campaigns, setCampaigns]         = useState<GovernanceCampaign[]>([])
  const [overview, setOverview]           = useState<CampaignsOverview | null>(null)
  const [loading, setLoading]             = useState(true)
  const [filterStatus, setFilterStatus]   = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<GovernanceCampaign | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [launching, setLaunching]         = useState<number | null>(null)
  const [page, setPage]                   = useState(1)

  const loadData = useCallback(async () => {
    const [c, o] = await Promise.all([
      campaignApi.list(filterStatus ? { status: filterStatus } : undefined),
      campaignApi.overview(),
    ])
    setCampaigns((c as GovernanceCampaign[]) || [])
    setOverview(o as CampaignsOverview)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setPage(1) }, [filterStatus])

  async function handleLaunch(id: number) {
    setLaunching(id)
    await campaignApi.launch(id)
    await loadData()
    setLaunching(null)
  }

  const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE))
  const paginated  = campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Governance Campaigns"
        subtitle="Access recertification, privileged review campaigns, and governance certification workflows."
      />

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active',          value: overview.active,                colour: 'text-blue-400'   },
            { label: 'Overdue',         value: overview.overdue,               colour: 'text-orange-400' },
            { label: 'Pending Reviews', value: overview.pending_reviews,       colour: 'text-yellow-400' },
            { label: 'Avg Completion',  value: `${overview.avg_completion_pct}%`, colour: 'text-green-400' },
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
            { label: 'All', value: '' }, { label: 'Active', value: 'active' },
            { label: 'Draft', value: 'draft' }, { label: 'Completed', value: 'completed' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filterStatus === opt.value ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          + New Campaign
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-slate-500 text-sm py-12 text-center">No campaigns found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onOpen={setSelectedCampaign}
                onLaunch={handleLaunch}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-4 py-2 rounded-lg bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium">
                Prev
              </button>
              <div className="flex gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${p === page ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 text-slate-300 border-slate-500 hover:bg-slate-600'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="text-xs px-4 py-2 rounded-lg bg-slate-700 border border-slate-500 text-slate-200 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium">
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedCampaign && (
        <ReviewDrawer campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} onRefresh={loadData} />
      )}
      {showCreate && (
        <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={loadData} />
      )}
    </div>
  )
}
