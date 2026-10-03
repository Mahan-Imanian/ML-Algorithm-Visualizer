import { useEffect, useLayoutEffect, useState } from "react";
import { useLab } from "@/store/lab";
import { useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { Button } from "./primitives";

interface Step {
  target: string;
  title: string;
  body: string;
  next?: string;
  waitFor?: "play" | "edit" | "compare";
}

const STEPS: Step[] = [
  {
    target: '[data-tour="play"]',
    title: "Run it",
    body: "This is breadth-first search in a maze. Press Run, or hit Space, and watch the search spread.",
    waitFor: "play",
  },
  {
    target: '[data-tour="code"]',
    title: "The code, live",
    body: "The highlighted line is the operation that just ran. The counts on the right show how often each line has executed so far.",
    next: "Next",
  },
  {
    target: '[data-tour="state"]',
    title: "The queue it's working from",
    body: "BFS always takes the cell at the top: the one discovered earliest. That first-in, first-out rule is why it spreads in rings.",
    next: "Next",
  },
  {
    target: '[data-tour="now"]',
    title: "Every step explains itself",
    body: "What happened, why, and what comes next. Use ← and → to step one expansion at a time, or drag the timeline.",
    next: "Next",
  },
  {
    target: '[data-tour="stage"]',
    title: "Change the problem",
    body: "Drag the target ring somewhere else, or draw a few walls. The run is recorded again instantly.",
    waitFor: "edit",
  },
  {
    target: '[data-tour="compare-btn"]',
    title: "Compare",
    body: "Press C or this button to run Dijkstra on the same maze, side by side. That's the tour. Press ⌘K any time to find anything.",
    waitFor: "compare",
    next: "Finish",
  },
];

export function Tour() {
  const step = useUI((s) => s.tour);
  const setTour = useUI((s) => s.setTour);
  const finish = () => {
    setTour(null);
    useSettings.getState().set({ tourDone: true });
  };

  useEffect(() => {
    if (step === null) return;
    const done = () => {
      setTour(null);
      useSettings.getState().set({ tourDone: true });
    };
    const s = STEPS[step];
    if (!s?.waitFor) return;
    const rev0 = useLab.getState().revision;
    return useLab.subscribe((st, prev) => {
      if (s.waitFor === "play" && st.playing && !prev.playing) {
        setTimeout(() => {
          const lab = useLab.getState();
          if (useUI.getState().tour === 0) {
            lab.pause();
            setTour(1);
          }
        }, 2600);
      }
      if (s.waitFor === "edit" && st.revision !== rev0 && !st.editing && st.exp !== prev.exp)
        setTour(5);
      if (s.waitFor === "compare" && st.runB && !prev.runB) done();
    });
  }, [step, setTour]);

  if (step === null || !STEPS[step]) return null;
  return (
    <Coachmark
      key={step}
      step={STEPS[step]}
      index={step}
      onNext={() => (step + 1 >= STEPS.length ? finish() : setTour(step + 1))}
      onSkip={finish}
    />
  );
}

function Coachmark({
  step,
  index,
  onNext,
  onSkip,
}: {
  step: Step;
  index: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    let raf = 0;
    let scrolled = false;
    const measure = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(
        (x) => x.getBoundingClientRect().height > 0,
      );
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "nearest" });
      }
      const r = el?.getBoundingClientRect() ?? null;
      setRect((prev) =>
        prev &&
        r &&
        Math.abs(prev.top - r.top) < 0.5 &&
        Math.abs(prev.left - r.left) < 0.5 &&
        Math.abs(prev.width - r.width) < 0.5 &&
        Math.abs(prev.height - r.height) < 0.5
          ? prev
          : r,
      );
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(320, vw - 24);
  let style: React.CSSProperties;
  if (rect && rect.width > 0 && vw >= 640) {
    const below = rect.bottom + 12 + 180 < vh;
    const top = below ? rect.bottom + 12 : Math.max(12, rect.top - 12 - 180);
    const left = Math.min(vw - cardW - 12, Math.max(12, rect.left + rect.width / 2 - cardW / 2));
    style = { top, left, width: cardW };
  } else {
    style = { left: 12, right: 12, bottom: 150 };
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] rounded-sm outline outline-2 outline-offset-4 outline-signal transition-all duration-med ease-out"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className="fixed z-[61] animate-rise-in rounded-md border border-ink bg-surface p-4 shadow-pop"
        style={style}
      >
        <div className="mb-1 flex items-center justify-between">
          <p className="label">
            Tour · {index + 1}/{STEPS.length}
          </p>
          <button
            onClick={onSkip}
            className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Skip
          </button>
        </div>
        <h2 id="tour-title" className="text-md font-semibold">
          {step.title}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i <= index ? "h-1 w-4 bg-ink" : "h-1 w-4 bg-rule-strong"} />
            ))}
          </div>
          {step.next ? (
            <Button size="sm" variant="primary" onClick={onNext} autoFocus>
              {step.next}
            </Button>
          ) : (
            <span className="text-xs text-ink-3">
              {step.waitFor === "play"
                ? "Waiting for Run…"
                : step.waitFor === "edit"
                  ? "Waiting for an edit…"
                  : ""}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
