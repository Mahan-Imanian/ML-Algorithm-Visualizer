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
    <header className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center gap-2.5 border-r border-border px-4">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--primary-soft-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]">
          <ScanEye size={16} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">Algoscope</span>
      </div>

      <div className="flex flex-1 items-center px-3">
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          an instrument for watching algorithms think
        </span>
      </div>

      <div className="flex items-center gap-1.5 border-l border-border px-3">
        <Button variant="outline" onClick={onOpenPalette} className="gap-1.5">
          <Command size={13} />
          <span className="hidden md:inline">Command</span>
          <kbd className="font-mono text-[10px] text-[var(--primary-text)]">⌘K</kbd>
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
