import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Plus, Trash2, Users, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Admins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAdmins();
      setAdmins(data);
    } catch (e) {
      toast.error("Failed to load admins");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/" replace />;

  const create = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password required");
    setCreating(true);
    try {
      await api.createAdmin({ email, password, name });
      toast.success("Admin created");
      setEmail(""); setPassword(""); setName("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Create failed");
    }
    setCreating(false);
  };

  const remove = async (id, email) => {
    if (!window.confirm(`Delete admin ${email}?`)) return;
    try {
      await api.deleteAdmin(id);
      toast.success("Admin deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Access Control</div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2" data-testid="admins-title">
                <Users className="h-5 w-5" /> Manage Admins
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Create and remove admin accounts. Only super admins see this page.</p>
            </div>
          </div>

          <form onSubmit={create} className="bg-card border border-border rounded-sm p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="admin-create-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              data-testid="admin-name"
              className="bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              data-testid="admin-email"
              className="bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (≥6 chars)"
              required
              data-testid="admin-password"
              className="bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary"
            />
            <button type="submit" disabled={creating} data-testid="admin-submit" className="flex items-center justify-center gap-1 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/90 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create Admin"}
            </button>
          </form>

          <div className="border border-border rounded-sm bg-card overflow-hidden" data-testid="admins-list">
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border bg-secondary/30">
              <div className="col-span-3">Name</div>
              <div className="col-span-4">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : admins.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No admins yet.</div>
            ) : (
              admins.map((a) => (
                <div key={a.id} data-testid={`admin-row-${a.id}`} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm border-b border-border last:border-0 items-center">
                  <div className="col-span-3 truncate">{a.name || "—"}</div>
                  <div className="col-span-4 truncate font-mono text-xs">{a.email}</div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-sm ${a.role === 'super_admin' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                      {a.role === 'super_admin' && <Shield className="h-3 w-3" />}
                      {a.role.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                  </div>
                  <div className="col-span-1 text-right">
                    {a.role !== 'super_admin' && a.id !== user.id && (
                      <button onClick={() => remove(a.id, a.email)} data-testid={`admin-delete-${a.id}`} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
