"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { isAuthenticated, getUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { notificationApi } from "@/lib/api"
import NotificationDrawer from "@/components/NotificationDrawer";

const inter = Inter({ subsets: ["latin"] });

function BellIcon({ count }: { count: number }) {
  return (
    <button
      id="notification-bell"
      className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors"
      aria-label="Notifications"
      onClick={() => {
        const event = new CustomEvent("toggle-notifications")
        window.dispatchEvent(event)
      }}
    >
      <svg
        className="w-5 h-5 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const isLoginPage = pathname === "/login"

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationApi.list({ unread_only: true, limit: 1 })
      setUnreadCount(res.unread_count)
    } catch {
      // silently fail — bell just shows 0
    }
  }, [])

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false)
      return
    }
    if (!isAuthenticated()) {
      router.replace("/login")
      return
    }
    const u = getUser()
    setUser(u)
    setChecking(false)
  }, [pathname])

  // Poll unread count every 60 seconds when authenticated
  useEffect(() => {
    if (!user || isLoginPage) return
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60_000)
    return () => clearInterval(interval)
  }, [user, isLoginPage, fetchUnreadCount])

  // Re-fetch count when notifications are dismissed/read
  useEffect(() => {
    const handler = () => fetchUnreadCount()
    window.addEventListener("notifications-updated", handler)
    return () => window.removeEventListener("notifications-updated", handler)
  }, [fetchUnreadCount])

  if (isLoginPage) {
    return (
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    )
  }

  if (checking) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          </div>
        </body>
      </html>
    )
  }

  if (!user) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Authenticating…</p>
            </div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* ── Top bar */}
            <header className="h-12 border-b border-slate-800 bg-slate-900 flex items-center justify-end px-6 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-2">
                  {user.full_name}
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wide">
                    {user.role}
                  </span>
                </span>
                <BellIcon count={unreadCount} />
              </div>
            </header>
            {/* ── Page content */}
            <main className="flex-1 overflow-auto bg-slate-50">
              <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
            </main>
          </div>
        </div>
        <NotificationDrawer />
      </body>
    </html>
  )
}
