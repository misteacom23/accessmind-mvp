/**
 * Auth utilities
 * --------------
 * Simple JWT auth using localStorage.
 * Token is sent as Authorization: Bearer <token> on every API call.
 */

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  last_login: string | null;
}

const TOKEN_KEY = "accessmind_token";
const USER_KEY  = "accessmind_user";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; }
  catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getUser();
}

export function getRoleBadgeColor(role: string): string {
  const map: Record<string, string> = {
    admin:    "bg-purple-100 text-purple-700",
    manager:  "bg-blue-100 text-blue-700",
    analyst:  "bg-green-100 text-green-700",
    auditor:  "bg-slate-100 text-slate-600",
  };
  return map[role] ?? "bg-slate-100 text-slate-600";
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    admin:   "Administrator",
    manager: "Manager",
    analyst: "Analyst",
    auditor: "Auditor",
  };
  return map[role] ?? role;
}

// Permission helpers — mirrors backend role_helpers
export function canApprove(role: string)         { return ["manager", "admin"].includes(role); }
export function canCreateRequests(role: string)  { return ["analyst", "admin"].includes(role); }
export function canCreateExceptions(role: string){ return ["analyst", "admin"].includes(role); }
export function isReadOnly(role: string)         { return role === "auditor"; }
