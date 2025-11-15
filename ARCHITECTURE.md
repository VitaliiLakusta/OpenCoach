# OpenCoach Architecture

## Overview

OpenCoach uses a modern, modular architecture combining Vercel AI SDK for the frontend and Mastra for backend agent logic (to be fully integrated).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Vercel AI SDK (useChat, useCompletion)                │ │
│  │  - Chat UI components                                   │ │
│  │  - Streaming text handling                              │ │
│  │  - Model selection                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP POST
┌─────────────────────────────────────────────────────────────┐
│                   API Route (/api/chat)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Model Router                                           │ │
│  │  - Receives model selection                             │ │
│  │  - Routes to appropriate provider                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
            ↓               ↓               ↓               ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   OpenAI     │  │  Anthropic   │  │   Google     │  │   Ollama     │
│  (Cloud)     │  │  (Cloud)     │  │  (Cloud)     │  │  (Local)     │
│              │  │              │  │              │  │              │
│ GPT-4o       │  │ Claude 3.5   │  │ Gemini 2.0   │  │ Llama 3.2    │
│ GPT-4o-mini  │  │ Claude 3     │  │ Gemini 1.5   │  │ Mistral      │
│ O1/O3        │  │ Haiku        │  │              │  │ Code Llama   │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                                                              ↓
                                              ┌──────────────────────────┐
                                              │  Local LLM Server        │
                                              │  (Ollama/LM Studio)      │
                                              │  http://localhost:11434  │
                                              └──────────────────────────┘
```

## Component Responsibilities

### Frontend (Vercel AI SDK)
- **Location**: `app/page.tsx`
- **Responsibilities**:
  - Chat UI rendering
  - Message streaming from server
  - User input handling
  - Model selection UI
  - Settings management (notes path, calendar URL)
- **Key Hook**: `useChat()` from `ai` package
- **Streaming**: Automatic via Vercel AI SDK

### Backend API Route
- **Location**: `app/api/chat/route.ts`
- **Responsibilities**:
  - Receive chat messages and settings
  - Load model configuration
  - Route to appropriate AI provider
  - Handle tools/function calling
  - Stream responses back to frontend
- **Key Function**: `streamText()` from `ai` package

### Model Router
- **Location**: `app/api/chat/route.ts` (`getModel()` function)
- **Responsibilities**:
  - Load model configuration from `lib/models.ts`
  - Initialize appropriate provider SDK
  - Handle provider-specific settings
  - Support both cloud and local models

### Model Configuration
- **Location**: `lib/models.ts`
- **Responsibilities**:
  - Define available models
  - Store provider information
  - Configure model-specific settings (baseURL for Ollama)
  - Mark local vs cloud models

### Tools & Actions
- **Location**: `app/api/chat/route.ts` (tools object)
- **Current Tools**:
  - `getCalendarInfo` - Fetch calendar events
  - `writeToFile` - Write/append to note files
  - `createGoogleCalendarLink` - Generate calendar event links
- **Future**: Mastra will manage tools and actions

## Local Model Integration

### How Local Models Work

1. **Ollama Server** runs locally on `http://localhost:11434`
2. **OpenAI-Compatible API** exposed at `/v1` endpoint
3. **Vercel AI SDK** connects via `createOpenAI()` with custom `baseURL`
4. **Same Interface** as cloud models - seamless switching

### Code Flow for Local Models

```typescript
// 1. User selects "Llama 3.2 (Local)" from UI
// 2. Frontend sends model ID to backend
const { messages, model: 'ollama-llama3.2' } = await req.json()

// 3. Backend routes to Ollama provider
const modelConfig = getModelById('ollama-llama3.2')
// => { provider: 'ollama', modelId: 'llama3.2', baseURL: 'http://localhost:11434/v1' }

// 4. Create Ollama client
const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama' // Not validated by Ollama
})

// 5. Get model instance
const model = ollama('llama3.2')

// 6. Stream response (same as cloud models)
const result = await streamText({ model, messages, ... })

// 7. Return streaming response to frontend
return result.toDataStreamResponse()
```

## Data Flow

### Chat Request Flow

```
User Input
   ↓
Frontend (useChat hook)
   ↓
POST /api/chat
   ↓
Model Router
   ↓
AI Provider (OpenAI/Anthropic/Google/Ollama)
   ↓
Streaming Response
   ↓
Frontend (automatic rendering)
   ↓
User sees response
```

### Tool Calling Flow

```
User: "Add gym to my TODO list"
   ↓
AI Model processes request
   ↓
Model calls writeToFile tool
   ↓
Tool executes (fs.appendFile)
   ↓
Tool returns result
   ↓
Model generates confirmation
   ↓
User sees: "Added to your TODO list in [file]"
```

## Memory & State

### Current Implementation (Stateless)
- **No database** - All state in request/response
- **Context per request** - Notes and calendar loaded each time
- **No persistent memory** - Each conversation is independent

