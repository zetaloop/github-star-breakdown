import { ThemeProvider } from "next-themes";
import GitHubStarTracker from "./components/GitHubStarTracker";
import { GitHubIcon } from "./components/icons/GitHubIcon";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <header className="app-header">
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
    </ThemeProvider>
  );
}
