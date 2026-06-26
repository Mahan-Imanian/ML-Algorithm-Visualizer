import { ScanEye, Command, Download, Github } from "lucide-react";
import { useAlgoscope } from "@/store/useAlgoscope";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TopBarProps {
  onOpenPalette: () => void;
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const exportRun = useAlgoscope((s) => s.exportRun);
  const trace = useAlgoscope((s) => s.trace);

  const onExport = () => {
    if (!trace) return toast("Run an algorithm first, then export its trace.");
    const blob = new Blob([exportRun()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `algoscope-${trace.algoId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Trace exported as JSON.");
  };

  return (
    <header className="panel flex items-stretch overflow-hidden">
      <div className="flex items-center gap-2.5 border-r border-border px-4">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-b from-[var(--primary-top)] to-[var(--primary-bottom)] text-primary-foreground shadow-primary">
          <ScanEye size={16} />
        </span>
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">Algoscope</span>
          <span className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-[0.14em] text-faint lg:inline">
            algorithm lab
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center px-4">
        <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
          an instrument for watching algorithms think
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-l border-border px-3">
        <Button variant="outline" onClick={onOpenPalette} className="gap-1.5">
          <Command size={13} />
          <span className="hidden md:inline">Command</span>
          <kbd className="rounded border border-border bg-surface-3 px-1 py-px font-mono text-[10px] text-primary-text">
            ⌘K
          </kbd>
        </Button>
        <Button variant="outline" size="icon" onClick={onExport} aria-label="Export trace as JSON" title="Export JSON">
          <Download size={14} />
        </Button>
        <Button asChild variant="outline" size="icon" aria-label="View source on GitHub" title="GitHub">
          <a href="https://github.com/Mahan-Imanian/ML-Algorithm-Visualizer" target="_blank" rel="noreferrer">
            <Github size={14} />
          </a>
        </Button>
      </div>
    </header>
  );
}
