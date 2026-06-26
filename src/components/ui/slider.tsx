import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-3 shadow-[inset_0_1px_2px_oklch(0_0_0/0.5)]">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-text)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 cursor-grab rounded-full border-2 border-[var(--primary-text)] bg-foreground shadow-[0_2px_6px_oklch(0_0_0/0.5),0_0_0_4px_oklch(0.62_0.2_286/0.18)] transition-transform duration-150 hover:scale-110 active:scale-95 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";

export { Slider };
