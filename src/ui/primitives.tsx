import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Close } from "./icons";

const buttonStyles = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-[background-color,color,border-color,transform] duration-fast ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-ink text-surface hover:bg-ink/85",
        signal: "bg-signal text-signal-on hover:bg-signal/90",
        outline: "border border-rule-strong bg-surface text-ink hover:bg-sunken",
        ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
        quiet: "text-ink-2 hover:text-ink",
      },
      size: {
        sm: "h-7 px-2 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-10 px-4 text-base",
        icon: "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tip({
  label,
  keys,
  children,
  side = "top",
}: {
  label: string;
  keys?: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded bg-ink px-2 py-1 text-xs text-surface data-[state=delayed-open]:animate-fade-in"
        >
          {label}
          {keys && (
            <kbd className="readout rounded-sm border border-surface/30 px-1 text-2xs text-surface/80">
              {keys}
            </kbd>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string; keys?: string; tipSide?: "top" | "bottom" | "left" | "right" }
>(({ label, keys, tipSide, size = "icon", variant = "ghost", ...props }, ref) => (
  <Tip label={label} keys={keys} side={tipSide}>
    <Button ref={ref} aria-label={label} size={size} variant={variant} {...props} />
  </Tip>
));
IconButton.displayName = "IconButton";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "readout inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-rule-strong bg-surface px-1 text-2xs text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string; disabled?: boolean }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded border border-rule-strong bg-sunken p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          disabled={o.disabled}
          aria-label={typeof o.label === "string" ? undefined : o.title}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 font-medium text-ink-2 transition-colors duration-fast hover:text-ink disabled:opacity-40 data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-inset",
            size === "sm" ? "h-6 text-xs" : "h-7 text-sm",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  format,
  className,
  hideLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
  hideLabel?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {!hideLabel && (
        <div className="flex items-baseline justify-between">
          <span id={id} className="text-xs text-ink-2">
            {label}
          </span>
          <span className="readout text-xs text-ink">{format ? format(value) : value}</span>
        </div>
      )}
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit?.(v)}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-[3px] grow bg-rule-strong">
          <SliderPrimitive.Range className="absolute h-full bg-ink" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          aria-valuetext={format ? format(value) : String(value)}
          className="relative block h-5 w-3 rounded-sm border border-ink bg-surface transition-transform duration-fast before:absolute before:-inset-2 before:content-[''] hover:scale-110"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-8 w-full appearance-none rounded border border-rule-strong bg-surface pl-2.5 pr-8 text-sm text-ink transition-colors hover:border-ink-3",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  </div>
));
Select.displayName = "Select";

export const MenuRoot = Menu.Root;
export const MenuTrigger = Menu.Trigger;
export const MenuRadioGroup = Menu.RadioGroup;

export function MenuContent({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-[220px] max-w-[calc(100vw-16px)] rounded-md border border-rule-strong bg-surface p-1 shadow-pop data-[state=open]:animate-rise-in",
          className,
        )}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

const itemClass =
  "relative flex cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-sunken";

export function MenuItem({
  children,
  onSelect,
  keys,
  disabled,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  keys?: string;
  disabled?: boolean;
}) {
  return (
    <Menu.Item className={itemClass} onSelect={onSelect} disabled={disabled}>
      {children}
      {keys && <span className="readout ml-auto pl-4 text-2xs text-ink-3">{keys}</span>}
    </Menu.Item>
  );
}

export function MenuRadioItem({
  value,
  children,
  hint,
}: {
  value: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Menu.RadioItem value={value} className={cn(itemClass, "items-start pl-7")}>
      <Menu.ItemIndicator className="absolute left-2 top-2.5 h-1.5 w-1.5 rounded-full bg-signal" />
      <span className="flex flex-col">
        <span>{children}</span>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </span>
    </Menu.RadioItem>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <Menu.Label className="label px-2.5 pb-1 pt-2">{children}</Menu.Label>;
}

export function MenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-rule" />;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex max-h-[calc(100dvh-32px)] flex-col overflow-hidden border border-rule-strong bg-surface shadow-pop data-[state=open]:animate-sheet-in",
            "inset-x-0 bottom-0 rounded-t-lg sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[12vh] sm:-translate-x-1/2 sm:rounded-lg",
            wide ? "sm:w-[min(720px,calc(100vw-32px))]" : "sm:w-[min(460px,calc(100vw-32px))]",
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-md font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-ink-2">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <Close />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 overflow-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Section({
  title,
  children,
  aside,
  className,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-rule px-4 py-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 cursor-pointer [accent-color:rgb(var(--ink))]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-5">
        {label}
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}
