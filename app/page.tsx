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

  // Check notification permission on mount
  useEffect(() => {
    // Check if notifications are supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('This browser does not support notifications')
      setNotificationPermission('unsupported')
      return
    }

    const checkNotificationPermission = async () => {
      console.log('Current notification permission:', Notification.permission)
      
      // Just check the current permission, don't request it automatically
      // User can request permission via the button if needed
      const permission = Notification.permission
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        console.log('Notification permission is granted')
      } else {
        console.log('Notification permission:', permission)
      }
    }

    checkNotificationPermission()
  }, [])

  // Start reminders polling once a notes folder path is set
  useEffect(() => {
    if (!notesFolderPath || !notesFolderPath.trim()) {
      return
    }

    const folder = notesFolderPath.trim()
    console.log('[RemindersClient] Starting polling for CONTEXT.md in folder:', folder)

    const runOnce = async () => {
      try {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notesFolderPath: folder }),
        })
        const json = await res.json().catch(() => null)
        console.log('[RemindersClient] Reminders tick result:', json)
      } catch (error) {
        console.error('[RemindersClient] Error calling /api/reminders:', error)
      }
    }

    // Run immediately once when folder is set/changed
    runOnce()

    // Then run every 10 seconds
    const intervalId = setInterval(runOnce, 10_000)

    return () => {
      console.log('[RemindersClient] Stopping polling for folder:', folder)
      clearInterval(intervalId)
    }
  }, [notesFolderPath])

  // Check for due reminders every 10 seconds and fire notifications
  useEffect(() => {
    if (notificationPermission !== 'granted') {
      return
    }

    console.log('[RemindersCheck] Starting reminder check polling every 10 seconds')

    const checkDueReminders = async () => {
      try {
        const res = await fetch('/api/reminders/check', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        const json = await res.json().catch(() => null)
        
        if (!json || !json.ok) {
          console.error('[RemindersCheck] Error response:', json)
          return
        }

        const dueReminders = json.dueReminders || []
        const notesFolderPathFromState = json.notesFolderPath

        if (dueReminders.length > 0) {
          console.log(`[RemindersCheck] Found ${dueReminders.length} due reminder(s), firing notifications...`)
          
          const firedReminderDateTimes: string[] = []
          
          // Fire notifications for each due reminder
          for (const reminder of dueReminders) {
            try {
              if (typeof window !== 'undefined' && 'Notification' in window) {
                const notification = new Notification('OpenCoach', {
                  body: reminder.reminderText,
                  requireInteraction: true,
                  silent: false,
                })
                
                notification.onclick = () => {
                  console.log('✅ Reminder notification clicked:', reminder.reminderText)
                  window.focus()
                  notification.close()
                }
                
                notification.onshow = () => {
                  console.log('✅✅✅ Reminder notification SHOWN:', reminder.reminderText)
                }
                
                notification.onerror = (error) => {
                  console.error('❌ Reminder notification error:', error, reminder)
                }
                
                console.log(`[RemindersCheck] Fired notification: "${reminder.reminderText}"`)
                firedReminderDateTimes.push(reminder.dateTime)
              }
            } catch (error) {
              console.error('[RemindersCheck] Error firing notification:', error, reminder)
            }
          }

          // Mark fired reminders as completed (await to ensure it completes before re-calculation)
          if (firedReminderDateTimes.length > 0) {
            console.log('[RemindersCheck] Marking reminders as completed...')
            try {
              const completeRes = await fetch('/api/reminders/complete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reminderDateTimes: firedReminderDateTimes }),
              })
              const completeJson = await completeRes.json().catch(() => null)
              console.log('[RemindersCheck] Mark completed result:', completeJson)
              
              if (!completeJson || !completeJson.ok) {
                console.error('[RemindersCheck] Failed to mark reminders as completed, skipping re-calculation')
                return // Don't re-calculate if marking failed
              }
            } catch (error) {
              console.error('[RemindersCheck] Error marking reminders as completed:', error)
              return // Don't re-calculate if marking failed
            }
          }

          // Re-calculate reminders after firing notifications (only if marking succeeded)
          // This will preserve completed reminders due to the merge logic
          if (notesFolderPathFromState) {
            console.log('[RemindersCheck] Re-calculating reminders after firing notifications...')
            try {
              const recalcRes = await fetch('/api/reminders', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notesFolderPath: notesFolderPathFromState }),
              })
              const recalcJson = await recalcRes.json().catch(() => null)
              console.log('[RemindersCheck] Re-calculation result:', recalcJson)
            } catch (error) {
              console.error('[RemindersCheck] Error re-calculating reminders:', error)
            }
          } else {
            console.warn('[RemindersCheck] No notesFolderPath in state, skipping re-calculation')
          }
        }
      } catch (error) {
        console.error('[RemindersCheck] Error checking due reminders:', error)
      }
    }

    // Run immediately once
    checkDueReminders()

    // Then run every 10 seconds
    const intervalId = setInterval(checkDueReminders, 10_000)

    return () => {
      console.log('[RemindersCheck] Stopping reminder check polling')
      clearInterval(intervalId)
    }
  }, [notificationPermission])

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

