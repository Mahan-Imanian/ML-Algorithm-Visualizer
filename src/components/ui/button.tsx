import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-[12px] font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 active:translate-y-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-[var(--primary-top)] to-[var(--primary-bottom)] font-semibold text-primary-foreground shadow-primary hover:-translate-y-px hover:shadow-primary-hover",
        secondary:
          "border border-border-strong bg-surface-2 text-foreground shadow-button hover:border-[var(--ring)]/40 hover:bg-surface-3",
        outline:
          "border border-border bg-surface-1 text-muted-foreground shadow-button hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
        ghost: "bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        soft: "border border-[var(--primary-soft-border)] bg-[var(--primary-soft)] text-primary-text shadow-button hover:bg-[oklch(0.62_0.2_286/0.2)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-3.5",
        icon: "h-8 w-8",
        tall: "h-9 min-w-[76px] px-4",
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
