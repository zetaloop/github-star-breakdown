import { type DateRange, DayPicker } from "@daypicker/react";
import { zhCN } from "@daypicker/react/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import { dateKey, rangeLabel } from "@/services/history";
import type { TimeRange } from "@/types/github";
import { Segmented } from "./ui";
import "@daypicker/react/style.css";

export default function DateRangePicker({
  value,
  onChange,
  disabled,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>();
  const [month, setMonth] = useState(() => new Date());
  return (
    <div className="date-range">
      <Segmented<"year" | "all">
        label="时间范围"
        options={[
          { value: "year", label: "最近一年" },
          { value: "all", label: "全部历史" },
        ]}
        value={value.type === "custom" ? undefined : value.type}
        disabled={disabled}
        onChange={(type) => onChange({ type })}
      />
      <button
        type="button"
        className="date-trigger"
        data-selected={value.type === "custom"}
        popoverTarget={id}
        disabled={disabled}
      >
        <CalendarDays size={16} />
        <span>
          {value.type === "custom" ? rangeLabel(value) : "自定义日期"}
        </span>
        <ChevronDown size={14} />
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        className="date-panel floating-panel"
        role="dialog"
        aria-label="选择日期范围"
        onToggle={(event) => {
          const opening = event.newState === "open";
          setOpen(opening);
          if (opening) {
            setDraft(
              value.type === "custom"
                ? { from: value.from, to: value.to }
                : undefined,
            );
            setMonth(value.type === "custom" ? value.from : new Date());
          }
        }}
      >
        <DayPicker
          mode="range"
          locale={zhCN}
          selected={draft}
          onSelect={setDraft}
          month={month}
          onMonthChange={setMonth}
          numberOfMonths={2}
          captionLayout="dropdown"
          navLayout="around"
          endMonth={new Date()}
          disabled={{ after: new Date() }}
          resetOnSelect
          autoFocus={open}
          animate
        />
        <div className="date-panel-footer">
          <span>
            {draft?.from
              ? `${dateKey(draft.from)}${draft.to ? ` — ${dateKey(draft.to)}` : " — 结束日期"}`
              : "开始日期 — 结束日期"}
          </span>
          <button
            type="button"
            className="primary-button"
            disabled={!draft?.from || !draft.to}
            onClick={() => {
              if (!draft?.from || !draft.to) return;
              onChange({ type: "custom", from: draft.from, to: draft.to });
              panel.current?.hidePopover();
            }}
          >
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
