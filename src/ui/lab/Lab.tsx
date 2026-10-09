import * as DialogPrimitive from "@radix-ui/react-dialog";
import { STAGE_ROWS_PX, useIsCompact, useLayout } from "@/lib/layout";
import { navigate } from "@/lib/router";
import { variantLabel } from "@/core/experiment";
import { useLab } from "@/store/lab";
import { useUI } from "@/store/ui";
import { Close, Warn } from "../icons";
import { useCommitCounter } from "../perf";
import { Button } from "../primitives";
import { Inspector } from "./Inspector";
import { Present } from "./Present";
import { Setup } from "./Setup";
import { Legend, NowCaption, Stage } from "./Stage";
import { Transport } from "./Transport";
import { usePlaybackDriver } from "./playback";
import { useLabRoute } from "./useLabRoute";

function StageColumn() {
  useCommitCounter("stage column");
  return (
    <section
      className="grid min-h-0 min-w-0 bg-field"
      style={{
        gridTemplateRows: `minmax(0,1fr) ${STAGE_ROWS_PX.caption}px ${STAGE_ROWS_PX.legend}px ${STAGE_ROWS_PX.transport}px`,
      }}
      aria-label="Visualization"
    >
      <div className="min-h-0 min-w-0 [contain:strict]">
        <Stage />
      </div>
      <NowCaption />
      <div className="h-7 overflow-hidden border-t border-rule bg-surface px-4">
        <Legend />
      </div>
      <Transport />
    </section>
  );
}

export function Lab({
  query,
  setupOpen,
  setSetupOpen,
}: {
  query: URLSearchParams;
  setupOpen: boolean;
  setSetupOpen: (o: boolean) => void;
}) {
  const layout = useLayout();
  const compact = useIsCompact();
  const present = useUI((s) => s.present);
  const [error, dismiss] = useLabRoute(query);
  usePlaybackDriver();
  const title = useLab(
    (s) =>
      `Lab: ${variantLabel(s.exp.a)}${s.exp.b ? ` compared with ${variantLabel(s.exp.b)}` : ""}`,
  );
  const gridAspect = useLab((s) =>
    s.exp.family === "grid" && !s.exp.b ? s.exp.input.h / s.exp.input.w : 0,
  );
  const heading = <h1 className="sr-only">{title}</h1>;

  const banner = error && (
    <div
      role="alert"
      className="flex items-start gap-3 border-b border-signal/40 bg-signal-soft px-4 py-2.5 text-sm"
    >
      <Warn className="mt-0.5 shrink-0 text-signal-ink" />
      <p className="flex-1">{error} A default experiment is loaded instead.</p>
      <Button size="sm" variant="ghost" onClick={() => navigate("/")}>
        Explore
      </Button>
      <button aria-label="Dismiss" onClick={dismiss} className="text-ink-2 hover:text-ink">
        <Close />
      </button>
    </div>
  );

  if (present) return <Present />;

  if (layout === "narrow") {
    return (
      <div className="flex flex-col pb-[calc(148px+env(safe-area-inset-bottom))]">
        {heading}
        {banner}
        <div
          className="h-[min(56dvh,600px)] min-h-[280px] shrink-0 border-b border-rule bg-field [contain:strict]"
          style={
            gridAspect
              ? {
                  height: `min(56dvh, 600px, calc((100vw - 24px) * ${gridAspect.toFixed(4)} + 72px))`,
                }
              : undefined
          }
        >
          <Stage narrow={compact} />
        </div>
        <NowCaption />
        <div className="h-7 overflow-hidden border-b border-rule px-4">
          <Legend />
        </div>
        <Inspector inline withSetup />
        <div className="fixed inset-x-0 bottom-0 z-30 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)]">
          <Transport compact />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {heading}
      {banner}
      <div
        className={
          layout === "wide"
            ? "grid min-h-0 flex-1 grid-cols-[272px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]"
            : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]"
        }
      >
        {layout === "wide" ? (
          <aside
            className="min-h-0 overflow-y-auto border-r border-rule bg-surface [scrollbar-gutter:stable]"
            aria-label="Setup"
            data-tour="setup"
          >
            <Setup />
          </aside>
        ) : (
          <DialogPrimitive.Root open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/20 data-[state=open]:animate-fade-in" />
              <DialogPrimitive.Content
                className="fixed inset-y-0 left-0 z-50 w-[320px] overflow-y-auto border-r border-rule-strong bg-surface shadow-pop data-[state=open]:animate-slide-in-left"
                aria-describedby={undefined}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-surface px-4 py-3">
                  <DialogPrimitive.Title className="text-md font-semibold">
                    Setup
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close setup">
                      <Close />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <Setup />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        )}
        <StageColumn />
        <aside className="min-h-0 border-l border-rule bg-surface" aria-label="Inspector">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
