import { VirtualFile } from "./types";

export const INITIAL_FILES: VirtualFile[] = [
  {
    id: "file-layout",
    name: "layout.tsx",
    path: "app/layout.tsx",
    language: "typescript",
    updatedAt: "10m ago",
    content: `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "File RAG Workspace",
  description: "AI-powered code explorer and assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
  },
  {
    id: "file-page",
    name: "page.tsx",
    path: "app/page.tsx",
    language: "typescript",
    updatedAt: "Just now",
    content: `"use client"

import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { FileViewer } from "@/components/file-explorer/file-viewer";
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";

export default function Home() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      {/* 3-panel layout: File Explorer | Center Content Viewer | AI Chatbot */}
    </div>
  );
}`,
  },
  {
    id: "file-login",
    name: "login-form.tsx",
    path: "components/login-form.tsx",
    language: "typescript",
    updatedAt: "15m ago",
    content: `"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = React.useState("");

  return (
    <form className="flex flex-col gap-4 max-w-sm mx-auto p-4 border rounded-lg">
      <h2 className="text-lg font-bold">Sign In</h2>
      <Input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit">Continue</Button>
    </form>
  );
}`,
  },
  {
    id: "file-rag",
    name: "rag-engine.ts",
    path: "src/lib/rag-engine.ts",
    language: "typescript",
    updatedAt: "5m ago",
    content: `/**
 * RAG Document Indexer & Semantic Retrieval System
 */

export interface DocumentChunk {
  id: string;
  sourceFile: string;
  content: string;
  metadata: {
    startLine: number;
    endLine: number;
  };
}

export class RagEngine {
  private chunks: DocumentChunk[] = [];

  public indexDocument(path: string, content: string): DocumentChunk[] {
    const lines = content.split("\\n");
    const chunkSize = 20;
    const newChunks: DocumentChunk[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
      newChunks.push({
        id: \`\${path}-\${i}\`,
        sourceFile: path,
        content: lines.slice(i, i + chunkSize).join("\\n"),
        metadata: {
          startLine: i + 1,
          endLine: Math.min(i + chunkSize, lines.length),
        },
      });
    }

    this.chunks.push(...newChunks);
    return newChunks;
  }

  public query(prompt: string, topK: number = 3): DocumentChunk[] {
    // Keyword similarity ranking
    const queryTerms = prompt.toLowerCase().split(/\\s+/);
    return [...this.chunks]
      .map(chunk => {
        const text = chunk.content.toLowerCase();
        const score = queryTerms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
        return { chunk, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  }
}`,
  },
  {
    id: "file-button",
    name: "button.tsx",
    path: "components/ui/button.tsx",
    language: "typescript",
    updatedAt: "1h ago",
    content: `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"`,
  },
  {
    id: "file-readme",
    name: "README.md",
    path: "README.md",
    language: "markdown",
    updatedAt: "2h ago",
    content: `# File RAG Web Application

A smart RAG-powered developer workspace built with Next.js, Groq AI, and shadcn components.

## Features
- **File Explorer**: Browse, create, edit, upload, and delete project files.
- **Code Viewer & Editor**: Monospace preview with line numbers and live editing mode.
- **RAG Assistant**: Chat with Groq AI with context from your selected project files.
- **Resizable Layout**: Split pane workspace with drag handles.

## Getting Started
\`\`\`bash
npm run dev
\`\`\`
`,
  },
  {
    id: "file-pkg",
    name: "package.json",
    path: "package.json",
    language: "json",
    updatedAt: "Yesterday",
    content: `{
  "name": "file-rag-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@ai-sdk/groq": "^4.0.62",
    "ai": "^7.0.142",
    "lucide-react": "^1.52.0",
    "next": "16.3.8",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}`,
  },
];
