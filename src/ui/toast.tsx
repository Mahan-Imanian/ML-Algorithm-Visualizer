import { cn } from "@/lib/utils";
import { Check, Close, Warn } from "./icons";
import { useToasts } from "./toastStore";

export function Toaster({ offset }: { offset: number }) {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-3"
      style={{ bottom: offset }}
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-[min(440px,100%)] animate-rise-in items-center gap-3 rounded-md border border-rule-strong bg-surface py-2 pl-3 pr-1.5 text-sm text-ink shadow-pop"
        >
          {t.tone === "success" ? (
            <Check className="shrink-0 text-st-path" />
          ) : t.tone === "error" ? (
            <Warn className="shrink-0 text-signal-ink" />
          ) : null}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              className={cn(
                "rounded px-2 py-1 text-sm font-medium text-ink underline underline-offset-4 hover:bg-sunken",
              )}
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            aria-label="Dismiss"
            className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink"
            onClick={() => dismiss(t.id)}
          >
            <Close size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
