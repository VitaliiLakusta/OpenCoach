## Important Git Instructions

**CRITICAL: NEVER run `git push` automatically without explicit user permission.** Always ask the user before pushing changes to the remote repository. You may stage and commit changes, but pushing requires explicit approval from the user.

## Context of the project

The project is OpenCoach. OpenCoach accesses your notes. You give OpenCoach your context, in a special file called CONTEXT.md, where you write it your goals, priorities, and how you want OpenCoach to help you, for example you can ask OpenCoach to send you notifications every morning to help you reflect on your day and plan it ahead, or reflect on Friday on your whole week.
We want to have modular architecture where it can access notes from different systems: local filesystem, later we might implement other adapters, like accessing some notes over API (Notion, OneNote etc.). For first iteration, we only want to access local notes.

Core features of OpenCoach: 
1. Accessing notes in read/write mode. 
2. Use any LLM model, local or hosted (e.g. OpenAI or local LLAMA)
3. There is a concept of space. Space is your folder for one type of journalling, where all your notes are. For example, you might have "Professional" space, also "Personal development" space.
4. Each space has multiple context files in a space, which agent will take into account. 
Context file will also include instructions for OpenCoach when to poke you with reminders (notifications), or other tasks: for example, "create me weekly notes template every Monday morning". 
Master context file is CONTEXT.md

## Architecture 
We want to use Mastra on the backend and Vercel AI SDK on the frontend.

Vercel AI SDK handles:
- Chat UI (useChat, useCompletion, streaming)
- Edge-optimized streaming
- Handling text or tool-result streaming to the browser
- Model calls if you want, but not required

Mastra handles:
- Agent brain
- Memory
- Tools + actions
- Workflows
- RAG knowledge base
- MCP server later

Example: 
Frontend (Next.js) 
  └── uses Vercel AI SDK (useChat)
        ↓ sends messages to
Backend (Route Handler / Serverless)
  └── calls Mastra Agent
        ↓ agent reasoning / tools / RAG
        → returns stream of tokens
Frontend streams them through AI SDK

### Memory and database instructions
1. We want agent to read from notes. At first, we will only read notes from local filesystem.
2. WE DON'T WANT TO CREATE ANY DATABASE right now, next agent step will be decided in-memory.