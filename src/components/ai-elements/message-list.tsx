"use client"

import * as React from "react"
import {
    CheckIcon,
    CopyIcon,
    PencilIcon,
    RefreshCcwIcon,
} from "lucide-react"

import Markdown from "react-markdown"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
    Message,
    MessageContent,
    MessageFooter,
} from "@/components/ui/message"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChainOfThought } from "@/components/ai-elements/chain-of-thought"
import { Message as MessageInter } from "@/app/page"
import { cn } from "cn"

export function MessagePattern({
    messages,
    className,
}: {
    messages: MessageInter[];
    className?: string;
}) {
    const [copied, setCopied] = React.useState(false)
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // Following the end of a streaming reply is only wanted while the reader is
    // already there; scrolling back to read should not be fought.
    const stickToEnd = React.useRef(true)

    React.useEffect(() => {
        const container = scrollRef.current
        if (!container || !stickToEnd.current) return

        // Instant rather than smooth: a streaming answer repaints constantly,
        // and restarting a smooth scroll every frame just looks broken.
        container.scrollTop = container.scrollHeight
    }, [messages])

    React.useEffect(() => {
        if (!copied) {
            return
        }

        const timeout = setTimeout(() => setCopied(false), 2000)
        return () => clearTimeout(timeout)
    }, [copied])

    const handleScroll = () => {
        const container = scrollRef.current
        if (!container) return

        const distanceFromEnd =
            container.scrollHeight - container.scrollTop - container.clientHeight
        stickToEnd.current = distanceFromEnd < 48
    }

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn("mx-auto flex w-full flex-col gap-6 py-4 flex-1 overflow-y-auto text-sm px-3", className)}
        >
            {messages.map((msg) => (
                <Message key={msg.id} align={msg.role == "user" ? "end" : "start"}>
                    <MessageContent className="gap-2 max-w-full overflow-hidden">
                        {msg.role === "assistant" && msg.commands && msg.commands.length > 0 && (
                            <ChainOfThought commands={msg.commands} />
                        )}
                        {msg.content && (
                            <>
                                <Bubble align={msg.role == "user" ? "end" : "start"} variant={msg.role == "user" ? "muted" : "tinted"} className="max-w-full">
                                    <BubbleContent className="max-w-full break-words text-xs [&_pre]:break-words [&_pre]:whitespace-pre-wrap">
                                        <div className="prose prose-xs dark:prose-invert max-w-none break-words">
                                            <Markdown>{msg.content}</Markdown>
                                        </div>
                                    </BubbleContent>
                                </Bubble>
                                <MessageFooter>
                                    {msg.role == "user" ? (
                                        <>
                                            <MessageAction label="Copy">
                                                <CopyIcon />
                                            </MessageAction>
                                            <MessageAction label="Edit">
                                                <PencilIcon />
                                            </MessageAction>
                                        </>
                                    ) : (
                                        <>

                                            <MessageAction
                                                label={copied ? "Copied" : "Copy"}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(msg.content)
                                                    setCopied(true)
                                                }}
                                            >
                                                {copied ? <CheckIcon /> : <CopyIcon />}
                                            </MessageAction>
                                            <MessageAction label="Retry">
                                                <RefreshCcwIcon />
                                            </MessageAction>
                                        </>
                                    )}
                                </MessageFooter>
                            </>
                        )}
                    </MessageContent>
                </Message>
            ))}
        </div>
    )
}

function MessageAction({
    label,
    children,
    ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
    return (
        <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props}>{children}</Button>} />
            <TooltipContent>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}
