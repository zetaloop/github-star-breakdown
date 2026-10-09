import { memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Transition, TransitionGroup } from "react-transition-group";
import type { TransitionProps } from "react-transition-group/Transition";
import type { ChartPoint, ChartSeries } from "@/lib/chart";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat();

interface Entry {
  id: number;
  name: string;
  color: string;
  value: number;
}

type Animate = (node: Element, done?: () => void) => void;

const TooltipRow = memo(function TooltipRow({
  name,
  color,
  value,
  rank,
  animate,
}: Omit<Entry, "id"> & { rank: number; animate: Animate }) {
  const ref = useRef<HTMLDivElement>(null);
  const previousRank = useRef(rank);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || previousRank.current === rank) return;
    node.classList.toggle("tooltip-up", previousRank.current > rank);
    node.classList.toggle("tooltip-down", previousRank.current < rank);
    previousRank.current = rank;
    animate(node);
  }, [rank, animate]);
  return (
    <div
      ref={ref}
      className="tooltip-row"
      onAnimationEnd={(event) =>
        event.currentTarget.classList.remove("tooltip-up", "tooltip-down")
      }
    >
      <span className="color-dot" style={{ background: color }} />
      <span className="tooltip-name">{name}</span>
      <span>{numberFormat.format(value)}</span>
    </div>
  );
});

function TooltipItem({
  entry,
  rank,
  animate,
  ...transition
}: {
  entry: Entry;
  rank: number;
  animate: Animate;
} & Pick<
  TransitionProps<HTMLLIElement>,
  "in" | "appear" | "enter" | "exit" | "onExited"
>) {
  const ref = useRef<HTMLLIElement>(null);
  return (
    <Transition
      {...transition}
      nodeRef={ref}
      addEndListener={(done) => {
        if (ref.current) animate(ref.current, done);
        else done();
      }}
    >
      {(state) => (
        <li ref={ref} data-state={state}>
          <TooltipRow
            name={entry.name}
            color={entry.color}
            value={entry.value}
            rank={rank}
            animate={animate}
          />
        </li>
      )}
    </Transition>
  );
}

export default memo(function StarTooltip({
  point,
  series,
  onWidthChange,
}: {
  point: ChartPoint;
  series: ChartSeries[];
  onWidthChange: (width: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef({
    scheduled: false,
    moves: new Set<Element>(),
    transitions: new Map<Element, () => void>(),
  });
  const animate = useCallback<Animate>((node, done) => {
    const batch = pending.current;
    if (done) batch.transitions.set(node, done);
    else batch.moves.add(node);
    if (batch.scheduled) return;
    batch.scheduled = true;
    queueMicrotask(() => {
      batch.scheduled = false;
      const transitions = new Map<Element, Animation[]>();
      for (const animation of ref.current?.getAnimations({ subtree: true }) ||
        []) {
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect) || !effect.target) continue;
        if (batch.moves.has(effect.target)) {
          animation.currentTime = 0;
          animation.play();
        }
        if (batch.transitions.has(effect.target)) {
          const running = transitions.get(effect.target);
          if (running) running.push(animation);
          else transitions.set(effect.target, [animation]);
        }
      }
      batch.moves.clear();
      for (const [target, finish] of batch.transitions) {
        void Promise.allSettled(
          (transitions.get(target) || []).map(
            (animation) => animation.finished,
          ),
        ).then(finish);
      }
      batch.transitions.clear();
    });
  }, []);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    onWidthChange(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      onWidthChange(entry.borderBoxSize[0].inlineSize);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onWidthChange]);
  const entries = useMemo(
    () =>
      series
        .toReversed()
        .map((entry) => ({
          id: entry.repoId,
          name: entry.name,
          color: entry.color,
          value: point[entry.key],
        }))
        .filter((entry) => entry.value > 0)
        .toSorted((a, b) => b.value - a.value),
    [point, series],
  );
  return (
    <div ref={ref} className="chart-tooltip">
      <header>
        <time>{dateFormat.format(point.date)}</time>
        <strong>
          {numberFormat.format(
            entries.reduce((sum, entry) => sum + entry.value, 0),
          )}
        </strong>
      </header>
      <TransitionGroup component="ul" className="tooltip-list">
        {entries.map((entry, rank) => (
          <TooltipItem
            key={entry.id}
            entry={entry}
            rank={rank}
            animate={animate}
          />
        ))}
      </TransitionGroup>
    </div>
  );
});
