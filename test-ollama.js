// Quick test script to verify Ollama integration
// Run with: node test-ollama.js

async function testOllama() {
  console.log('Testing Ollama integration...\n')
  
  // Test 1: Check if Ollama is running
  console.log('1. Checking if Ollama server is running...')
  try {
    const response = await fetch('http://localhost:11434/api/tags')
    const data = await response.json()
    console.log('✅ Ollama is running')
    console.log(`   Found ${data.models?.length || 0} models:`)
    data.models?.forEach(model => {
      console.log(`   - ${model.name}`)
    })
  } catch (error) {
    console.log('❌ Ollama is not running or not accessible')
    console.log('   Error:', error.message)
    console.log('   Try running: ollama serve')
    return
  }
  
  // Test 2: Test OpenAI-compatible endpoint
  console.log('\n2. Testing OpenAI-compatible endpoint...')
  try {
    const response = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Say "hello" in one word' }],
        stream: false,
      }),
    })
    
    if (!response.ok) {
      console.log('❌ OpenAI-compatible endpoint returned error')
      console.log(`   Status: ${response.status}`)
      const text = await response.text()
      console.log(`   Response: ${text}`)
      return
    }
    
    const data = await response.json()
    console.log('✅ OpenAI-compatible endpoint is working')
    console.log(`   Response: ${data.choices[0].message.content}`)
  } catch (error) {
    console.log('❌ Error testing OpenAI-compatible endpoint')
    console.log('   Error:', error.message)
    return
  }
  
  // Test 3: Test with streaming
  console.log('\n3. Testing streaming...')
  try {
    const response = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Count from 1 to 3' }],
        stream: true,
      }),
    })
    
    if (!response.ok) {
      console.log('❌ Streaming endpoint returned error')
      console.log(`   Status: ${response.status}`)
      return
    }
    
    console.log('✅ Streaming is working')
    console.log('   Streamed response: ', end='')
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    let fullText = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim() !== '')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonData = JSON.parse(line.substring(6))
            const content = jsonData.choices[0]?.delta?.content
            if (content) {
              process.stdout.write(content)
              fullText += content
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    console.log('\n')
  } catch (error) {
    console.log('❌ Error testing streaming')
    console.log('   Error:', error.message)
    return
  }
  
  console.log('\n✅ All tests passed! Ollama integration is working correctly.')
  console.log('\nIf OpenCoach is not working, check:')
  console.log('1. Browser console for errors')
  console.log('2. Next.js server logs')
  console.log('3. Model configuration in lib/models.ts')
}

testOllama().catch(console.error)

