# Local Models Setup Guide

OpenCoach now supports running local LLM models alongside cloud providers! This gives you privacy, cost savings, and offline capabilities.

## Why Use Local Models?

✅ **Privacy** - Your data stays on your machine  
✅ **Cost** - No API costs after initial setup  
✅ **Offline** - Works without internet connection  
✅ **Speed** - Can be faster for shorter responses  
✅ **Customization** - Full control over model parameters  

## Setup Instructions

### Option 1: Ollama (Recommended)

Ollama is the easiest way to run local models with OpenCoach.

#### 1. Install Ollama

**macOS:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai](https://ollama.ai)

#### 2. Pull Models

Download the models you want to use:

```bash
# Recommended for general use (4GB)
ollama pull llama3.2

# More powerful, needs more RAM (7GB)
ollama pull llama3.1

# Good for coding tasks (4GB)
ollama pull codellama

# Lightweight and fast (2GB)
ollama pull phi3

# Other popular models
ollama pull mistral
ollama pull gemma2
```

#### 3. Verify Ollama is Running

Ollama should start automatically. Verify it's running:

```bash
ollama list
```

You should see your downloaded models listed.

#### 4. Test the Connection

```bash
curl http://localhost:11434/api/tags
```

This should return a JSON list of your models.

### Option 2: LM Studio

LM Studio provides a graphical interface for managing local models.

1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Install and open LM Studio
3. Browse and download models from the UI
4. Start the local server (Settings → Local Server)
5. Update OpenCoach to use LM Studio's endpoint (default: `http://localhost:1234/v1`)

## Available Models in OpenCoach

Once Ollama is installed and running, the following local models will be available in OpenCoach:

| Model | Size | Best For | Speed |
|-------|------|----------|-------|
| **Llama 3.2** | 4GB | General chat, coaching | Fast |
| **Llama 3.1** | 7GB | Complex reasoning | Medium |
| **Mistral 7B** | 4GB | Balanced performance | Fast |
| **Code Llama** | 4GB | Code & technical help | Fast |
| **Phi-3** | 2GB | Quick responses | Very Fast |
| **Gemma 2** | 3GB | Creative writing | Fast |

## Selecting Models in OpenCoach

1. Open OpenCoach settings
2. Find the "Model" dropdown
3. Local models are marked with "🏠 (Local)"
4. Select your preferred local model
5. Start chatting!

## Troubleshooting

### Ollama Not Found Error

If you see "Connection refused" or similar errors:

1. Check if Ollama is running:
   ```bash
   ollama serve
   ```

2. Verify the port (default: 11434):
   ```bash
   lsof -i :11434
   ```

3. Test the API:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Model Not Available

If a model isn't working:

1. Check if it's downloaded:
   ```bash
   ollama list
   ```

2. Pull it if missing:
   ```bash
   ollama pull llama3.2
   ```

### Slow Performance

If models are running slowly:

- **RAM**: Ensure you have enough RAM (8GB minimum, 16GB recommended)
- **Model Size**: Try a smaller model like `phi3` or `llama3.2`
- **Background Apps**: Close unnecessary applications
- **GPU**: Ollama automatically uses GPU if available (Metal on Mac, CUDA on Linux)

### Out of Memory Errors

If you get OOM errors:

1. Try a smaller model:
   ```bash
   ollama pull phi3
   ```

2. Check available RAM:
   ```bash
   # macOS
   vm_stat
   
   # Linux
   free -h
   ```

3. Close other applications

## Model Recommendations

### For Daily Coaching & Journaling
- **Start with**: Llama 3.2 (great balance of quality and speed)
- **Upgrade to**: Llama 3.1 (if you have 16GB+ RAM)

### For Quick Notes & TODO Management
- **Best**: Phi-3 (very fast, good enough for simple tasks)
- **Alternative**: Llama 3.2

### For Code-Related Coaching
- **Best**: Code Llama (specialized for code)
- **Alternative**: Llama 3.1

### For Creative Writing & Reflections
- **Best**: Gemma 2 (great at creative tasks)
- **Alternative**: Llama 3.1

## Switching Between Local and Cloud Models

You can switch between local and cloud models anytime:

1. Use **local models** (Ollama) for:
   - Personal reflections and private notes
   - Daily journaling
   - Quick questions
   - Offline work

2. Use **cloud models** (GPT-4, Claude, etc.) for:
   - Complex reasoning tasks
   - Latest capabilities
   - When you need the best quality
   - Access to larger context windows

## Performance Comparison

### Typical Response Times (on M1 MacBook with 16GB RAM)

| Model | Short Response | Long Response |
|-------|---------------|---------------|
| Llama 3.2 (Local) | 0.5-1s | 3-5s |
| GPT-4o (Cloud) | 1-2s | 5-10s |
| Phi-3 (Local) | 0.3-0.5s | 2-3s |

*Note: Cloud models depend on internet speed and API latency*

## Advanced Configuration

### Custom Ollama Port

If you're running Ollama on a different port, update `lib/models.ts`:

```typescript
{
  id: 'ollama-llama3.2',
  name: 'Llama 3.2 (Local)',
  provider: 'ollama',
  modelId: 'llama3.2',
  baseURL: 'http://localhost:YOUR_PORT/v1',  // Change this
  isLocal: true
}
```

### Using Custom Models

If you've created or imported custom models in Ollama:

1. Add them to `lib/models.ts`:
   ```typescript
   {
     id: 'ollama-custom',
     name: 'My Custom Model (Local)',
     provider: 'ollama',
     modelId: 'your-model-name',  // Must match Ollama model name
     baseURL: 'http://localhost:11434/v1',
     isLocal: true
   }
   ```

2. Restart OpenCoach

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Ollama Model Library](https://ollama.ai/library)
- [LM Studio](https://lmstudio.ai)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai)

## Need Help?

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify Ollama is running: `ollama list`
3. Check OpenCoach logs in the browser console
4. Open an issue on the OpenCoach GitHub repository

---

**Happy coaching with local models! 🏠🤖**

