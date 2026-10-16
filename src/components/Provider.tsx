"use client";

import { ThemeProvider } from "./theme/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
export default function Provider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
    )
}