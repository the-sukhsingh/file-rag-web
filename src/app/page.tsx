"use client"
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface Message {
  role: "assistant" | "user",
  content: string
}

const PREV_MESSAGES: Message[] = [
  { role: "user", content: "Helo1" },
  { role: "assistant", content: "Hi, how can I help you ?" },
]

export default function Home() {

  const [messages, setMessages] = useState<Message[]>([])

  const send_message = async (text: string): Promise<void> => {
    setMessages([...messages, { role: "user", content: text }])
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([...messages, {role: "user", content: text}])
      });

      const data = await response.json();
      setMessages([...messages, { role: "user", content: text }, { role: "assistant", content: data.message }]);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  const clear_chat = () => {
    if (!confirm("are you sure?")) return
    setMessages([])
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MessagePattern messages={messages} />
      <PromptInputDemo onSubmitText={send_message} />

      <Button type="button" onClick={clear_chat} className={"fixed bottom-4 right-4"}>Clear Chat</Button>
    </div>
  );
}
