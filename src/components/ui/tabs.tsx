import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex items-stretch gap-1", className)} {...props} />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative cursor-pointer rounded-t-md px-3 text-[12px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground data-[state=active]:text-foreground",
      "after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-gradient-to-r after:from-[var(--primary)] after:to-[var(--primary-text)] after:opacity-0 after:shadow-[0_0_8px_var(--primary)] after:transition-opacity after:duration-200 data-[state=active]:after:opacity-100",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = TabsPrimitive.Content;

export { Tabs, TabsList, TabsTrigger, TabsContent };
