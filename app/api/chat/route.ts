import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

// For bare minimum prototype, using OpenAI directly via Vercel AI SDK
// This will be replaced with Mastra agent integration later
export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const result = await streamText({
      model: openai('gpt-3.5-turbo'),
      messages,
      system: 'You are OpenCoach, an AI coaching assistant. Help the user with their goals and priorities.',
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

