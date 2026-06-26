import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAlgoscope } from "@/store/useAlgoscope";
import { ALGORITHMS } from "@/core";
import type { Family } from "@/core";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { setFamily, setAlgo, run, regenerateData } = useAlgoscope();
  const [query, setQuery] = useState("");

  const commands = useMemo<Command[]>(() => {
    const algoCommands = ALGORITHMS.map((a) => ({
      id: `run-${a.id}`,
      label: `Run ${a.name}`,
      hint: a.meta,
      run: () => {
        setFamily(a.family as Family);
        setAlgo(a.id);
        setTimeout(run, 0);
      },
    }));
    return [
      ...algoCommands,
      { id: "regen", label: "Generate new data", hint: "sorting / learning", run: regenerateData },
    ];
  }, [setFamily, setAlgo, run, regenerateData]);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  const exec = (c: Command) => {
    c.run();
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={() => setQuery("")}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="grid grid-cols-[48px_1fr] items-center border-b border-border">
          <Search size={16} className="mx-auto text-[var(--primary-text)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) exec(filtered[0]);
            }}
            placeholder="Run A*, generate new data, sort an array…"
            className="h-[52px] bg-transparent text-[14px] text-foreground outline-none placeholder:text-faint"
            spellCheck={false}
          />
        </div>
        <div className="max-h-[380px] overflow-auto p-1.5" role="listbox">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No matching commands.</p>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => exec(c)}
              className={cn(
                "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--primary-soft)]",
                i === 0 && "bg-[var(--primary-soft)]/60",
              )}
            >
              <strong className="text-[13px] font-semibold text-foreground">{c.label}</strong>
              <kbd className="rounded border border-[var(--primary-soft-border)] bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]">
                {c.hint}
              </kbd>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
