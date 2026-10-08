import { ChartNoAxesCombined } from "lucide-react";
import { ThemeProvider } from "next-themes";
import GitHubStarTracker from "./components/GitHubStarTracker";
import { GitHubIcon } from "./components/icons/GitHubIcon";
import ThemeToggle from "./components/ThemeToggle";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Toaster />
      <header className="app-header">
        <a className="brand" href="/" aria-label="星标增长首页">
          <span className="brand-mark">
            <ChartNoAxesCombined size={21} />
          </span>
          <span>Star Growth</span>
        </a>
        <nav className="header-actions" aria-label="应用选项">
          <ThemeToggle />
          <a
            className="icon-button"
            href="https://github.com/zetaloop/github-star-growth-mapper"
            target="_blank"
            rel="noreferrer"
            aria-label="项目源码"
            title="项目源码"
          >
            <GitHubIcon />
          </a>
        </nav>
      </header>
      <main className="app-main">
        <GitHubStarTracker />
      </main>
      <footer className="app-footer">
        <span>数据来自 GitHub，按当前有效星标统计。</span>
        <a
          href="https://docs.github.com/en/rest/activity/starring#get-repository-star-history"
          target="_blank"
          rel="noreferrer"
        >
          数据说明 ↗
        </a>
      </footer>
    </ThemeProvider>
  );
}
