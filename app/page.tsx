'use client'

import { useChat } from 'ai/react'
import { useState, useEffect } from 'react'

export default function Home() {
  const [notesFolderPath, setNotesFolderPath] = useState('')
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'checking' | 'unsupported'>('checking')
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: {
      notesFolderPath,
    },
  })

  // Request notification permission and show test notification every 10 seconds
  useEffect(() => {
    // Check if notifications are supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('This browser does not support notifications')
      setNotificationPermission('unsupported')
      return
    }

    const intervalRef: { current: NodeJS.Timeout | null } = { current: null }
    
    const requestNotificationPermission = async () => {
      console.log('Current notification permission:', Notification.permission)
      
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
        console.log('Permission requested, result:', permission)
      }
      
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        console.log('Notification permission granted, setting up notifications')
        
        // Function to create and show notification
        const showNotification = (message: string, timestamp?: string) => {
          try {
            console.log('Attempting to create notification...', {
              message,
              timestamp,
              pageVisible: document.visibilityState,
              hasFocus: document.hasFocus()
            })
            
            // Try without icon first to see if that's the issue
            const notificationOptions: NotificationOptions = {
              body: message + (timestamp ? ` (${timestamp})` : ''),
              requireInteraction: true, // Keep it visible until clicked
              silent: false, // Play sound
              badge: undefined,
            }
            
            // Only add icon if we can verify it exists, otherwise skip it
            // Icon might be causing silent failures
            
            const notification = new Notification('OpenCoach', notificationOptions)
            
            console.log('Notification object created:', {
              title: notification.title,
              body: notification.body,
              timestamp: new Date().toISOString(),
              dir: notification.dir,
              lang: notification.lang,
              tag: notification.tag
            })
            
            // Set up all event handlers before anything else
            notification.onclick = () => {
              console.log('✅ Notification clicked!')
              window.focus()
              notification.close()
            }
            
            notification.onshow = () => {
              console.log('✅✅✅ Notification SHOWN successfully!')
            }
            
            notification.onerror = (error) => {
              console.error('❌ Notification error event fired:', error)
              console.error('Error details:', {
                error,
                type: typeof error,
                message: error instanceof Error ? error.message : 'Unknown error'
              })
            }
            
            notification.onclose = () => {
              console.log('Notification closed event fired')
            }
            
            // Check if notification is actually displayed
            setTimeout(() => {
              console.log('Checking notification state after 1 second...')
              console.log('Notification still exists:', notification)
            }, 1000)
            
            return notification
          } catch (error) {
            console.error('❌ Exception creating notification:', error)
            if (error instanceof Error) {
              console.error('Error name:', error.name)
              console.error('Error message:', error.message)
              console.error('Error stack:', error.stack)
            }
            return null
          }
        }
        
        // Show "hello world" notification immediately
        showNotification('Hello world', 'initial')
        
        // Set up interval to send notification every 10 seconds
        intervalRef.current = setInterval(() => {
          const timestamp = new Date().toLocaleTimeString()
          showNotification('Hello world', timestamp)
        }, 10000) // 10 seconds
        
        console.log('Notification interval set up')
      } else {
        console.log('Notification permission denied or not granted')
      }
    }

    requestNotificationPermission()
    
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        console.log('Clearing notification interval')
        clearInterval(intervalRef.current)
      }
    }
  }, [])

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
      
      <div style={{ marginBottom: '20px', padding: '12px', background: '#e3f2fd', borderRadius: '8px', fontSize: '14px' }}>
        <div style={{ marginBottom: '8px' }}>
          Notification Status: {notificationPermission === 'granted' ? '✅ Granted' 
            : notificationPermission === 'denied' ? '❌ Denied' 
            : notificationPermission === 'default' ? '⏳ Pending'
            : notificationPermission === 'checking' ? '⏳ Checking...'
            : '❌ Not Supported'}
        </div>
        {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && notificationPermission !== 'checking' && (
          <button
            onClick={async () => {
              if (typeof window !== 'undefined' && 'Notification' in window) {
                const permission = await Notification.requestPermission()
                setNotificationPermission(permission)
                if (permission === 'granted') {
                  new Notification('OpenCoach', { body: 'Test notification!' })
                }
              }
            }}
            style={{
              padding: '8px 16px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Request Notification Permission
          </button>
        )}
        {notificationPermission === 'granted' && (
          <>
            <button
              onClick={() => {
                console.log('=== MANUAL TEST BUTTON CLICKED ===')
                if (typeof window !== 'undefined' && 'Notification' in window) {
                  console.log('Creating manual test notification...')
                  try {
                    const notification = new Notification('OpenCoach Manual Test', { 
                      body: `Manual test at ${new Date().toLocaleTimeString()}!`,
                      requireInteraction: true,
                      silent: false,
                    })
                    console.log('Manual notification object created:', notification)
                    
                    notification.onclick = () => {
                      console.log('✅ Manual test notification clicked!')
                      window.focus()
                      notification.close()
                    }
                    notification.onshow = () => {
                      console.log('✅✅✅ Manual test notification SHOWN!')
                    }
                    notification.onerror = (error) => {
                      console.error('❌ Manual test notification error:', error)
                    }
                    notification.onclose = () => {
                      console.log('Manual test notification closed')
                    }
                  } catch (error) {
                    console.error('❌ Exception in manual test:', error)
                  }
                } else {
                  console.error('Notifications not supported in this context')
                }
              }}
              style={{
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                marginLeft: '8px',
              }}
            >
              Test Notification
            </button>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Check browser console for detailed logs. If you see "Notification SHOWN" but no popup, check your OS/browser notification settings.
            </div>
          </>
        )}
        {notificationPermission === 'unsupported' && (
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Your browser does not support notifications. Try using Chrome, Firefox, or Safari.
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          Notes Folder Path:
        </label>
        <input
          type="text"
          value={notesFolderPath}
          onChange={(e) => setNotesFolderPath(e.target.value)}
          placeholder="/path/to/your/notes/folder"
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
          Enter the absolute path to the folder containing your notes
        </div>
      </div>
      
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

