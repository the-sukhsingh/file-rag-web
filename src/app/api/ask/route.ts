import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createBashTool } from "bash-tool";

export const runtime = "nodejs";

const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
});

const model = groq("openai/gpt-oss-120b");

export async function POST(request: Request) {
    try {
        const { messages } = await request.json();

        if (!messages) {
            return NextResponse.json(
                { error: "Message content is required" },
                { status: 400 }
            );
        }

        const { tools } = await createBashTool({
            files: {
                "src/index.ts": "export const x = 1;",
            },
        });

        console.log("tools created", tools);

        const response = await generateText({
            model,
            messages,
            // tools,
        });

        return NextResponse.json({
            message: response.output,
        });
    } catch (error) {
        console.error("Error in chat API:", error);

        return NextResponse.json(
            { error: "An error occurred while processing your request" },
            { status: 500 }
        );
    }
}