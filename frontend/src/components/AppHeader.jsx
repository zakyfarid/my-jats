import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, BookOpen, Layout, Moon, Sun, LogOut, Shield, Users } from "lucide-react";
import { useAuth } from "../lib/auth";

const NavLink = ({ to, children, icon: Icon, testId }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm transition-colors ${
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  );
};

export const AppHeader = ({ right, breadcrumb }) => {
  const [theme, setTheme] = React.useState(() => localStorage.getItem("ojats-theme") || "dark");
  const auth = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
    localStorage.setItem("ojats-theme", theme);
  }, [theme]);

  const handleLogout = () => {
    auth.logout();
    navigate("/login");
  };

  return (
    <header
      data-testid="app-header"
      className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card"
    >
      <div className="flex items-center gap-6">
        <Link to="/" data-testid="app-logo" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground font-mono">{"</>"}</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight leading-none">OpenJATS</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none mt-0.5">
              Editor
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" icon={FileText} testId="nav-articles">
            Articles
          </NavLink>
          <NavLink to="/templates" icon={BookOpen} testId="nav-templates">
            Templates
          </NavLink>
          {auth.user?.role === "super_admin" && (
            <NavLink to="/admins" icon={Users} testId="nav-admins">
              Admins
            </NavLink>
          )}
        </nav>
        {breadcrumb && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-4 ml-2">
            {breadcrumb}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {auth.user && (
          <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
            <div className="text-right" data-testid="header-user">
              <div className="text-xs font-medium leading-tight">{auth.user.name || auth.user.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 justify-end">
                {auth.user.role === "super_admin" && <Shield className="h-3 w-3" />}
                {auth.user.role.replace("_", " ")}
              </div>
            </div>
            <button
              data-testid="logout-btn"
              onClick={handleLogout}
              className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          data-testid="theme-toggle"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
