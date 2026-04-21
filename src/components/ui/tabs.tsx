"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: "horizontal" | "vertical";
  activationMode: "automatic" | "manual";
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`${componentName} must be used within <Tabs>.`);
  return ctx;
}

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  activationMode?: "automatic" | "manual";
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  activationMode = "automatic",
  className,
  ...props
}: TabsProps) {
  const reactId = React.useId();
  const baseId = React.useMemo(() => `tabs-${reactId}`, [reactId]);

  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => defaultValue ?? "");
  const selectedValue = value ?? uncontrolledValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value]
  );

  return (
    <TabsContext.Provider
      value={{
        value: selectedValue,
        setValue,
        baseId,
        orientation,
        activationMode
      }}
    >
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
}

type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

export function TabsList({ className, ...props }: TabsListProps) {
  const { orientation } = useTabsContext("TabsList");
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        "flex w-full items-center gap-4 overflow-x-auto whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

function getTriggerId(baseId: string, value: string) {
  return `${baseId}-trigger-${encodeURIComponent(value)}`;
}

function getContentId(baseId: string, value: string) {
  return `${baseId}-content-${encodeURIComponent(value)}`;
}

function focusMove(
  tablist: HTMLElement,
  direction: 1 | -1,
  current: HTMLElement,
  activate: (value: string) => void,
  activationMode: "automatic" | "manual"
) {
  const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true"
  );
  const idx = tabs.indexOf(current);
  if (idx < 0 || tabs.length === 0) return;
  const next = tabs[(idx + direction + tabs.length) % tabs.length];
  next?.focus();
  if (activationMode === "automatic") {
    const nextValue = next?.getAttribute("data-value");
    if (nextValue) activate(nextValue);
  }
}

export function TabsTrigger({
  value,
  className,
  onClick,
  onKeyDown,
  ...props
}: TabsTriggerProps) {
  const ctx = useTabsContext("TabsTrigger");
  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={getTriggerId(ctx.baseId, value)}
      aria-selected={selected}
      aria-controls={getContentId(ctx.baseId, value)}
      data-state={selected ? "active" : "inactive"}
      data-value={value}
      tabIndex={selected ? 0 : -1}
      className={cn(
        "relative shrink-0 px-1 pb-2 text-xs font-semibold text-slate-gray transition hover:text-expo-black focus:outline-none focus-visible:ring-2 focus-visible:ring-link-cobalt/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 data-[state=active]:text-expo-black data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-expo-black",
        className
      )}
      onClick={(e) => {
        if (!props.disabled) ctx.setValue(value);
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        const tablist = (e.currentTarget.parentElement ?? null) as HTMLElement | null;
        if (!tablist) {
          onKeyDown?.(e);
          return;
        }

        const key = e.key;
        const horiz = ctx.orientation === "horizontal";
        if ((horiz && key === "ArrowRight") || (!horiz && key === "ArrowDown")) {
          e.preventDefault();
          focusMove(tablist, 1, e.currentTarget, ctx.setValue, ctx.activationMode);
          return;
        }
        if ((horiz && key === "ArrowLeft") || (!horiz && key === "ArrowUp")) {
          e.preventDefault();
          focusMove(tablist, -1, e.currentTarget, ctx.setValue, ctx.activationMode);
          return;
        }
        if (key === "Home" || key === "End") {
          e.preventDefault();
          const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
            (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true"
          );
          const target = key === "Home" ? tabs[0] : tabs[tabs.length - 1];
          target?.focus();
          if (ctx.activationMode === "automatic") {
            const nextValue = target?.getAttribute("data-value");
            if (nextValue) ctx.setValue(nextValue);
          }
          return;
        }
        if (
          ctx.activationMode === "manual" &&
          (key === "Enter" || key === " " || key === "Spacebar")
        ) {
          e.preventDefault();
          ctx.setValue(value);
          return;
        }

        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  forceMount?: boolean;
};

export function TabsContent({ value, forceMount, className, ...props }: TabsContentProps) {
  const ctx = useTabsContext("TabsContent");
  const selected = ctx.value === value;

  if (!forceMount && !selected) return null;

  return (
    <div
      role="tabpanel"
      id={getContentId(ctx.baseId, value)}
      aria-labelledby={getTriggerId(ctx.baseId, value)}
      hidden={!selected}
      className={cn("w-full", className)}
      {...props}
    />
  );
}

