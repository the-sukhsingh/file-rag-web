"use client"

import * as React from "react"
import {
    CircleAlertIcon,
    CircleCheckIcon,
    FileTextIcon,
    FolderTreeIcon,
    HashIcon,
    LoaderCircleIcon,
    SearchIcon,
    TerminalIcon,
} from "lucide-react"

import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
    Trace,
    TraceCollapsible,
    TraceCollapsibleContent,
    TraceCollapsibleTrigger,
    TraceIcon,
    TraceLine,
    TraceTitle,
} from "@/components/ui/trace"
import type { CommandReport } from "@/lib/chat"
import { cn } from "cn"

/** One reported tool call, shaped for the trace UI. */
interface Step {
    /** Trigger label, e.g. `Ran grep -rn "bm25" .`. */
    title: string
    /** The exact command, shown on hover so the label stays readable. */
    command: string
    /** Icon for the step. */
    icon: React.ReactNode
    output: string
    /** True until the command reports its output. */
    running: boolean
    failed: boolean
}

/**
 * The agent sends whole commands, so the icon comes from the command it chose
 * rather than from a tool name: a trace of many steps still scans quickly.
 */
const COMMAND_ICONS: Record<string, React.ReactNode> = {
    ls: <FolderTreeIcon />,
    tree: <FolderTreeIcon />,
    find: <SearchIcon />,
    grep: <SearchIcon />,
    rg: <SearchIcon />,
    cat: <FileTextIcon />,
    nl: <FileTextIcon />,
    sed: <FileTextIcon />,
    head: <FileTextIcon />,
    tail: <FileTextIcon />,
    wc: <HashIcon />,
}

/** First word of the command: what the step actually did. */
function commandHead(command: string): string {
    return command.trim().split(/\s+/)[0]?.replace(/^["']/, "") ?? ""
}

function toStep(report: CommandReport): Step {
    const head = commandHead(report.command)
    const stdout = report.stdout.trim()
    const error = report.stderr.trim()
    const running = report.state === "running"

    // `grep` exits 1 when nothing matched. That is an answer, not a failure.
    const noMatches = head === "grep" && report.exitCode === 1 && !error

    return {
        title: `${running ? "Running" : "Ran"} ${report.command}`,
        command: report.command,
        icon: COMMAND_ICONS[head] ?? <TerminalIcon />,
        output: running
            ? "Running…"
            : noMatches
              ? "(no matching lines)"
              : // stderr is kept even on a zero exit code: warnings explain odd output.
                [stdout, error].filter(Boolean).join("\n") || "(no output)",
        running,
        failed: report.exitCode !== 0 && !noMatches,
    }
}

function StatusIcon({ status }: { status?: "running" | "error" }) {
    if (status === "running") {
        return <LoaderCircleIcon className="animate-spin" />
    }

    return status === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />
}

function StepRow({ step }: { step: Step }) {
    const status = step.running ? "running" : step.failed ? "error" : undefined

    // Closed by default: the command is the headline, its output is on demand.
    return (
        <TraceCollapsible>
            <TraceCollapsibleTrigger>
                <TraceLine status={status}>
                    <TraceIcon>
                        {status ? <StatusIcon status={status} /> : step.icon}
                    </TraceIcon>
                    <TraceTitle title={step.command} className="font-mono">
                        {step.title}
                    </TraceTitle>
                </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
                <CodeBlock size="sm" variant={step.failed ? "destructive" : "default"}>
                    <CodeBlockContent wrap className="max-h-64">
                        {step.output}
                    </CodeBlockContent>
                </CodeBlock>
            </TraceCollapsibleContent>
        </TraceCollapsible>
    )
}

/**
 * The agent's reasoning trail for one reply: one row per command it ran against
 * the server workspace, each closed by default. The collapsed rows say which
 * commands were sent without burying the answer under their output; opening a
 * row shows what that command returned.
 */
export function ChainOfThought({
    commands,
    className,
}: {
    commands: CommandReport[]
    className?: string
}) {
    const steps = React.useMemo(() => commands.map(toStep), [commands])

    return (
        <Trace className={cn("text-xs", className)}>
            {steps.map((step, index) => (
                <StepRow key={`${step.command}-${index}`} step={step} />
            ))}
        </Trace>
    )
}
