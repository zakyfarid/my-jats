import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import Templates from "@/pages/Templates";
import PrintView from "@/pages/PrintView";
import Login from "@/pages/Login";
import Admins from "@/pages/Admins";
import { AuthProvider, useAuth } from "@/lib/auth";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  React.useEffect(() => {
    const root = document.documentElement;
    const theme = localStorage.getItem("ojats-theme") || "dark";
    if (theme === "light") root.classList.add("light");
    else root.classList.add("dark");
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/print/:id" element={<PrintView />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/admins" element={<ProtectedRoute><Admins /></ProtectedRoute>} />
          </Routes>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "#12151c",
                border: "1px solid #1e293b",
                color: "#f8fafc",
                fontSize: "13px",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
