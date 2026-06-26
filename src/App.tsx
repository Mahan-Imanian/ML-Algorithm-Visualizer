import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useAlgoscope } from "@/store/useAlgoscope";
import { TopBar } from "@/components/TopBar";
import { Workspace } from "@/components/Workspace";
import { Inspector } from "@/components/Inspector";
import { Timeline } from "@/components/Timeline";
import { CommandPalette } from "@/components/CommandPalette";

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Playback loop: advance the cursor on a cadence derived from the speed slider.
  const playing = useAlgoscope((s) => s.playing);
  const cursor = useAlgoscope((s) => s.cursor);
  const speed = useAlgoscope((s) => s.speed);
  const trace = useAlgoscope((s) => s.trace);

  useEffect(() => {
    if (!playing || !trace) return;
    if (cursor >= trace.events.length - 1) {
      useAlgoscope.setState({ playing: false });
      return;
    }
    const delay = 430 - speed * 48;
    const id = window.setTimeout(() => useAlgoscope.setState({ cursor: cursor + 1 }), delay);
    return () => window.clearTimeout(id);
  }, [playing, cursor, speed, trace]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = useAlgoscope.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === " ") {
        e.preventDefault();
        s.togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        s.stepForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        s.stepBack();
      } else if (e.key === "w") s.setTool("wall");
      else if (e.key === "g") s.setTool("weight");
      else if (e.key === "e") s.setTool("erase");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="grid h-screen grid-rows-[50px_minmax(0,1fr)_60px] gap-2 p-2">
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />

      <main className="grid min-h-0 grid-cols-[minmax(0,1fr)_308px] gap-2 max-lg:grid-cols-[minmax(0,1fr)]">
        <Workspace />
        <aside className="overflow-hidden rounded-xl border border-border bg-surface-1 max-lg:hidden" aria-label="Inspector">
          <Inspector />
        </aside>
      </main>

      <Timeline />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--s3)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}
