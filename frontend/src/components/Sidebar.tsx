'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  AlertTriangle,
  ScrollText,
  ArrowLeftRight,
  UserPlus,
  BookOpen,
  Cable, ShieldAlert, GitPullRequest, Flag,
  LogOut,
} from 'lucide-react'
import { clearAuth, getUser, getRoleLabel, getRoleBadgeColor } from '@/lib/auth'

const navItems = [
  { href: '/',               label: 'Overview',           icon: LayoutDashboard },
  { href: '/findings',       label: 'Findings',           icon: AlertTriangle },
  { href: '/audit',          label: 'Audit Log',          icon: ScrollText },
  { href: '/movers',         label: 'Mover Detection',    icon: ArrowLeftRight },
  { href: '/new-starter',    label: 'New Starter',        icon: UserPlus },
  { href: '/role-discovery', label: 'Role Discovery',     icon: BookOpen },
  { href: '/hygiene',        label: 'Governance Hygiene', icon: ShieldAlert },
  { href: '/workflows',      label: 'Workflows',          icon: GitPullRequest },
  { href: '/campaigns',      label: 'Campaigns',          icon: Flag },
  { href: '/connectors',     label: 'Connectors',         icon: Cable },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = getUser()

  const handleSignOut = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-indigo-400 font-bold text-lg tracking-tight">AccessMind</span>
        <span className="text-xs text-gray-500 block mt-0.5">Governance Platform</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-900/50 text-indigo-300 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-gray-500'} />
              {label}
            </Link>
          )
        })}
      </nav>
      {user && (
        <div className="border-t border-gray-800 p-4">
          <div className="mb-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
              {getRoleLabel(user.role)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-200 truncate">{user.full_name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          {user.last_login && (
            <p className="text-xs text-gray-600 mt-1">
              Last login: {new Date(user.last_login).toLocaleDateString()}
            </p>
          )}
          <button
            onClick={handleSignOut}
            className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  )
}
