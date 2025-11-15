'use client'

import { useChat } from 'ai/react'

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      background: 'white'
    }}>
      <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
        OpenCoach
      </h1>
      
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        marginBottom: '20px',
        padding: '20px',
        background: '#f9f9f9',
        borderRadius: '8px'
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>
            Start a conversation with OpenCoach...
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              textAlign: message.role === 'user' ? 'right' : 'left',
            }}
          >
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '4px',
              fontSize: '12px',
              color: '#666'
            }}>
              {message.role === 'user' ? 'You' : 'OpenCoach'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          </div>
        ))}
        {isLoading && (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px',
          }}
        />
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: '12px 24px',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}