### Future with Mastra
- **Agent Memory** - Mastra will manage conversation history
- **Knowledge Base** - RAG over notes and documents
- **Persistent State** - Track user goals and context over time
- **Workflows** - Multi-step agent tasks

## File Structure

```
/app
  /api
    /chat
      route.ts           # Main chat endpoint
    /calendar
      /ics
        route.ts         # Calendar file generation
    /reminders
      route.ts           # Reminder management
    /spaces
      route.ts           # Future: Space management
  page.tsx               # Main chat UI
  layout.tsx             # App layout
  globals.css            # Styling

/lib
  models.ts              # Model configurations
  calendar.ts            # Calendar utilities

/public
  logo.png               # App logo

Configuration:
  package.json           # Dependencies
  next.config.js         # Next.js config
  tsconfig.json          # TypeScript config
  tailwind.config.js     # Tailwind CSS
```

## Key Technologies

- **Frontend Framework**: Next.js 14 (App Router)
- **AI SDK**: Vercel AI SDK v3
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety
- **Local Models**: Ollama (OpenAI-compatible)
- **Cloud Providers**: OpenAI, Anthropic, Google, Mistral
- **Future Agent Framework**: Mastra

## Provider Integration

### Supported Providers

| Provider | Package | Environment Variable | Local/Cloud |
|----------|---------|---------------------|-------------|
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` | Cloud |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` | Cloud |
| Google | `@ai-sdk/google` | `GOOGLE_API_KEY` | Cloud |
| Mistral | `@ai-sdk/mistral` | `MISTRAL_API_KEY` | Cloud |
| Ollama | `@ai-sdk/openai` (with custom baseURL) | None | Local |

### Adding New Providers

To add a new provider:

1. Add to `ModelConfig` type in `lib/models.ts`
2. Add models to `AVAILABLE_MODELS` array
3. Add case to switch statement in `getModel()` function
4. Install provider SDK if needed (optional dependency)
5. Add environment variable for API key

## Environment Variables

```bash
# Required for cloud models
OPENAI_API_KEY=sk-...

# Optional cloud providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...

# Optional: Custom Ollama URL (defaults to localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Deployment Considerations

### Vercel Deployment (Cloud Models Only)
- Works out of the box
- Add API keys as environment variables
- Serverless functions handle all requests

### Self-Hosted with Local Models
- Deploy on server with Ollama installed
- Configure `OLLAMA_BASE_URL` to point to Ollama server
- Can run both local and cloud models
- Better for privacy-sensitive data

### Hybrid Setup
- Frontend on Vercel
- Backend API on self-hosted server with Ollama
- Use environment variable to point to custom API endpoint

## Future Enhancements

### Mastra Integration (Planned)
```
Frontend (Vercel AI SDK)
   ↓
Backend API Route
   ↓
Mastra Agent
   ├── Memory System
   ├── Tool Registry
   ├── Workflow Engine
   └── RAG Knowledge Base
```

### Features Coming with Mastra
- Persistent conversation memory
- Multi-step workflows
- RAG over notes and documents
- Scheduled tasks and reminders
- Multi-space support
- Advanced agent reasoning

## Performance

### Local vs Cloud Models

**Local Models (Ollama)**:
- ✅ Lower latency (no network)
- ✅ No API costs
- ✅ Privacy (data stays local)
- ⚠️ Requires local resources (RAM, CPU/GPU)
- ⚠️ Limited to smaller models

**Cloud Models**:
- ✅ Most powerful models available
- ✅ No local resource requirements
- ✅ Larger context windows
- ⚠️ API costs per request
- ⚠️ Network latency
- ⚠️ Data sent to third parties

### Recommended Usage
- **Local models**: Daily journaling, TODO management, quick questions
- **Cloud models**: Complex reasoning, code generation, important decisions
- **Hybrid**: Use local by default, switch to cloud when needed

## Security

### Current
- API keys stored in environment variables
- No authentication on frontend (local use only)
- Local models don't send data externally

### Future Considerations
- User authentication
- Role-based access to spaces
- Encrypted note storage
- API key management per user
- Rate limiting

## Testing Local Models

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull a model
ollama pull llama3.2

# 3. Verify Ollama is running
curl http://localhost:11434/api/tags

# 4. Start OpenCoach
npm run dev

# 5. Select "Llama 3.2 (Local)" from model dropdown

# 6. Test with a message
# Should see streaming response from local model
```

## Troubleshooting

### Local Models Not Working
1. Check Ollama is running: `ollama list`
2. Verify port 11434 is accessible
3. Check browser console for errors
4. Ensure model is downloaded: `ollama pull llama3.2`

### Cloud Models Not Working
1. Verify API key is set in `.env.local`
2. Check API key has proper permissions
3. Verify network connectivity
4. Check provider SDK is installed

---

**For more details on local models, see [LOCAL_MODELS.md](./LOCAL_MODELS.md)**

