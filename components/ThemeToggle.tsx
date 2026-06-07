"use client";

import { useEffect, useState } from "react";

// Day/Night theme switch (design.md). Night is the default; the choice persists.
// app/layout.tsx applies the saved theme before paint to avoid a flash.
type Theme = "night" | "day";

function apply(t: Theme) {
  document.documentElement.dataset.theme = t === "day" ? "day" : "";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const saved = (localStorage.getItem("verdict-theme") as Theme) || "night";
    setTheme(saved);
    apply(saved);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "night" ? "day" : "night";
    setTheme(next);
    apply(next);
    localStorage.setItem("verdict-theme", next);
  };

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle day or night theme">
      {theme === "night" ? "☀  Day" : "☾  Night"}
    </button>
  );
}
