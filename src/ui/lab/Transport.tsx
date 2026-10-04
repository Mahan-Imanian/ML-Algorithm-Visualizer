import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Run } from "@/core/experiment";
import { groupIndexAt, nextGroupCursor, prevGroupCursor } from "@/core/trace";
import { cn } from "@/lib/utils";
import { baseRate, position, SPEEDS, totalLength, useLab, type Granularity } from "@/store/lab";
import { usePresented } from "../clock";
import { setupCanvas, useElementSize, usePalette, type Palette } from "../hooks";
import {
  Bookmark,
  FlagNext,
  FlagPrev,
  Minus,
  Pause,
  Play,
  Plus,
  Restart,
  StepBack,
  StepFwd,
  ToEnd,
  ToStart,
} from "../icons";
import { useCommitCounter } from "../perf";
import { Button, IconButton, Segmented } from "../primitives";

type Klass = 0 | 1 | 2 | 3 | 4;

function classify(k: string): Klass {
  switch (k) {
    case "push":
    case "compare":
    case "probe":
    case "consider":
    case "assign":
    case "gradient":
      return 1;
    case "pop":
    case "swap":
    case "write":
    case "update":
      return 2;
    case "found":
    case "sorted":
    case "accept":
    case "converged":
      return 3;
    case "nopath":
    case "absent":
    case "diverged":
      return 4;
    default:
      return 0;
  }
}

function tapeColor(p: Palette, k: Klass): string {
  return [p.ink3, p.open, p.closed, p.path, p.signal][k];
}

function drawTape(
  ctx: CanvasRenderingContext2D,
  run: Run,
  total: number,
  W: number,
  y: number,
  h: number,
  p: Palette,
) {
  const events = run.trace.events as { k: string }[];
  const cols = Math.max(1, Math.floor(W));
  const counts = new Uint16Array(cols * 5);
  for (let i = 0; i < events.length; i++) {
    const c = Math.min(cols - 1, Math.floor((i / Math.max(1, total)) * cols));
    counts[c * 5 + classify(events[i].k)]++;
  }
  for (let c = 0; c < cols; c++) {
    let best: Klass = 0;
    let bn = 0;
    let sum = 0;
    for (let k = 0; k < 5; k++) {
      const n = counts[c * 5 + k];
      sum += n;
      if (n > bn || (n === bn && k > best && n > 0)) {
        bn = n;
        best = k as Klass;
      }
    }
    if (!sum) continue;
    const rare = counts[c * 5 + 3] + counts[c * 5 + 4];
    ctx.fillStyle = tapeColor(p, rare ? (counts[c * 5 + 4] ? 4 : 3) : best);
    ctx.fillRect(c, y, 1, h);
  }
}

