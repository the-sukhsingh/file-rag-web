"use client"

import * as React from "react"
import {
    CircleAlertIcon,
    CircleCheckIcon,
    FilePenLineIcon,
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
    /** Trigger label, e.g. `Read docs/chunk-001.md`. */
    title: string
    /** The exact command, shown on hover so the label stays readable. */
    command: string
    /** Icon for the step. */
    icon: React.ReactNode
    output: string
    failed: boolean
}

/** Icon per tool, so a trace of many steps still scans quickly. */
const STEP_ICONS: Record<string, React.ReactNode> = {
    readFile: <FileTextIcon />,
    cat: <FileTextIcon />,
    head: <FileTextIcon />,
    tail: <FileTextIcon />,
    writeFile: <FilePenLineIcon />,
    grep: <SearchIcon />,
    find: <SearchIcon />,
    ls: <FolderTreeIcon />,
    tree: <FolderTreeIcon />,
    wc: <HashIcon />,
    bash: <TerminalIcon />,
}

/**
 * Turns a `CommandReport` into a step. File tools arrive as pseudo commands
 * (`cat docs/chunk-001.md`), so the path is stripped back out of them.
 */
function toStep(report: CommandReport): Step {
    const path = report.command.replace(/^(?:cat|writeFile)\s+/, "")
    const stdout = report.stdout.trim()
    const error = report.stderr.trim()

    // `grep` exits 1 when nothing matched. That is an answer, not a failure.
    const noMatches =
        report.tool === "grep" && report.exitCode === 1 && !error

    return {
        title:
            report.tool === "readFile"
                ? `Read ${path}`
                : report.tool === "writeFile"
                  ? `Wrote ${path}`
                  : `Ran ${report.command}`,
        command: report.command,
        icon: STEP_ICONS[report.tool] ?? <TerminalIcon />,
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
