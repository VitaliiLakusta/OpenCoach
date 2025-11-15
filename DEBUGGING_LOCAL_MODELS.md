# Debugging Local Models in OpenCoach

## Quick Diagnosis

If local models (Ollama) aren't working, follow these steps:

### Step 1: Verify Ollama is Running

```bash
ollama list
```

**Expected output**: List of installed models
**If it fails**: Ollama is not installed or not running

**Fix**:
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Then start Ollama
ollama serve
```

### Step 2: Verify Models are Downloaded

```bash
ollama list
```

You should see `llama3.2` or other models you want to use.

**If model is missing**:
```bash
ollama pull llama3.2
```

### Step 3: Test Ollama API Directly

```bash
curl http://localhost:11434/api/tags
```

**Expected**: JSON response with list of models
**If it fails**: Ollama server not responding

### Step 4: Test OpenAI-Compatible Endpoint

```bash
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": false
  }'
```

**Expected**: JSON response with "Hello" message
**If it fails**: OpenAI-compatible API not working

### Step 5: Run Test Script

```bash
cd /Users/vitalii.lakusta/g48/OpenCoach
node test-ollama.js
```

This will run comprehensive tests.

### Step 6: Check Browser Console

1. Open OpenCoach in browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Select an Ollama model
5. Send a message
6. Look for errors

**Common errors and fixes**:

#### Error: "Connection refused" or "ECONNREFUSED"
**Cause**: Ollama server not running
**Fix**: 
```bash
ollama serve
```

#### Error: "Model not found"
**Cause**: Model not downloaded
**Fix**:
```bash
ollama pull llama3.2
```

#### Error: "404 Not Found"
**Cause**: Wrong baseURL or model name
**Fix**: Check `lib/models.ts` - make sure modelId matches exactly what's in `ollama list`

### Step 7: Check Server Logs

Look at your Next.js terminal for logs like:

```
[Chat API] Using model: Llama 3.2 (Local) (provider: ollama, modelId: llama3.2)
[Chat API] ⚠️ Using LOCAL Ollama model
[getModel] Creating Ollama model instance for: llama3.2
[getModel] Ollama baseURL: http://localhost:11434/v1
[getModel] ✅ Ollama model instance created successfully
```

**If you see errors here**, that's your problem!

## Common Issues

### Issue 1: Model Name Mismatch

**Symptom**: Error saying model not found

**Check**:
```bash
ollama list
```

Note the **exact** model name (e.g., `llama3.2:latest`)

**Fix**: Update `lib/models.ts`:
```typescript
{
  id: 'ollama-llama3.2',
  name: 'Llama 3.2 (Local)',
  provider: 'ollama',
  modelId: 'llama3.2:latest',  // ← Add :latest if needed
  baseURL: 'http://localhost:11434/v1',
  isLocal: true
},
```

### Issue 2: Port Conflict

**Symptom**: Ollama running but OpenCoach can't connect

**Check if port 11434 is in use**:
```bash
lsof -i :11434
```

**Fix**: Kill conflicting process or change Ollama port

### Issue 3: Streaming Not Working

**Symptom**: Message starts but stops immediately

**Check**: Browser console for streaming errors

**Possible causes**:
- Ollama version too old (update Ollama)
- Network interceptor blocking streams
- Browser extension interfering

**Fix**:
```bash
# Update Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Restart Ollama
pkill ollama
ollama serve
```

### Issue 4: Tools Not Working with Local Models

**Symptom**: Tool calls fail or aren't triggered

**Note**: Some Ollama models don't support function calling well.

**Models with good tool support**:
- llama3.2 ✅
- llama3.1 ✅
- mistral ✅

**Models with poor tool support**:
- phi3 ⚠️
- older models ⚠️

**Fix**: Use llama3.2 or llama3.1 for best tool support

### Issue 5: Slow or Hanging Responses

**Symptoms**:
- Model takes forever to respond
- Terminal shows high CPU usage
- Responses are very slow

**Causes**:
- Not enough RAM
- CPU-only mode (no GPU)
- Model too large for your system

**Check RAM**:
```bash
# macOS
vm_stat | grep "Pages free"

