import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from "lucide-react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function Timeline() {
  const { trace, cursor, playing, speed, togglePlay, stepBack, stepForward, reset, setCursor, setSpeed } =
    useAlgoscope();
  const len = trace?.events.length ?? 0;
  const last = Math.max(0, len - 1);

  return (
    <footer className="grid grid-cols-[auto_minmax(0,1fr)_160px] items-center gap-3 rounded-xl border border-border bg-surface-1 px-3.5 max-[720px]:grid-cols-[auto_1fr]">
      <div className="flex gap-1.5">
        <Button variant="outline" size="icon" onClick={stepBack} disabled={!trace} aria-label="Step back">
          <ChevronLeft size={16} />
        </Button>
        <Button variant="primary" size="tall" onClick={togglePlay} aria-label={playing ? "Pause" : "Run"}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? "Pause" : "Run"}
        </Button>
        <Button variant="outline" size="icon" onClick={stepForward} disabled={!trace} aria-label="Step forward">
          <ChevronRight size={16} />
        </Button>
        <Button variant="outline" size="icon" onClick={reset} disabled={!trace} aria-label="Reset to start" title="Reset">
          <RotateCcw size={15} />
        </Button>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>
            Step {trace ? cursor : 0} / {last}
          </span>
          <span>{trace ? `${len} events` : "No trace"}</span>
        </div>
        <Slider
          value={[cursor]}
          min={0}
          max={last}
          step={1}
          onValueChange={([v]) => setCursor(v)}
          disabled={!trace}
          aria-label="Scrub trace"
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-2.5 font-mono text-[11px] text-muted-foreground max-[720px]:hidden">
        <span>Speed</span>
        <Slider value={[speed]} min={1} max={8} step={1} onValueChange={([v]) => setSpeed(v)} aria-label="Playback speed" />
      </div>
    </footer>
  );
}
