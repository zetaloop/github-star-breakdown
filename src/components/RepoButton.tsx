import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Button } from "@/components/ui/button";

export default function RepoButton() {
  return (
    <Button asChild variant="ghost" size="icon">
      <a
        href="https://github.com/zetaloop/github-star-growth-mapper"
        target="_blank"
        rel="noreferrer"
      >
        <GitHubIcon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Open repository</span>
      </a>
    </Button>
  );
}