function Scrubber({ large }: { large?: boolean }) {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const bookmarks = useLab((s) => s.bookmarks);
  const granularity = useLab((s) => s.granularity);
  const total = useLab((s) => totalLength(s));
  const presented = usePresented();
  const pos = runB ? Math.max(presented.a, presented.b) : presented.a;
  const [box, size] = useElementSize<HTMLDivElement>();
  const tape = useRef<HTMLCanvasElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const palette = usePalette();
  const [hover, setHover] = useState<{ x: number; at: number } | null>(null);
  const dragging = useRef(false);
  const tapeH = runB ? 12 : 6;

  useLayoutEffect(() => {
    const el = tape.current;
    if (!el || size.w < 2) return;
    const ctx = setupCanvas(el, size.w, tapeH);
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, tapeH);
    drawTape(ctx, runA, total, size.w, 0, runB ? 5 : 6, palette);
    if (runB) drawTape(ctx, runB, total, size.w, 7, 5, palette);
  }, [runA, runB, total, size.w, palette, tapeH]);

  useLayoutEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const s = useLab.getState();
      const t = totalLength(s);
      const f = t ? position(s) / t : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${f})`;
      if (thumb.current) thumb.current.style.transform = `translateX(${f * size.w}px)`;
    };
    place();
    return useLab.subscribe((s, p) => {
      if ((s.cursorA !== p.cursorA || s.cursorB !== p.cursorB || s.runA !== p.runA) && !raf)
        raf = requestAnimationFrame(place);
    });
  }, [size.w]);

  const marks = useMemo(
    () =>
      [
        ...runA.trace.checkpoints.map((c) => ({ ...c, kind: "a" as const })),
        ...(runB?.trace.checkpoints.map((c) => ({ ...c, kind: "b" as const })) ?? []),
        ...bookmarks.map((b) => ({ at: b, label: "Bookmark", kind: "bookmark" as const })),
      ].filter((m) => m.at > 0 && m.at <= total),
    [runA, runB, bookmarks, total],
  );

  const atX = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))) * total);
  };

  const seekTo = (v: number) => {
    const s = useLab.getState();
    s.pause();
    s.seek(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const s = useLab.getState();
    const cur = position(s);
    const groups = s.runA.trace.groupEnds;
    let v: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp")
      v = granularity === "op" || e.shiftKey ? cur + 1 : nextGroupCursor(groups, cur, total);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      v = granularity === "op" || e.shiftKey ? cur - 1 : prevGroupCursor(groups, cur);
    else if (e.key === "PageUp") v = cur + Math.ceil(total / 10);
    else if (e.key === "PageDown") v = cur - Math.ceil(total / 10);
    else if (e.key === "Home") v = 0;
    else if (e.key === "End") v = total;
    if (v === null) return;
    e.preventDefault();
    e.stopPropagation();
    seekTo(Math.max(0, Math.min(total, v)));
  };

  const hoverNote = hover
    ? runA.trace.events[Math.max(0, Math.min(runA.trace.events.length - 1, hover.at - 1))]?.note
    : null;

  return (
    <div className={cn("relative w-full select-none", large ? "pt-4" : "pt-3")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3">
        {marks.map((m, i) => (
          <span
            key={`${m.kind}${m.at}${i}`}
            className={cn(
              "absolute top-0 w-px",
              m.kind === "bookmark" ? "h-3 bg-focus" : "h-2.5",
              m.kind === "a" && "bg-signal",
              m.kind === "b" && "bg-st-b",
            )}
            style={{ left: `${(m.at / Math.max(1, total)) * 100}%` }}
          />
        ))}
      </div>
      <div
        ref={box}
        className="relative h-7 w-full cursor-pointer touch-none"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          dragging.current = true;
          seekTo(atX(e.clientX));
          thumb.current?.focus({ preventScroll: true });
        }}
        onPointerMove={(e) => {
          const at = atX(e.clientX);
          if (dragging.current) seekTo(at);
          if (e.pointerType === "mouse") {
            const r = box.current!.getBoundingClientRect();
            setHover({ x: e.clientX - r.left, at });
          }
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onPointerLeave={() => setHover(null)}
      >
        <canvas
          ref={tape}
          className="pointer-events-none absolute inset-x-0 top-1 w-full"
          style={{ height: tapeH }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-2 h-[3px] bg-rule-strong">
          <div
            ref={fill}
            className="h-full w-full origin-left bg-ink"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
        <div
          ref={thumb}
          role="slider"
          tabIndex={0}
          aria-label="Timeline position"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={pos}
          aria-valuetext={`Operation ${pos} of ${total}`}
          onKeyDown={onKey}
          className="absolute -left-2 bottom-0 h-6 w-4 rounded-sm border-2 border-ink bg-surface outline-none will-change-transform before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-focus"
        />
        {hover && hoverNote && (
          <div
            className="pointer-events-none absolute bottom-full z-20 mb-4 max-w-[320px] -translate-x-1/2 truncate whitespace-nowrap border border-rule-strong bg-surface px-2 py-1 text-xs shadow-pop"
            style={{ left: Math.max(80, Math.min(size.w - 80, hover.x)) }}
            aria-hidden="true"
          >
            <span className="readout mr-2 text-ink-3">op {hover.at}</span>
            {hoverNote}
          </div>
        )}
      </div>
    </div>
  );
}

export function Transport({ compact, present }: { compact?: boolean; present?: boolean }) {
  useCommitCounter("transport");
  const playing = useLab((s) => s.playing);
  const toggle = useLab((s) => s.toggle);
  const step = useLab((s) => s.step);
  const toStart = useLab((s) => s.toStart);
  const toEnd = useLab((s) => s.toEnd);
  const checkpoint = useLab((s) => s.checkpoint);
  const restart = useLab((s) => s.restart);
  const speed = useLab((s) => s.speed);
  const setSpeed = useLab((s) => s.setSpeed);
  const granularity = useLab((s) => s.granularity);
  const setGranularity = useLab((s) => s.setGranularity);
  const toggleBookmark = useLab((s) => s.toggleBookmark);
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const total = useLab((s) => totalLength(s));
  const rate = useLab((s) => baseRate(s) * SPEEDS[s.speed]);
  const presented = usePresented();
  const pos = runB ? Math.max(presented.a, presented.b) : presented.a;
  const atEnd = useLab((s) => position(s) >= totalLength(s));
  const atStart = useLab((s) => position(s) === 0);
  const groups = runA.trace.groupEnds.length;
  const g = groupIndexAt(runA.trace.groupEnds, presented.a);
  const big = compact || present;

  const digits = String(Math.max(total, groups)).length;
  const counterLine = compact ? (
    <p className="readout shrink-0 whitespace-nowrap text-xs text-ink-2">
      <span className="inline-block text-right text-ink" style={{ minWidth: `${digits}ch` }}>
        {granularity === "step" ? g : pos}
      </span>
      /{granularity === "step" ? `${groups} steps` : `${total} ops`}
    </p>
  ) : (
    <p className="readout shrink-0 whitespace-nowrap text-xs text-ink-2">
      <span className="inline-block text-right text-ink" style={{ minWidth: `${digits}ch` }}>
        {g}
      </span>
      /{groups} steps
      <span className="px-2 text-ink-3">·</span>
      op{" "}
      <span className="inline-block text-right" style={{ minWidth: `${String(total).length}ch` }}>
        {pos}
      </span>
      /{total}
      <span className="px-2 text-ink-3">·</span>
      <span className="inline-block w-[11ch] text-ink-3">
        {rate < 10 ? rate.toFixed(1) : Math.round(rate)} {granularity === "step" ? "steps" : "ops"}
        /s
      </span>
    </p>
  );

  const speedCtl = (
    <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
      <IconButton
        label="Slower"
        keys="−"
        onClick={() => setSpeed(speed - 1)}
        disabled={speed === 0}
      >
        <Minus />
      </IconButton>
      <span className="readout w-10 text-center text-xs">{SPEEDS[speed]}×</span>
      <IconButton
        label="Faster"
        keys="="
        onClick={() => setSpeed(speed + 1)}
        disabled={speed === SPEEDS.length - 1}
      >
        <Plus />
      </IconButton>
    </div>
  );

  const size = big ? "icon-lg" : "icon";
  const buttons = (
    <div className="flex shrink-0 items-center gap-0.5">
      {!compact && (
        <IconButton label="Jump to start" keys="Home" onClick={toStart} disabled={atStart}>
          <ToStart />
        </IconButton>
      )}
      <IconButton
        label="Previous milestone"
        keys="["
        onClick={() => checkpoint(-1)}
        disabled={atStart}
        size={size}
      >
        <FlagPrev />
      </IconButton>
      <IconButton
        label={granularity === "step" ? "Step back" : "Back one operation"}
        keys="←"
        onClick={() => step(-1)}
        disabled={atStart}
        size={size}
      >
        <StepBack />
      </IconButton>
      <Button
        variant="signal"
        size={big ? "lg" : "md"}
        onClick={() => (atEnd && !playing ? restart() : toggle())}
        className={cn("mx-1 w-[104px]")}
        data-tour="play"
      >
        {playing ? <Pause /> : atEnd ? <Restart /> : <Play />}
        {playing ? "Pause" : atEnd ? "Replay" : atStart ? "Run" : "Resume"}
      </Button>
      <IconButton
        label={granularity === "step" ? "Step forward" : "Forward one operation"}
        keys="→"
        onClick={() => step(1)}
        disabled={atEnd}
        size={size}
      >
        <StepFwd />
      </IconButton>
      <IconButton
        label="Next milestone"
        keys="]"
        onClick={() => checkpoint(1)}
        disabled={atEnd}
        size={size}
      >
        <FlagNext />
      </IconButton>
      {!compact && (
        <IconButton label="Jump to end" keys="End" onClick={toEnd} disabled={atEnd}>
          <ToEnd />
        </IconButton>
      )}
      {!compact && (
        <IconButton label="Bookmark this step" keys="B" onClick={toggleBookmark}>
          <Bookmark />
        </IconButton>
      )}
    </div>
  );

  const gran = (
    <Segmented<Granularity>
      label="Step size"
      size="sm"
      value={granularity}
      onChange={setGranularity}
      options={[
        {
          value: "step",
          label: "Step",
          title: "One logical step: an expansion, a pass, an iteration",
        },
        { value: "op", label: "Op", title: "One operation: a single push, compare or swap" },
      ]}
    />
  );

  if (compact) {
    return (
      <div
        className="h-[148px] border-t border-rule bg-surface px-3 pt-1 [contain:strict]"
        data-tour="timeline"
      >
        <Scrubber />
        <div className="mt-1 flex items-center justify-between gap-2">{buttons}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {gran}
          {counterLine}
          {speedCtl}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t border-rule bg-surface px-3 [contain:layout_paint]",
        present ? "h-[104px] pb-2 pt-1" : "h-[88px] pb-1.5 pt-1",
      )}
      data-tour="timeline"
    >
      <div className="flex items-center gap-3">
        {buttons}
        <div className="min-w-0 flex-1">
          <Scrubber large={present} />
        </div>
      </div>
      <div className="flex items-center gap-4 pl-1">
        {counterLine}
        <div className="ml-auto flex items-center gap-3">
          {gran}
          {speedCtl}
        </div>
      </div>
    </div>
  );
}
