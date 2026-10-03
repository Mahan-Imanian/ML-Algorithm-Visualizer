import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { buildCommands, searchCommands, type Command } from "./commands";
import { Search } from "./icons";
import { Kbd } from "./primitives";

export function CommandPalette() {
  const open = useUI((s) => s.dialog === "palette");
  const close = useUI((s) => s.close);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/25 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[10vh] z-50 flex max-h-[min(560px,80dvh)] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-rule-strong bg-surface shadow-pop data-[state=open]:animate-rise-in"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          {open && <PaletteBody onDone={close} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const all = useMemo(() => buildCommands(), []);
  const results = useMemo(() => searchCommands(all, query), [all, query]);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onDone();
    setTimeout(() => c.run(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === "Home" && results.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && results.length) {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  };

  const groups: { name: string; items: { c: Command; i: number }[] }[] = [];
  results.forEach((c, i) => {
    const g =
      groups.find((x) => x.name === c.group) ??
      groups[groups.push({ name: c.group, items: [] }) - 1];
    g.items.push({ c, i });
  });

  return (
    <>
      <div className="flex items-center gap-3 border-b border-rule px-4">
        <Search className="shrink-0 text-ink-3" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search commands, algorithms and experiments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Try “bfs”, “maze”, “compare”, “quicksort worst case”"
          className="h-14 min-w-0 flex-1 bg-transparent text-md outline-none placeholder:text-ink-3"
          spellCheck={false}
          autoComplete="off"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Results"
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {results.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-ink-2">
            Nothing matches “{query}”. Try an algorithm name like{" "}
            <span className="readout">dijkstra</span> or an action like{" "}
            <span className="readout">share</span>.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.name} role="group" aria-label={g.name}>
            <div className="label px-2.5 pb-1 pt-2.5" aria-hidden="true">
              {g.name}
            </div>
            {g.items.map(({ c, i }) => (
              <div
                key={c.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => run(c)}
                className={cn(
                  "flex cursor-default items-center justify-between gap-3 rounded px-2.5 py-2 text-sm",
                  i === active ? "bg-ink text-surface" : "text-ink",
                )}
              >
                <span className="truncate">{c.label}</span>
                {c.keys && (
                  <span
                    className={cn(
                      "readout shrink-0 text-2xs",
                      i === active ? "text-surface/70" : "text-ink-3",
                    )}
                  >
                    {c.keys}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 border-t border-rule px-4 py-2 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> run
        </span>
        <span className="ml-auto">{results.length} results</span>
      </div>
    </>
  );
}
