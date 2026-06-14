import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FileText, BookOpen, Layout, Moon, Sun } from "lucide-react";

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
        </nav>
        {breadcrumb && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-4 ml-2">
            {breadcrumb}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {right}
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
