import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useId } from "react";
import { IconButton } from "./ui";

const themes = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const id = useId();
  const Icon = themes.find((item) => item.value === theme)?.icon || Monitor;
  return (
    <div className="appearance">
      <IconButton label="外观" popoverTarget={id}>
        <Icon />
      </IconButton>
      <div id={id} popover="auto" className="appearance-menu floating-panel">
        <p className="menu-caption">外观</p>
        {themes.map((item) => (
          <button
            type="button"
            key={item.value}
            className="menu-item"
            aria-pressed={theme === item.value}
            popoverTarget={id}
            popoverTargetAction="hide"
            onClick={() => setTheme(item.value)}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
            {theme === item.value && <Check size={15} />}
          </button>
        ))}
      </div>
    </div>
  );
}
