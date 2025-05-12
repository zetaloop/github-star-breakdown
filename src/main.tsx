import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function applySystemTheme() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
}
applySystemTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applySystemTheme);

createRoot(document.getElementById("root")!).render(<App />);
