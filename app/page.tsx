'use client'

import { useChat } from 'ai/react'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                O
              </div>
              <h1 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                OpenCoach
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel - Collapsible */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">⚙️ Configuration</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </summary>
          
          <div className="mt-3 space-y-3">
            {/* Notification Settings */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Notifications</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">
                  {notificationPermission === 'granted' ? '✅' 
                    : notificationPermission === 'denied' ? '❌' 
                    : notificationPermission === 'checking' ? '⏳' 
                    : notificationPermission === 'unsupported' ? '❌'
                    : '⏳'}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-600">
                    Status: <span className="font-medium text-slate-800">
                      {notificationPermission === 'granted' ? 'Granted' 
                        : notificationPermission === 'denied' ? 'Denied' 
                        : notificationPermission === 'default' ? 'Pending'
                        : notificationPermission === 'checking' ? 'Checking...'
                        : 'Not Supported'}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm"
                  >
                    Enable Notifications
                  </button>
                )}
                {notificationPermission === 'granted' && (
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
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm"
                  >
                    Test Notification
                  </button>
                )}
              </div>
              
              {notificationPermission === 'granted' && (
                <p className="text-xs text-slate-500 mt-3">
                  Check browser console for detailed logs. If you see "Notification SHOWN" but no popup, check your OS/browser notification settings.
                </p>
              )}
              {notificationPermission === 'unsupported' && (
                <p className="text-xs text-slate-500 mt-3">
                  Your browser does not support notifications. Try using Chrome, Firefox, or Safari.
                </p>
              )}
            </div>
            
            {/* Notes Folder Path */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-3">
                Notes Folder Path
              </label>
              <input
                type="text"
                value={notesFolderPath}
                onChange={(e) => setNotesFolderPath(e.target.value)}
                placeholder="/path/to/your/notes/folder"
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              />
              <p className="text-xs text-slate-500 mt-2">
                Enter the absolute path to the folder containing your notes
              </p>
            </div>
          </div>
        </details>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                O
              </div>
              <h2 className="text-2xl font-semibold text-slate-800">Welcome to OpenCoach</h2>
              <p className="text-slate-500 max-w-md">
                Start a conversation with your AI coaching assistant. Ask questions, share thoughts, or get guidance on your goals.
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0 mt-1">
                  O
                </div>
              )}
              
              <div className={`flex flex-col max-w-3xl ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`
                    px-5 py-3.5 rounded-2xl shadow-sm
                    ${message.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white' 
                      : 'bg-white border border-slate-200 text-slate-800'
                    }
                  `}
                >
                  {message.role === 'assistant' ? (
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white font-medium text-sm shadow-md flex-shrink-0 mt-1">
                  U
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                O
              </div>
              <div className="bg-white border border-slate-200 px-5 py-3.5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-slate-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-3 bg-white rounded-2xl shadow-lg border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all duration-200">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="Message OpenCoach..."
                disabled={isLoading}
                rows={1}
                className="flex-1 px-4 py-3 bg-transparent resize-none outline-none text-slate-800 placeholder-slate-400 max-h-40 overflow-y-auto"
                style={{ minHeight: '24px' }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`
                  p-3 rounded-xl font-medium transition-all duration-200 flex-shrink-0
                  ${isLoading || !input.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

