"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { notificationApi } from "@/lib/api"
import type { GovernanceNotification } from "@/types"

const SEVERITY_STYLES = {
  critical: "border-l-red-500 bg-red-500/5",
  warning:  "border-l-amber-500 bg-amber-500/5",
  info:     "border-l-blue-500 bg-blue-500/5",
}

const SEVERITY_DOT = {
  critical: "bg-red-500",
  warning:  "bg-amber-500",
  info:     "bg-blue-500",
}

const TYPE_LABELS: Record<string, string> = {
  sla_breach:       "SLA Breach",
  escalation:       "Escalation",
  workflow_created: "Workflow",
  package_issue:    "Package Issue",
  campaign_overdue: "Campaign",
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

export default function NotificationDrawer() {
  const router = useRouter()
  const [open, setOpen]                   = useState(false)
  const [notifications, setNotifications] = useState<GovernanceNotification[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list({ limit: 20 })
      setNotifications(res.notifications)
      setUnreadCount(res.unread_count)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // Listen for bell clicks
  useEffect(() => {
    const handler = () => {
      setOpen(prev => {
        if (!prev) load()
        return !prev
      })
    }
    window.addEventListener("toggle-notifications", handler)
    return () => window.removeEventListener("toggle-notifications", handler)
  }, [load])

  // Seed demo notifications on first open if empty
  useEffect(() => {
    if (open && notifications.length === 0 && !loading) {
      notificationApi.seedDemo().then(() => load()).catch(() => {})
    }
  }, [open])

  const handleMarkRead = async (n: GovernanceNotification) => {
    if (!n.is_read) {
      await notificationApi.markRead(n.id).catch(() => {})
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      window.dispatchEvent(new CustomEvent("notifications-updated"))
    }
    if (n.related_workflow_id) {
      setOpen(false)
      router.push("/workflows")
    } else if (n.related_campaign_id) {
      setOpen(false)
      router.push("/campaigns")
    }
  }

  const handleDismissAll = async () => {
    await notificationApi.dismissAll().catch(() => {})
    setNotifications([])
    setUnreadCount(0)
    window.dispatchEvent(new CustomEvent("notifications-updated"))
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed top-12 right-0 z-50 w-96 h-[calc(100vh-48px)] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Dismiss all
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No notifications</p>
              <p className="text-xs text-slate-600 mt-1">Governance alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={[
                    "w-full text-left px-5 py-4 border-l-2 transition-colors",
                    "hover:bg-slate-800/50",
                    SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info,
                    !n.is_read ? "opacity-100" : "opacity-60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={[
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          SEVERITY_DOT[n.severity] ?? SEVERITY_DOT.info,
                        ].join(" ")} />
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          {TYPE_LABELS[n.notification_type] ?? n.notification_type}
                        </span>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-auto shrink-0" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-white leading-snug mb-1">
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">
                    {timeAgo(n.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 shrink-0">
          <p className="text-[10px] text-slate-600 text-center">
            Governance alerts only — no external notifications sent
          </p>
        </div>
      </div>
    </>
  )
}
