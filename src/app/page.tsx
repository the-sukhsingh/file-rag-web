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

  const [messages, setMessages] = useState<Message[]>([])

  const send_message = async (text: string): Promise<void> => {
    setMessages([...messages, { sender: "human", text }])
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      setMessages([...messages, { sender: "human", text }, { sender: "ai", text: data.message }]);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MessagePattern messages={messages} />
      <PromptInputDemo onSubmitText={send_message} />
    </div>
  );
}
