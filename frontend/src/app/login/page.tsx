"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

const DEMO_ACCOUNTS = [
  { email: "analyst@accessmind.local",  password: "Password123!", name: "Sarah Chen",     role: "Analyst",  color: "bg-green-50 border-green-200 text-green-700" },
  { email: "manager@accessmind.local",  password: "Password123!", name: "Rachel Simmons", role: "Manager",  color: "bg-blue-50 border-blue-200 text-blue-700"   },
  { email: "auditor@accessmind.local",  password: "Password123!", name: "Michael Tran",   role: "Auditor",  color: "bg-slate-50 border-slate-200 text-slate-600" },
  { email: "admin@accessmind.local",    password: "Password123!", name: "Olivia Lewis",   role: "Admin",    color: "bg-purple-50 border-purple-200 text-purple-700" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      saveAuth(res.access_token, res.user);
      router.push("/");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(demoEmail, demoPassword);
      saveAuth(res.access_token, res.user);
      router.push("/");
    } catch {
      setError("Quick login failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">AccessMind</h1>
          <p className="text-sm text-slate-500 mt-1">Identity & Access Governance</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@accessmind.local"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" />Signing in…</> : "Sign In"}
            </button>
          </form>
        </div>

        {/* Quick login */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Demo Accounts — Quick Login
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => quickLogin(account.email, account.password)}
                disabled={loading}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all hover:shadow-sm disabled:opacity-50 ${account.color}`}
              >
                <span className="text-xs font-semibold">{account.name}</span>
                <span className="text-xs opacity-70 mt-0.5">{account.role}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            All demo accounts, click to login
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          AccessMind v3.0 · Phase 3
        </p>
      </div>
    </div>
  );
}