# Linux
free -h
```

**Fix**:
```bash
# Use smaller model
ollama pull phi3  # Only 2GB

# Or close other applications
# Ollama automatically uses GPU if available (Metal on Mac, CUDA on Linux)
```

### Issue 6: Model Works in Terminal But Not in OpenCoach

**Symptom**: `curl` tests work, but OpenCoach doesn't

**Possible causes**:
1. Wrong model ID in `lib/models.ts`
2. Browser blocking localhost requests
3. Next.js not restarted after changes

**Fix**:
1. Check model ID matches `ollama list` exactly
2. Make sure running on `localhost` not `127.0.0.1` 
3. Restart Next.js:
   ```bash
   # Kill current server (Ctrl+C)
   npm run dev
   ```

## Debugging Checklist

Run through this checklist:

- [ ] Ollama installed: `ollama --version`
- [ ] Ollama running: `ollama list` works
- [ ] Model downloaded: See llama3.2 in `ollama list`
- [ ] API responding: `curl http://localhost:11434/api/tags` works
- [ ] OpenAI endpoint works: Test with curl (see Step 4 above)
- [ ] Model configured correctly in `lib/models.ts`
- [ ] Model ID matches exactly (including :latest if needed)
- [ ] Browser console shows no errors
- [ ] Server logs show model being used
- [ ] Test script passes: `node test-ollama.js`

## Enable Verbose Logging

Add this to `app/api/chat/route.ts` for more logging:

```typescript
// At the top of the file
const DEBUG_OLLAMA = true

// In the getOllamaClient function
function getOllamaClient() {
  if (!ollamaClient) {
    if (DEBUG_OLLAMA) {
      console.log('[Ollama] Creating new client instance')
      console.log('[Ollama] baseURL: http://localhost:11434/v1')
    }
    ollamaClient = createOpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    })
  }
  return ollamaClient
}
```

## Testing with Different Models

Try different models to isolate the issue:

```bash
# Smallest, fastest
ollama pull phi3

# Medium, balanced
ollama pull llama3.2

# Larger, more capable
ollama pull llama3.1
```

Then test each in OpenCoach.

## Still Not Working?

1. **Check Ollama logs**:
   ```bash
   # On macOS with Homebrew
   tail -f /usr/local/var/log/ollama.log
   
   # Or run Ollama in foreground to see logs
   killall ollama
   ollama serve
   ```

2. **Try a minimal test**:
   ```bash
   # Direct Ollama test
   ollama run llama3.2 "Say hello"
   ```

3. **Check for proxy/firewall**:
   - VPN might block localhost
   - Firewall might block port 11434
   - Corporate proxy might interfere

4. **Reinstall Ollama**:
   ```bash
   # macOS
   brew uninstall ollama
   brew install ollama
   
   # Or use installer
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

5. **Check Next.js environment**:
   ```bash
   # Sometimes environment variables interfere
   unset HTTP_PROXY
   unset HTTPS_PROXY
   npm run dev
   ```

## Get Help

If still stuck, gather this information:

1. Ollama version: `ollama --version`
2. Node version: `node --version`
3. OS: macOS/Linux/Windows
4. Output of: `ollama list`
5. Output of: `curl http://localhost:11434/api/tags`
6. Browser console errors (screenshot)
7. Server logs (copy/paste)
8. Result of: `node test-ollama.js`

Then open an issue with this information!

## Success Indicators

You'll know it's working when you see:

**In terminal (server logs)**:
```
[Chat API] Using model: Llama 3.2 (Local) (provider: ollama, modelId: llama3.2)
[Chat API] ⚠️ Using LOCAL Ollama model
[getModel] Creating Ollama model instance for: llama3.2
[getModel] ✅ Ollama model instance created successfully
```

**In browser**:
- No errors in console
- Messages stream in smoothly
- Model responds with actual content
- "(Local)" badge shows in model selector

**Performance indicators**:
- First token: < 1 second
- Full response: 2-5 seconds
- No freezing or hanging

---

**Remember**: Local models require Ollama to be running. If you restart your computer, you may need to run `ollama serve` again!

