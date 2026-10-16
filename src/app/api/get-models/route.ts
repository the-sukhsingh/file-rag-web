import { NextResponse } from "next/server";
import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
export async function GET(request: Request) {
    try {
        const chatCompletion = await groq.models.list()
        console.log(JSON.stringify(chatCompletion, null, 2))
        const responseMessage =
            chatCompletion.data;
        return NextResponse.json({ message: responseMessage });
    } catch (error) {
        console.error("Error in chat API", error);
        return NextResponse.json(
            { error: "An error occurred while processing your request" },
            { status: 500 }
        );
    }
}