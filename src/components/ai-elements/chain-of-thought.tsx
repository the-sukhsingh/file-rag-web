"use client"

import * as React from "react"
import {
    CircleAlertIcon,
    CircleCheckIcon,
    FileTextIcon,
    FolderTreeIcon,
    HashIcon,
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

    // `grep` exits 1 when nothing matched. That is an answer, not a failure.
    const noMatches = head === "grep" && report.exitCode === 1 && !error

    return {
        title: `Ran ${report.command}`,
        command: report.command,
        icon: COMMAND_ICONS[head] ?? <TerminalIcon />,
        output: noMatches
            ? "(no matching lines)"
            : // stderr is kept even on a zero exit code: warnings explain odd output.
              [stdout, error].filter(Boolean).join("\n") || "(no output)",
        failed: report.exitCode !== 0 && !noMatches,
    }
}

function StatusIcon({ failed }: { failed: boolean }) {
    return failed ? <CircleAlertIcon /> : <CircleCheckIcon />
}

function StepRow({ step }: { step: Step }) {
    return (
        <TraceCollapsible defaultOpen>
            <TraceCollapsibleTrigger>
                <TraceLine status={step.failed ? "error" : undefined}>
                    <TraceIcon>{step.icon}</TraceIcon>
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
 * The agent's whole reasoning trail for one reply: every bash, readFile and
 * writeFile call it made against the server workspace, with the output each
 * one returned. Open by default so the trail is visible, and collapsible when
 * the outputs get long.
 */
export function ChainOfThought({
    commands,
    className,
}: {
    commands: CommandReport[]
    className?: string
}) {
    const steps = React.useMemo(() => commands.map(toStep), [commands])
    const failed = steps.filter((step) => step.failed).length

    return (
        <Trace className={cn("text-xs", className)}>
            <TraceCollapsible defaultOpen>
                <TraceCollapsibleTrigger>
                    <TraceLine status={failed > 0 ? "error" : undefined}>
                        <TraceIcon>
                            <StatusIcon failed={failed > 0} />
                        </TraceIcon>
                        <TraceTitle>
                            {failed > 0
                                ? `Ran ${steps.length} steps, ${failed} failed`
                                : `Ran ${steps.length} step${steps.length === 1 ? "" : "s"}`}
                        </TraceTitle>
                    </TraceLine>
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent>
                    <Trace>
                        {steps.map((step, index) => (
                            <StepRow key={`${step.command}-${index}`} step={step} />
                        ))}
                    </Trace>
                </TraceCollapsibleContent>
            </TraceCollapsible>
        </Trace>
    )
}
