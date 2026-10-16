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

export function MessagePattern({ messages }: { messages: MessageInter[] }) {
    const [copied, setCopied] = React.useState(false)

    React.useEffect(() => {
        if (!copied) {
            return
        }

        const timeout = setTimeout(() => setCopied(false), 2000)
        return () => clearTimeout(timeout)
    }, [copied])

    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-8 py-6 text-sm">
            {messages.map((msg,idx) => (
                <Message key={idx} align={msg.sender == "human" ? "end" : "start"}>
                    <MessageContent className="gap-2">
                        <Bubble align={msg.sender == "human" ? "end" : "start"} variant={msg.sender == "human" ? "muted" : "tinted"}>
                            <BubbleContent>
                                <Markdown>{msg.text}</Markdown>
                            </BubbleContent>
                        </Bubble>
                        <MessageFooter>
                            {msg.sender == "human" ? (
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
                                            navigator.clipboard.writeText(msg.text)
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
