"use client"
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";
import { useState } from "react";

interface Message {
  sender: "ai" | "human",
  text: string
}

export default function Home() {

  const [messages, setMessages] = useState<Message[]>([])

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MessagePattern />
     <PromptInputDemo />
    </div>
  );
}
