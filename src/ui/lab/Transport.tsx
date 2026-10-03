import { useMemo, useRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { groupIndexAt } from "@/core/trace";
import { cn } from "@/lib/utils";
import {
  baseRate,
  lengthOf,
  position,
  SPEEDS,
  totalLength,
  useLab,
  type Granularity,
} from "@/store/lab";
import {
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
import { Button, IconButton, Segmented } from "../primitives";

function Minimap({
  series,
  length,
  groupEnds,
}: {
  series: number[];
  length: number;
  groupEnds: number[];
}) {
  const path = useMemo(() => {
    if (series.length < 2 || !length) return "";
    const max = Math.max(...series.map((v) => (Number.isFinite(v) ? v : 0)), 1e-9);
    const min = Math.min(0, ...series);
    const step = Math.max(1, Math.floor(series.length / 300));
    let d = "";
    for (let i = 0; i < series.length; i += step) {
      const x = ((groupEnds[i] ?? length) / length) * 100;
      const v = Number.isFinite(series[i]) ? series[i] : max;
      const y = 100 - ((v - min) / (max - min || 1)) * 100;
      d += `${d ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    }
    return `${d}L100,100L0,100Z`;
  }, [series, length, groupEnds]);
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-[9px] h-4 w-full"
      aria-hidden="true"
    >
      <path d={path} fill="rgb(var(--ink) / 0.1)" />
    </svg>
  );
}

function Scrubber() {
  const runA = useLab((s) => s.runA);
  const runB = useLab((s) => s.runB);
  const pos = useLab((s) => position(s));
  const total = useLab((s) => totalLength(s));
  const cursorB = useLab((s) => s.cursorB);
  const seek = useLab((s) => s.seek);
  const pause = useLab((s) => s.pause);
  const marks = [
    ...runA.trace.checkpoints.map((c) => ({ ...c, which: "a" as const })),
    ...(runB?.trace.checkpoints.map((c) => ({ ...c, which: "b" as const })) ?? []),
  ].filter((m) => m.at > 0 && m.at <= total);
  const lenA = lengthOf(runA);
  const lenB = lengthOf(runB);
  return (
    <div className="relative w-full pt-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3">
        {marks.map((m, i) => (
          <span
            key={`${m.which}${m.at}${i}`}
            className={cn("absolute top-0 h-3 w-px", m.which === "a" ? "bg-signal" : "bg-st-b")}
            style={{ left: `${(m.at / Math.max(1, total)) * 100}%` }}
            title={m.label}
          />
        ))}
      </div>
      <div className="relative">
        <Minimap
          series={runA.trace.series}
          length={Math.max(1, total)}
          groupEnds={runA.trace.groupEnds}
        />
        <SliderPrimitive.Root
          value={[pos]}
          min={0}
          max={Math.max(1, total)}
          step={1}
          onValueChange={([v]) => {
            pause();
            seek(v);
          }}
          className="relative flex h-8 w-full touch-none select-none items-center"
        >
          <SliderPrimitive.Track className="relative h-[3px] grow bg-rule-strong">
            <SliderPrimitive.Range className="absolute h-full bg-ink" />
            {runB && (
              <>
                <span
                  className="absolute -bottom-[5px] left-0 h-[2px] bg-st-a"
                  style={{ width: `${(Math.min(pos, lenA) / Math.max(1, total)) * 100}%` }}
                />
                <span
                  className="absolute -bottom-[9px] left-0 h-[2px] bg-st-b"
                  style={{ width: `${(cursorB / Math.max(1, total)) * 100}%` }}
                />
                <span
                  className="absolute -bottom-[5px] h-[2px] w-px bg-st-a"
                  style={{ left: `${(lenA / Math.max(1, total)) * 100}%` }}
                />
                <span
                  className="absolute -bottom-[9px] h-[2px] w-px bg-st-b"
                  style={{ left: `${(lenB / Math.max(1, total)) * 100}%` }}
                />
              </>
            )}
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label="Timeline position"
            aria-valuetext={`Operation ${pos} of ${total}`}
            className="relative block h-6 w-4 rounded-sm border-2 border-ink bg-surface shadow-sm transition-transform duration-fast before:absolute before:-inset-2 before:content-[''] hover:scale-110"
          />
        </SliderPrimitive.Root>
      </div>
    </div>
  );
}

export function Transport({ compact }: { compact?: boolean }) {
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
  const runA = useLab((s) => s.runA);
  const cursorA = useLab((s) => s.cursorA);
  const pos = useLab((s) => position(s));
  const total = useLab((s) => totalLength(s));
  const rate = useLab((s) => baseRate(s) * SPEEDS[s.speed]);
  const atEnd = pos >= total;
  const groups = runA.trace.groupEnds.length;
  const g = groupIndexAt(runA.trace.groupEnds, cursorA);
  const playRef = useRef<HTMLButtonElement>(null);

  const counter = (
    <div className="readout shrink-0 text-right text-xs leading-4 text-ink-2" aria-live="off">
      <div>
        <span className="text-ink">{g}</span>/{groups} steps
      </div>
      <div className="text-ink-3">
        {pos}/{total} ops
      </div>
    </div>
  );

  const counterLine = (
    <p className="readout text-xs text-ink-2">
      Step <span className="text-ink">{g}</span> of {groups}
      <span className="px-2 text-ink-3">·</span>op {pos} of {total}
      <span className="px-2 text-ink-3">·</span>
      <span className="text-ink-3">
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
        size="icon"
        onClick={() => setSpeed(speed - 1)}
        disabled={speed === 0}
      >
        <Minus />
      </IconButton>
      <span
        className="readout w-14 text-center text-xs"
        title={`${rate.toFixed(1)} ${granularity === "step" ? "steps" : "ops"} per second`}
      >
        {SPEEDS[speed]}×
      </span>
      <IconButton
        label="Faster"
        keys="="
        size="icon"
        onClick={() => setSpeed(speed + 1)}
        disabled={speed === SPEEDS.length - 1}
      >
        <Plus />
      </IconButton>
    </div>
  );

  const buttons = (
    <div className="flex items-center gap-0.5">
      {!compact && (
        <IconButton label="Jump to start" keys="Home" onClick={toStart} disabled={pos === 0}>
          <ToStart />
        </IconButton>
      )}
      <IconButton
        label="Previous checkpoint"
        keys="["
        onClick={() => checkpoint(-1)}
        disabled={pos === 0}
        size={compact ? "icon-lg" : "icon"}
      >
        <FlagPrev />
      </IconButton>
      <IconButton
        label={granularity === "step" ? "Step back" : "Back one operation"}
        keys="←"
        onClick={() => step(-1)}
        disabled={pos === 0}
        size={compact ? "icon-lg" : "icon"}
      >
        <StepBack />
      </IconButton>
      <Button
        ref={playRef}
        variant="signal"
        size={compact ? "lg" : "md"}
        onClick={() => (atEnd && !playing ? restart() : toggle())}
        className={cn("mx-1 min-w-[92px]", compact && "min-w-[104px]")}
        aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}
        data-tour="play"
      >
        {playing ? <Pause /> : atEnd ? <Restart /> : <Play />}
        {playing ? "Pause" : atEnd ? "Replay" : pos === 0 ? "Run" : "Resume"}
      </Button>
      <IconButton
        label={granularity === "step" ? "Step forward" : "Forward one operation"}
        keys="→"
        onClick={() => step(1)}
        disabled={atEnd}
        size={compact ? "icon-lg" : "icon"}
      >
        <StepFwd />
      </IconButton>
      <IconButton
        label="Next checkpoint"
        keys="]"
        onClick={() => checkpoint(1)}
        disabled={atEnd}
        size={compact ? "icon-lg" : "icon"}
      >
        <FlagNext />
      </IconButton>
      {!compact && (
        <IconButton label="Jump to end" keys="End" onClick={toEnd} disabled={atEnd}>
          <ToEnd />
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
        className="border-t border-rule bg-surface px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-1"
        data-tour="timeline"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Scrubber />
          </div>
          {counter}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">{buttons}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {gran}
          {speedCtl}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-rule bg-surface px-3 pb-1.5 pt-1" data-tour="timeline">
      <div className="flex items-center gap-3">
        {buttons}
        <div className="min-w-0 flex-1">
          <Scrubber />
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
