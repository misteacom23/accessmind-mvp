'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { api, packageApi } from '@/lib/api';
import type { AccessPackage } from '@/types';

const PAGE_SIZE = 15

interface Role {
  id: number;
  role_name: string;
  application: string;
  environment: string;
  access_type: string;
  is_privileged: boolean;
  description: string;
  owner_team: string;
  approval_owner: string;
  requestable: boolean;
  assigned_user_count: number;
  stale_finding_count: number;
  last_reviewed_date: string | null;
  source_system: string;
  source_type: string;
  sync_status: string;
}
interface RoleDetail extends Role {
  related_roles: Role[];
  used_by: { id: number; name: string; job_title: string; department: string }[];
  used_by_total: number;
}
interface FiltersData {
  applications: string[];
  environments: string[];
  access_types: string[];
}

const ENV_COLOURS: Record<string, string> = {
  PRD: 'bg-red-100 text-red-700',
  STG: 'bg-yellow-100 text-yellow-700',
  DEV: 'bg-blue-100 text-blue-700',
  NPD: 'bg-gray-100 text-gray-600',
}
const RISK_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
}

function RiskScoreBar({ score }: { score: number }) {
  const colour = score >= 70 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 30 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold w-6 text-right ${score >= 70 ? 'text-red-600' : score >= 50 ? 'text-orange-600' : 'text-gray-600'}`}>
        {score}
      </span>
    </div>
  )
}

function PackageCard({ pkg, onRoleClick }: { pkg: AccessPackage; onRoleClick: (roleId: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isStale    = pkg.is_stale
  const hasNoOwner = !pkg.governance_owner || pkg.governance_owner.trim() === ''
  return (
    <div className={[
      'bg-white rounded-xl border transition-shadow hover:shadow-md',
      pkg.overlap_flag || pkg.duplicate_flag ? 'border-orange-200' : isStale ? 'border-yellow-200' : 'border-gray-200',
    ].join(' ')}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{pkg.package_name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{pkg.system_scope ?? 'Multiple systems'}</p>
          </div>
          <span className={[
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide shrink-0',
            RISK_STYLES[pkg.risk_level] ?? RISK_STYLES.low,
          ].join(' ')}>
            {pkg.risk_level}
          </span>
        </div>
        {pkg.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{pkg.description}</p>}
        <div className="mb-3">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Risk Score</span>
          <div className="mt-1"><RiskScoreBar score={pkg.risk_score ?? 0} /></div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {isStale    && <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] rounded-full border border-yellow-200 font-medium">Stale Review</span>}
          {hasNoOwner && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] rounded-full border border-red-200 font-medium">No Owner</span>}
          {pkg.overlap_flag   && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] rounded-full border border-orange-200 font-medium">Overlapping</span>}
          {pkg.duplicate_flag && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] rounded-full border border-orange-200 font-medium">Duplicate Risk</span>}
          <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] rounded-full border border-gray-200">
            {pkg.role_count} {pkg.role_count === 1 ? 'role' : 'roles'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Governance Owner</p>
            <p className="text-xs text-gray-700 font-medium truncate mt-0.5">
              {hasNoOwner ? <span className="text-red-500 italic">Unassigned</span> : pkg.governance_owner}
            </p>
          </div>
          {pkg.roles && pkg.roles.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0 ml-3">
              {expanded ? 'Hide roles' : 'View roles'}
            </button>
          )}
        </div>
        {expanded && pkg.roles && pkg.roles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {pkg.roles.map(r => (
              <button key={r.id} onClick={() => onRoleClick(r.id)}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-indigo-50 rounded-lg px-3 py-2 text-left transition-colors">
                <span className="text-xs font-medium text-gray-800">{r.role_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-gray-500">{r.application}</span>
                  {r.is_privileged && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">Priv</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RoleDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'roles' | 'packages'>('roles')

  // ── Roles state
  const [roles, setRoles]       = useState<Role[]>([])
  const [filters, setFilters]   = useState<FiltersData>({ applications: [], environments: [], access_types: [] })
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [appFilter, setAppFilter]             = useState('')
  const [envFilter, setEnvFilter]             = useState('')
  const [accessTypeFilter, setAccessTypeFilter] = useState('')
  const [privilegedFilter, setPrivilegedFilter] = useState<boolean | null>(null)
  const [selectedRole, setSelectedRole]       = useState<RoleDetail | null>(null)
  const [modalLoading, setModalLoading]       = useState(false)
  const [rolePackages, setRolePackages]       = useState<AccessPackage[]>([])
  const [page, setPage]                       = useState(1)

  // ── Packages state
  const [packages, setPackages]           = useState<AccessPackage[]>([])
  const [pkgLoading, setPkgLoading]       = useState(false)
  const [pkgSearch, setPkgSearch]         = useState('')
  const [pkgRiskFilter, setPkgRiskFilter] = useState('')
  const [pkgSystemFilter, setPkgSystemFilter] = useState('')
  const [pkgPage, setPkgPage]             = useState(1)

  // ── Fetch roles (server-side filters, client-side pagination)
  const fetchRoles = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search)          params.q           = search
    if (appFilter)       params.application = appFilter
    if (envFilter)       params.environment = envFilter
    if (accessTypeFilter) params.access_type = accessTypeFilter
    if (privilegedFilter !== null) params.is_privileged = String(privilegedFilter)
    const data = await api.roles(params) as { roles: Role[]; total: number; filters: FiltersData }
    setRoles(data.roles)
    setTotal(data.total)
    setFilters(data.filters)
    setPage(1)
    setLoading(false)
  }, [search, appFilter, envFilter, accessTypeFilter, privilegedFilter])

  useEffect(() => {
    const timer = setTimeout(fetchRoles, 300)
    return () => clearTimeout(timer)
  }, [fetchRoles])

  // ── Fetch packages — FIX: backend returns plain array, not { packages: [] }
  const fetchPackages = useCallback(async () => {
    setPkgLoading(true)
    try {
      const params: Record<string, string> = {}
      if (pkgRiskFilter)   params.risk_level  = pkgRiskFilter
      if (pkgSystemFilter) params.system_scope = pkgSystemFilter
      const data = await packageApi.list(params)
      // Backend returns a plain array — handle both shapes defensively
      const list = Array.isArray(data) ? data : (data as any).packages ?? []
      setPackages(list)
    } catch (err) {
      console.error('Failed to load packages:', err)
      setPackages([])
    }
    setPkgLoading(false)
  }, [pkgRiskFilter, pkgSystemFilter])

  useEffect(() => {
    if (activeTab === 'packages') fetchPackages()
  }, [activeTab, fetchPackages])

  // ── Reset pages on filter change
  useEffect(() => { setPage(1) }, [search, appFilter, envFilter, accessTypeFilter, privilegedFilter])
  useEffect(() => { setPkgPage(1) }, [pkgSearch, pkgRiskFilter, pkgSystemFilter])

  // ── Role modal
  const openModal = async (role: Role) => {
    setModalLoading(true)
    setSelectedRole(null)
    setRolePackages([])
    const [detail, pkgRes] = await Promise.all([
      api.getRole(role.id) as Promise<RoleDetail>,
      packageApi.byRole(role.id).catch(() => []),
    ])
    setSelectedRole(detail as RoleDetail)
    setRolePackages((pkgRes as AccessPackage[]) ?? [])
    setModalLoading(false)
  }

  const clearFilters = () => {
    setSearch(''); setAppFilter(''); setEnvFilter('')
    setAccessTypeFilter(''); setPrivilegedFilter(null)
  }
  const hasActiveFilters = search || appFilter || envFilter || accessTypeFilter || privilegedFilter !== null

  // ── Client-side pagination for roles
  const totalPages  = Math.max(1, Math.ceil(roles.length / PAGE_SIZE))
  const paginated   = roles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Client-side search + pagination for packages
  const filteredPackages = useMemo(() => {
    if (!pkgSearch.trim()) return packages
    const q = pkgSearch.toLowerCase()
    return packages.filter(p =>
      p.package_name.toLowerCase().includes(q) ||
      (p.governance_owner ?? '').toLowerCase().includes(q) ||
      (p.system_scope ?? '').toLowerCase().includes(q)
    )
  }, [packages, pkgSearch])

  const pkgTotalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE))
  const paginatedPkgs = filteredPackages
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice((pkgPage - 1) * PAGE_SIZE, pkgPage * PAGE_SIZE)

  const pkgSystems = [...new Set(packages.map(p => p.system_scope).filter(Boolean) as string[])].sort()

  function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
    if (totalPages <= 1) return null
    return (
      <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white">
        <p className="text-xs text-gray-400">
          Page <span className="font-medium text-gray-600">{page}</span> of <span className="font-medium text-gray-600">{totalPages}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
            className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1.5">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-gray-300">…</span>}
                <button onClick={() => onPage(p)}
                  className={`text-xs w-8 h-8 rounded-lg font-medium transition-colors ${p === page ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                  {p}
                </button>
              </span>
            ))}
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Role Discovery" subtitle="Browse roles and access packages across your IAM ecosystem" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['roles', 'packages'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}>
            {tab === 'roles'
              ? `Roles${total ? ` (${total})` : ''}`
              : `Access Packages${packages.length ? ` (${packages.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── ROLES TAB ── */}
      {activeTab === 'roles' && (
        <>
          <div className="mb-5 space-y-3">
            <input type="text" placeholder="Search roles, applications, teams..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <select value={appFilter} onChange={e => setAppFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Applications</option>
                {filters.applications.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={envFilter} onChange={e => setEnvFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Environments</option>
                {filters.environments.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={accessTypeFilter} onChange={e => setAccessTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Access Types</option>
                {filters.access_types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => setPrivilegedFilter(privilegedFilter === true ? null : true)}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                  privilegedFilter === true
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                }`}>
                Privileged Only
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Clear all
                </button>
              )}
              <span className="ml-auto text-sm text-gray-400">{total} role{total !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400 text-sm">No roles found matching your filters.</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 block mx-auto">Clear filters</button>
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Role Name', 'Application', 'Environment', 'Access Type', 'Owner Team', 'Users', 'Governance'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map(role => (
                      <tr key={role.id} onClick={() => openModal(role)}
                        className="hover:bg-indigo-50 cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{role.role_name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{role.application}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENV_COLOURS[role.environment] ?? 'bg-gray-100 text-gray-600'}`}>
                            {role.environment}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{role.access_type}</td>
                        <td className="px-4 py-3 text-gray-600">{role.owner_team}</td>
                        <td className="px-4 py-3 text-gray-600">{role.assigned_user_count}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {role.is_privileged && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Privileged</span>}
                            {role.stale_finding_count > 0 && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">{role.stale_finding_count} Findings</span>}
                            {role.requestable && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">Requestable</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── PACKAGES TAB ── */}
      {activeTab === 'packages' && (
        <>
          <div className="mb-5 space-y-3">
            <input type="text" placeholder="Search packages, owners, systems..."
              value={pkgSearch} onChange={e => setPkgSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <select value={pkgRiskFilter} onChange={e => setPkgRiskFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Risk Levels</option>
                {['critical','high','medium','low'].map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              <select value={pkgSystemFilter} onChange={e => setPkgSystemFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Systems</option>
                {pkgSystems.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(pkgSearch || pkgRiskFilter || pkgSystemFilter) && (
                <button onClick={() => { setPkgSearch(''); setPkgRiskFilter(''); setPkgSystemFilter('') }}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Clear all
                </button>
              )}
              <span className="ml-auto text-sm text-gray-400">{filteredPackages.length} package{filteredPackages.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Intelligence summary strip */}
            {!pkgLoading && packages.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'High Risk Score', count: packages.filter(p => (p.risk_score ?? 0) >= 70).length, colour: 'bg-red-50 text-red-700 border-red-200' },
                  { label: 'Stale Review',    count: packages.filter(p => p.is_stale).length,                colour: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                  { label: 'No Owner',        count: packages.filter(p => !p.governance_owner?.trim()).length, colour: 'bg-red-50 text-red-700 border-red-200' },
                  { label: 'Overlapping',     count: packages.filter(p => p.overlap_flag).length,            colour: 'bg-orange-50 text-orange-700 border-orange-200' },
                ].map(stat => (
                  <div key={stat.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${stat.colour}`}>
                    <span className="font-bold">{stat.count}</span>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pkgLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-sm">No packages found matching your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                {paginatedPkgs.map(pkg => (
                  <PackageCard key={pkg.id} pkg={pkg} onRoleClick={async (roleId) => {
                    const role = roles.find(r => r.id === roleId)
                    if (role) { setActiveTab('roles'); openModal(role) }
                    else {
                      const data = await api.getRole(roleId) as RoleDetail
                      setActiveTab('roles'); setSelectedRole(data); setRolePackages([pkg])
                    }
                  }} />
                ))}
              </div>
              {pkgTotalPages > 1 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <PaginationBar page={pkgPage} totalPages={pkgTotalPages} onPage={setPkgPage} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── ROLE DETAIL MODAL ── */}
      {(selectedRole || modalLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedRole(null); setRolePackages([]) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {modalLoading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
            ) : selectedRole && (
              <>
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedRole.role_name}</h2>
                      <p className="text-sm text-gray-500 mt-1">{selectedRole.application}</p>
                    </div>
                    <button onClick={() => { setSelectedRole(null); setRolePackages([]) }}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENV_COLOURS[selectedRole.environment] ?? 'bg-gray-100 text-gray-600'}`}>
                      {selectedRole.environment}
                    </span>
                    {selectedRole.is_privileged && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Privileged</span>}
                    {selectedRole.requestable    && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">Requestable</span>}
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-medium">
                      {selectedRole.source_type === 'synced' ? `Synced from ${selectedRole.source_system}` : selectedRole.source_system}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h3>
                    <p className="text-sm text-gray-700">{selectedRole.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Access Type',     value: selectedRole.access_type },
                      { label: 'Owner Team',       value: selectedRole.owner_team },
                      { label: 'Approval Owner',   value: selectedRole.approval_owner },
                      { label: 'Last Reviewed',    value: selectedRole.last_reviewed_date ?? 'Never' },
                      { label: 'Assigned Users',   value: String(selectedRole.assigned_user_count) },
                      { label: 'Stale Findings',   value: String(selectedRole.stale_finding_count), highlight: selectedRole.stale_finding_count > 0 },
                    ].map(({ label, value, highlight }) => (
                      <div key={label}>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                        <p className={`mt-0.5 ${highlight ? 'text-orange-600 font-medium' : 'text-gray-800'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {rolePackages.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Member of Access Packages</h3>
                      <div className="space-y-2">
                        {rolePackages.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2.5 border border-indigo-100">
                            <div>
                              <p className="text-xs font-semibold text-indigo-900">{p.package_name}</p>
                              <p className="text-[10px] text-indigo-500 mt-0.5">{p.system_scope}</p>
                            </div>
                            <span className={['text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide', RISK_STYLES[p.risk_level] ?? RISK_STYLES.low].join(' ')}>
                              {p.risk_level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedRole.used_by_total > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Used By</h3>
                      <div className="space-y-1.5">
                        {selectedRole.used_by.map(emp => (
                          <div key={emp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800">{emp.name}</span>
                            <span className="text-gray-500 text-xs">{emp.job_title} · {emp.department}</span>
                          </div>
                        ))}
                      </div>
                      {selectedRole.used_by_total > 5 && (
                        <p className="text-xs text-gray-400 mt-1 px-1">+ {selectedRole.used_by_total - 5} more</p>
                      )}
                    </div>
                  )}
                  {selectedRole.related_roles.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Related Roles in {selectedRole.application}
                      </h3>
                      <div className="space-y-1.5">
                        {selectedRole.related_roles.map(r => (
                          <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800">{r.role_name}</span>
                            <div className="flex gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ENV_COLOURS[r.environment] ?? 'bg-gray-100 text-gray-600'}`}>
                                {r.environment}
                              </span>
                              {r.is_privileged && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Privileged</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
