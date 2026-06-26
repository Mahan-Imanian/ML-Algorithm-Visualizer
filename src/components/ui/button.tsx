import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[12px] font-medium transition-[color,background,border-color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground font-semibold shadow-[0_4px_16px_oklch(0.54_0.2_279/0.4)] hover:bg-[var(--primary-hover)]",
        outline:
          "border border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:bg-surface-2 hover:text-foreground",
        ghost: "bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        soft: "border border-[var(--primary-soft-border)] bg-[var(--primary-soft)] text-[var(--primary-text)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-3.5",
        icon: "h-8 w-8",
        tall: "h-9 min-w-[72px] px-4",
      },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
