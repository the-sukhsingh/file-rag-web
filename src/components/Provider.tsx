"use client";

import { ThemeProvider } from "./theme/ThemeProvider"

export default function Provider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            {children}
        </ThemeProvider>
    )
}