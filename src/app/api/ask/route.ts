import { NextResponse } from "next/server";

// import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
// import Groq from "groq-sdk";
// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


import { createBashTool } from "bash-tool";
// import { Bash, OverlayFs } from "just-bash";

// const { tools, sandbox } = await createBashTool({
//     files: { "src/index.ts": "export const x = 1;" },
// });

import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
});

const model = groq('openai/gpt-oss-120b');



export async function POST(request: Request) {
    try {
        const { messages } = await request.json();
        console.log(messages)
        if (!messages) {
            return NextResponse.json(
                { error: "Message content is required" },
                { status: 400 }
            );
        }

        // const response = await generateText({
        //     model,
        //     messages: messages,
        // });

        // console.log(response, null, 2)

        // const responseMessage = response.content;
        const responseMessage = "Hanji";
        return NextResponse.json({ message: responseMessage });
    } catch (error) {
        console.error("Error in chat API", error);
        return NextResponse.json(
            { error: "An error occurred while processing your request" },
            { status: 500 }
        );
    }
}