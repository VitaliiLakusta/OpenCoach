# OpenCoach

A minimal prototype chat application with Next.js, Vercel AI SDK, and Mastra (to be integrated).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Current Features

- Basic chat UI using Vercel AI SDK's `useChat` hook
- Streaming responses from the backend
- API route handler ready for Mastra integration

## Next Steps

- Integrate Mastra agent for advanced reasoning and tools
- Add local filesystem note reading functionality
- Implement space concept and context files


