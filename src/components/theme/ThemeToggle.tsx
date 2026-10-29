"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  LaptopIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The theme switch.
 *
 * Three choices rather than a toggle, because "follow the system" is a real
 * setting and a two-state button cannot express it: once you toggle away
 * from the system, there is no way back to it without opening the OS
 * settings.
 */

const THEMES = [
  { id: "light", name: "Light", icon: SunIcon },
  { id: "dark", name: "Dark", icon: MoonIcon },
  { id: "system", name: "System", icon: LaptopIcon },
] as const;

/**
 * Whether the client has taken over yet.
 *
 * The theme is only known in the browser, so the first render has to agree
 * with the server. Reading it through `useSyncExternalStore` keeps that
 * first render stable and avoids a flash of the wrong icon.
 */
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ModeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return (
      <span
        className={cn("flex size-8 items-center justify-center", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Theme: ${theme ?? "system"}`}
            title="Change theme (Press D)"
            className={cn(
              "flex size-8 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal",
              className
            )}
          >
            {isDark ? (
              <MoonIcon className="size-4" />
            ) : (
              <SunIcon className="size-4" />
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.10em] text-pebble">
            Theme
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map((entry) => {
            const active = (theme ?? "system") === entry.id;
            return (
              <DropdownMenuItem
                key={entry.id}
                onClick={() => setTheme(entry.id)}
                className="justify-between text-[13px]"
              >
                <span className="flex items-center gap-2">
                  <entry.icon className="size-3.5" />
                  {entry.name}
                </span>
                {active && <CheckIcon className="size-3.5 text-electric-indigo" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
