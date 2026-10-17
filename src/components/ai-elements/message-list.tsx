"use client"

import * as React from "react"
import {
    CheckIcon,
    CopyIcon,
    PencilIcon,
    RefreshCcwIcon,
    ThumbsDownIcon,
    ThumbsUpIcon,
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
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    React.useEffect(() => {
        if (!copied) {
            return
        }

        const timeout = setTimeout(() => setCopied(false), 2000)
        return () => clearTimeout(timeout)
    }, [copied])

    return (
        <div className={cn("mx-auto flex w-full flex-col gap-6 py-4 flex-1 overflow-y-auto text-sm px-3", className)}>
            {messages.map((msg,idx) => (
                <Message key={idx} align={msg.role == "user" ? "end" : "start"}>
                    <MessageContent className="gap-2 max-w-full overflow-hidden">
                        <Bubble align={msg.role == "user" ? "end" : "start"} variant={msg.role == "user" ? "muted" : "tinted"} className="max-w-full">
                            <BubbleContent className="break-words overflow-x-auto text-xs max-w-full">
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
                    </MessageContent>
                </Message>
            ))}
            <div ref={messagesEndRef} />
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
