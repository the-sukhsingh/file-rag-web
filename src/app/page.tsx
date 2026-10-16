"use client"
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";
import { useState } from "react";

export interface Message {
  sender: "ai" | "human",
  text: string
}

const PREV_MESSAGES: Message[] = [
  { sender: "human", text: "Helo1" },
  { sender: "ai", text: "Hi, how can I help you ?" },
]

export default function Home() {

  const [messages, setMessages] = useState<Message[]>(PREV_MESSAGES)

  const send_message = async (text: string): Promise<void> => {
    console.log(text)
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MessagePattern messages={messages} />
      <PromptInputDemo onSubmitText={send_message} />
    </div>
  );
}
