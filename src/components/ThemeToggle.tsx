import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun
            className={cn(
              "h-[1.2rem] w-[1.2rem] transition-all",
              theme === "light" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
            )}
          />
          <Moon
            className={cn(
              "absolute h-[1.2rem] w-[1.2rem] transition-all",
              theme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"
            )}
          />
          <Laptop
            className={cn(
              "absolute h-[1.2rem] w-[1.2rem] transition-all",
              theme === "system" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
            )}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
