import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import Templates from "@/pages/Templates";

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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:id" element={<Editor />} />
          <Route path="/templates" element={<Templates />} />
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
      </BrowserRouter>
    </div>
  );
}

export default App;
