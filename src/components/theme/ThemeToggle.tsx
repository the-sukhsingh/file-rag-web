"use client"

import { useTheme } from "next-themes"
import { SVGProps } from "react";


export function ModeToggle() {
    const { theme, systemTheme, setTheme } = useTheme();
    const toggleTheme = () => {
        if (theme === 'system') {
            if (systemTheme === 'dark') {
                setTheme('light');
            } else {
                setTheme('dark');
            }
        } else {
            if (theme === 'dark') {
                setTheme('light');
            } else {
                setTheme('dark');
            }
        }
    }
    const handleThemeToggle = () => {
        toggleTheme();
    };


    return (
        <button
            aria-label="Toggle theme"
            aria-description="Toggle light & dark"
            onClick={handleThemeToggle}
            className="rounded-md size-8 flex justify-center items-center aspect-square h-fit relative overflow-hidden bg-accent active:translate-y-px shadow-inner/0 hover:shadow-inner transition-all duration-75 ease-out"
            type="button"
        >
            {
                theme === 'dark' || (theme === 'system' && systemTheme === 'dark') ? (
                    <Moon className="absolute top-0 left-0 translate-y-1/2 translate-x-1/2 size-4 scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
                ) : (
                    <Sun className="size-4" />
                )
            }
        </button>
    )
}

const Sun = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v1" />
    <path d="m18.364 5.636-.707.707" />
    <path d="M20 12h1" />
    <path d="m17.657 17.657.707.707" />
    <path d="M12 20v1" />
    <path d="m6.343 17.657-.707.707" />
    <path d="M3 12h1" />
    <path d="m5.636 5.636.707.707" />
  </svg>

)

const Moon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}

  >
    <path
      d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
    />
  </svg>

)
