import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogIn, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success("Logged in");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-10 w-10 rounded-sm bg-primary flex items-center justify-center mb-3">
            <span className="text-xs font-bold text-primary-foreground font-mono">{"</>"}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">OpenJATS Editor</h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.2em]">Sign In</p>
        </div>
        <form onSubmit={submit} className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit"
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-4 text-center flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" /> Editorial workspace · authorized users only
        </p>
      </div>
    </div>
  );
}
