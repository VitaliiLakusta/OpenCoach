# OpenCoach

A minimal prototype chat application with Next.js, Vercel AI SDK, and Mastra (to be integrated).

## Features

✨ **Multi-Model Support** - Choose from OpenAI, Anthropic, Google, Mistral, or **local models**  
🏠 **Local LLMs** - Run Llama, Mistral, and other models locally via Ollama  
📝 **Notes Integration** - Read and write to your local note files  
📅 **Calendar Integration** - Connect your calendar for scheduling and planning  
💬 **Streaming Responses** - Real-time AI responses with Vercel AI SDK  

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with your API keys (optional for local models):
```
OPENAI_API_KEY=your_api_key_here
ANTHROPIC_API_KEY=your_api_key_here  # Optional
GOOGLE_API_KEY=your_api_key_here     # Optional
```

3. (Optional) Set up local models with Ollama:

**Why use local models?**
- 🔒 Complete privacy - your data never leaves your machine
- 💰 Zero API costs - unlimited usage
- ⚡ Often faster than cloud APIs
- 🌐 Works offline

**Install Ollama:**

macOS & Linux:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

Windows:
- Download from [ollama.ai](https://ollama.ai)

**Download models:**
```bash
# Recommended starter (4GB - good balance of speed and quality)
ollama pull llama3.2

# Fastest, most lightweight (2GB - great for quick responses)
ollama pull phi3

# Most powerful (7GB - best quality, needs 16GB+ RAM)
ollama pull llama3.1

# Other popular options
ollama pull mistral      # 4GB - balanced performance
ollama pull codellama    # 4GB - specialized for code
ollama pull gemma2       # 3GB - creative writing
```

**Verify installation:**
```bash
# Check Ollama is running
ollama list

# You should see your downloaded models
```

**Use in OpenCoach:**
1. Start OpenCoach (see step 4 below)
2. Click the settings icon (⚙️)
3. Select a local model from the dropdown (marked with "Local")
4. Start chatting privately and for free!

💡 **Tip**: Try `phi3` first for the fastest experience, or `llama3.2` for better quality responses.

📖 For troubleshooting and advanced configuration, see [LOCAL_MODELS.md](./LOCAL_MODELS.md)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Using Local Models

OpenCoach supports running LLMs locally for privacy and cost savings!

### Available Local Models

| Model | Size | Speed | Best For | RAM Needed |
|-------|------|-------|----------|------------|
| **Phi-3** | 2GB | ⚡⚡⚡ Very Fast | Quick questions, TODOs | 8GB |
| **Llama 3.2** | 4GB | ⚡⚡ Fast | Daily journaling, coaching | 8GB |
| **Mistral** | 4GB | ⚡⚡ Fast | Balanced performance | 8GB |
| **Gemma 2** | 3GB | ⚡⚡ Fast | Creative writing | 8GB |
| **Code Llama** | 4GB | ⚡⚡ Fast | Technical help, coding | 8GB |
| **Llama 3.1** | 7GB | ⚡ Medium | Complex reasoning | 16GB |

### Quick Troubleshooting

**"Connection refused" error?**
```bash
ollama serve  # Start Ollama manually
```

**Model not showing up?**
```bash
ollama list              # Check installed models
ollama pull llama3.2     # Download if missing
```

**Running slow?**
- Try a smaller model: `ollama pull phi3`
- Close other applications
- Ensure 8GB+ RAM available

**Still having issues?** See [DEBUGGING_LOCAL_MODELS.md](./DEBUGGING_LOCAL_MODELS.md) for comprehensive debugging steps.

### Local vs Cloud Models

**Use Local Models for:**
- 📝 Personal journaling and reflections
- ✅ TODO lists and daily planning
- 🤔 Quick questions and brainstorming
- 🔒 Sensitive or private information

**Use Cloud Models for:**
- 🧠 Complex reasoning and analysis
- 📊 Large documents and contexts
- 🚀 Latest AI capabilities
- 🎯 Critical decisions

📚 **For complete documentation, see [LOCAL_MODELS.md](./LOCAL_MODELS.md)**

## Current Features

- ✅ Multi-provider AI model support (OpenAI, Anthropic, Google, Mistral, Ollama)
- ✅ Local LLM support via Ollama
- ✅ Basic chat UI using Vercel AI SDK's `useChat` hook
- ✅ Streaming responses from the backend
- ✅ Notes folder integration (read/write)
- ✅ Calendar integration (iCal format)
- ✅ TODO management
- ✅ Event creation with calendar links

## Next Steps

- [ ] Integrate Mastra agent for advanced reasoning and tools
- [ ] Implement space concept and context files (CONTEXT.md)
- [ ] Add scheduled reminders and notifications
- [ ] Build multi-space support
- [ ] Enhanced note organization and search


