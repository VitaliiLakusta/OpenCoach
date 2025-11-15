# Quick Start: Using Local Models with OpenCoach

## 3-Minute Setup

### Step 1: Install Ollama (1 minute)

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download installer from [ollama.ai](https://ollama.ai)

### Step 2: Download a Model (2 minutes)

```bash
# Recommended: Fast and capable (4GB download)
ollama pull llama3.2

# OR for even faster responses (2GB download)
ollama pull phi3
```

### Step 3: Use in OpenCoach (10 seconds)

1. Open OpenCoach
2. Click settings (⚙️ icon)
3. Select "Llama 3.2 (Local)" or "Phi-3 (Local)"
4. Start chatting!

## Verify Installation

Check Ollama is running:
```bash
ollama list
```

You should see your downloaded models.

## Available Local Models

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| **llama3.2** | 4GB | Fast | General use, daily journaling |
| **phi3** | 2GB | Very Fast | Quick responses, TODO lists |
| **llama3.1** | 7GB | Medium | Complex reasoning |
| **mistral** | 4GB | Fast | Balanced performance |
| **codellama** | 4GB | Fast | Code & technical help |
| **gemma2** | 3GB | Fast | Creative writing |

## Download More Models

```bash
ollama pull llama3.1    # More powerful
ollama pull mistral     # Good alternative
ollama pull codellama   # For code help
ollama pull gemma2      # Creative tasks
```

## Troubleshooting

### "Connection refused" error
```bash
# Start Ollama manually
ollama serve
```

### Model not showing up
```bash
# Verify it's downloaded
ollama list

# If not, pull it
ollama pull llama3.2
```

### Slow performance
- Try a smaller model: `ollama pull phi3`
- Close other applications
- Ensure you have 8GB+ RAM

## Why Use Local Models?

✅ **Privacy** - Your notes and conversations stay on your machine  
✅ **Cost** - No API charges, unlimited usage  
✅ **Speed** - Often faster than cloud models  
✅ **Offline** - Works without internet  

## When to Use Cloud Models?

Use OpenAI/Claude/Gemini for:
- Most complex reasoning tasks
- Latest capabilities
- Largest context windows
- Critical decisions

## Need More Help?

📖 See [LOCAL_MODELS.md](./LOCAL_MODELS.md) for detailed documentation  
🏗️ See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details  
📝 See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for what was implemented

---

**That's it! You're ready to use local models with OpenCoach! 🎉**

