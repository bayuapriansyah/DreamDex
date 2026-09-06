"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  value: "",
  onValueChange: () => {},
});

function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg p-0.5",
        className
      )}
      style={{ background: "var(--surface-2)" }}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-all",
        className
      )}
      style={{
        background: isActive ? "var(--surface-3)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
