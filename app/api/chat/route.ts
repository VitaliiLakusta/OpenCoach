import { openai, createOpenAI } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { readdir, readFile, stat, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { parseICalFromUrl, formatCalendarSummary } from '@/lib/calendar'
import { getModelById, DEFAULT_MODEL } from '@/lib/models'

// Helper function to dynamically load provider modules
// These are optional dependencies - if not installed, they will gracefully fail
async function loadProvider(providerName: string) {
  try {
    // Use require() for optional dependencies since webpack's IgnorePlugin
    // prevents them from being bundled, but they can still be required at runtime
    const modulePath = `@ai-sdk/${providerName}`
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(modulePath)
    
    switch (providerName) {
      case 'anthropic':
        return module.anthropic
      case 'google':
        return module.google
      case 'mistral':
        return module.mistral
      default:
        return null
    }
  } catch (e) {
    console.warn(`@ai-sdk/${providerName} not installed. ${providerName} models will not be available.`)
    return null
  }
}

// Cache for loaded providers
const providerCache: Record<string, any> = {}

// Create Ollama client instance (will be initialized when needed)
let ollamaClient: ReturnType<typeof createOpenAI> | null = null

// Helper function to get or create Ollama client
function getOllamaClient() {
  if (!ollamaClient) {
    ollamaClient = createOpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama doesn't validate this, but the SDK requires it
    })
  }
  return ollamaClient
}

// Helper function to get the model instance based on model config
async function getModel(modelId: string, openaiApiKey?: string) {
  const modelConfig = getModelById(modelId) || getModelById(DEFAULT_MODEL)
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found`)
  }

  switch (modelConfig.provider) {
    case 'openai': {
      // If a custom API key is provided, create a custom OpenAI instance
      if (openaiApiKey) {
        const customOpenAI = createOpenAI({
          apiKey: openaiApiKey,
        })
        return customOpenAI(modelConfig.modelId)
      }
      return openai(modelConfig.modelId)
    }
    case 'ollama': {
      // Use Ollama client with OpenAI-compatible API
      console.log(`[getModel] Creating Ollama model instance for: ${modelConfig.modelId}`)
      console.log(`[getModel] Ollama baseURL: ${modelConfig.baseURL || 'http://localhost:11434/v1'}`)
      try {
        const ollama = getOllamaClient()
        const model = ollama(modelConfig.modelId)
        console.log(`[getModel] ✅ Ollama model instance created successfully`)
        return model
      } catch (error) {
        console.error(`[getModel] ❌ Error creating Ollama model instance:`, error)
        throw error
      }
    }
    case 'anthropic': {
      // If a custom API key is provided for Anthropic, create a custom instance
      // Note: This would require importing createAnthropic from @ai-sdk/anthropic
      // For now, we use the default provider which reads from ANTHROPIC_API_KEY env var
      if (!providerCache.anthropic) {
        providerCache.anthropic = await loadProvider('anthropic')
      }
      if (!providerCache.anthropic) {
        throw new Error('Anthropic provider not available. Please install @ai-sdk/anthropic')
      }
      return providerCache.anthropic(modelConfig.modelId)
    }
    case 'google': {
      // If a custom API key is provided for Google, create a custom instance
      // Note: This would require importing createGoogle from @ai-sdk/google
      // For now, we use the default provider which reads from GOOGLE_API_KEY env var
      if (!providerCache.google) {
        providerCache.google = await loadProvider('google')
      }
      if (!providerCache.google) {
        throw new Error('Google provider not available. Please install @ai-sdk/google')
      }
      return providerCache.google(modelConfig.modelId)
    }
    case 'mistral': {
      // If a custom API key is provided for Mistral, create a custom instance
      // Note: This would require importing createMistral from @ai-sdk/mistral
      // For now, we use the default provider which reads from MISTRAL_API_KEY env var
      if (!providerCache.mistral) {
        providerCache.mistral = await loadProvider('mistral')
      }
      if (!providerCache.mistral) {
        throw new Error('Mistral provider not available. Please install @ai-sdk/mistral')
      }
      return providerCache.mistral(modelConfig.modelId)
    }
    default:
      throw new Error(`Unknown provider: ${modelConfig.provider}`)
  }
}

// For bare minimum prototype, using OpenAI directly via Vercel AI SDK
// This will be replaced with Mastra agent integration later
export async function POST(req: Request) {
  try {
    const { messages, notesFolderPath, calendarUrl, model: selectedModelId, openaiApiKey } = await req.json()

    // Validate API key for non-Ollama models
    const modelId = selectedModelId || DEFAULT_MODEL
    const modelConfig = getModelById(modelId) || getModelById(DEFAULT_MODEL)

    if (modelConfig?.provider !== 'ollama' && !openaiApiKey && !process.env.OPENAI_API_KEY) {
      const providerName = modelConfig?.provider === 'openai' ? 'OpenAI'
        : modelConfig?.provider === 'anthropic' ? 'Anthropic'
        : modelConfig?.provider === 'google' ? 'Google'
        : modelConfig?.provider === 'mistral' ? 'Mistral'
        : 'API'

      return new Response(
        JSON.stringify({
          error: `${providerName} API key is missing. Please configure your API key in the Configuration section (⚙️) at the top of the page, or use a local Ollama model which doesn't require an API key.`
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the model instance based on selection (defaults to DEFAULT_MODEL if not provided)
    let modelInstance
    try {
      modelInstance = await getModel(modelId, openaiApiKey)
    } catch (error) {
      console.error(`Error loading model ${modelId}:`, error)

      // Check if it's an API key error
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('API key') || errorMessage.includes('Incorrect API key') || errorMessage.includes('401')) {
        const providerName = modelConfig?.provider === 'openai' ? 'OpenAI'
          : modelConfig?.provider === 'anthropic' ? 'Anthropic'
          : modelConfig?.provider === 'google' ? 'Google'
          : modelConfig?.provider === 'mistral' ? 'Mistral'
          : 'API'

        return new Response(
          JSON.stringify({
            error: `Invalid ${providerName} API key. Please check your API key in the Configuration section (⚙️) at the top of the page and make sure it's correct.`
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Fallback to default OpenAI model
      if (openaiApiKey) {
        const customOpenAI = createOpenAI({
          apiKey: openaiApiKey,
        })
        modelInstance = customOpenAI('gpt-4o-mini')
      } else {
        modelInstance = openai('gpt-4o-mini')
      }
      console.warn(`Falling back to default model: gpt-4o-mini`)
    }

    let notesContent = ''
    let fileMetadata: Array<{ name: string; path: string; mtime: Date }> = []

    // If folder path is provided, read all notes from it
    if (notesFolderPath && typeof notesFolderPath === 'string' && notesFolderPath.trim()) {
      try {
        const { notes, metadata } = await readNotesFromFolder(notesFolderPath.trim())
        fileMetadata = metadata
        if (notes.length > 0) {
          notesContent = '\n\n## Notes from your folder:\n\n' + notes.join('\n\n---\n\n')

          // Add file awareness section
          const filesList = metadata
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Sort by most recent first
            .map((file, index) => {
              const dateStr = file.mtime.toISOString().split('T')[0]
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              return `${index + 1}. "${file.name}" (path: ${file.path}, modified: ${dateStr}${isToday ? ' - TODAY' : ''})`
            })
            .join('\n')

          notesContent += `\n\n## Available Files (sorted by most recent first):\n${filesList}\n\nIMPORTANT: When the user asks to add something to their TODO list for today, you should:
1. Find the most relevant note - typically the most recent file (file #1), or a file that was modified today (marked with "TODAY")
2. Use the writeToFile tool to append a TODO item to that file
3. Format TODO items clearly, for example:
   - [ ] Exercise and go to the gym
   or
   - TODO: Exercise and go to the gym

Always use the writeToFile tool with mode='append' when adding TODO items. The filePath should be the full path from the Available Files list above.`
        }
      } catch (error) {
        console.error('Error reading notes folder:', error)
        // Continue without notes if folder can't be read
      }
    }

    // If calendar URL is provided, fetch and include calendar information
    let calendarContent = ''
    if (calendarUrl && typeof calendarUrl === 'string' && calendarUrl.trim()) {
      try {
        const httpUrl = calendarUrl.trim().replace(/^webcal:\/\//, 'https://')
        console.log('[Chat API] Fetching calendar from URL:', httpUrl)

        const calendarInfo = await parseICalFromUrl(httpUrl)
        const summary = formatCalendarSummary(calendarInfo, 10)

        calendarContent = '\n\n## Your Calendar:\n\n' + summary
        calendarContent += '\n\nIMPORTANT: This calendar information is available as context. You can reference events when helping the user plan their time, avoid scheduling conflicts, or answer questions about their schedule. The calendar will be automatically refreshed when needed using the getCalendarInfo tool.'

        console.log('[Chat API] Successfully loaded calendar with', calendarInfo.totalEvents, 'events')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[Chat API] Error reading calendar:', errorMessage)

        calendarContent = `\n\n## Calendar:\n\nNote: Unable to fetch calendar information. Error: ${errorMessage}\n\nCommon issues:\n1. The calendar URL may need to be a public/shared calendar\n2. Some calendar providers require the calendar to be publicly accessible\n3. For Google Calendar, make sure to use the "Secret address in iCal format" from calendar settings\n4. The URL should end with .ics\n\nYou can still use the getCalendarInfo tool if the user provides a different calendar URL.`
        // Continue without calendar if it can't be read
      }
    }

    // Build calendar instruction based on whether user has configured a calendar URL
    let calendarInstruction = ''
    if (calendarUrl && typeof calendarUrl === 'string' && calendarUrl.trim()) {
      const userCalendarUrl = calendarUrl.trim().replace(/^webcal:\/\//, 'https://')
      calendarInstruction = ` You have access to the user's calendar via the getCalendarInfo tool. CRITICAL: When using the getCalendarInfo tool, you MUST ONLY use this exact calendar URL: "${userCalendarUrl}". DO NOT make up example URLs, use placeholder URLs, or use any other calendar URL. If you need to fetch calendar information, use ONLY the URL provided above.`
    } else {
      calendarInstruction = ' The user has not configured a calendar URL yet. You do NOT have access to the getCalendarInfo tool until they provide a calendar URL in the settings.'
    }

    const systemPrompt = 'You are OpenCoach, an AI coaching assistant. Help the user with their goals and priorities.' + calendarInstruction + ' When creating calendar events, always provide both the Google Calendar link and the .ics file download link so users can add the event to their preferred calendar app. CRITICAL: When using the createGoogleCalendarLink tool, the tool returns a "markdownResponse" field with pre-formatted markdown links. You MUST copy and paste the "markdownResponse" value exactly as-is into your response. Do NOT create your own links, modify the URLs, or use localhost URLs. Simply use the markdownResponse field directly.' + notesContent + calendarContent

    // Determine temperature based on model (some models like o1/o3 have restrictions)
    // modelConfig was already declared earlier in the function
    const isO1Model = modelConfig?.modelId.startsWith('o1') || modelConfig?.modelId.startsWith('o3')
    const temperature = isO1Model ? 1 : 0.7 // O1/O3 models only support temperature: 1
    
    // For Ollama models, add extra instruction to avoid unnecessary tool calls
    const ollamaExtraPrompt = modelConfig?.provider === 'ollama' 
      ? ' IMPORTANT: Only use tools when explicitly needed. For simple greetings and conversations, respond directly without using any tools. Only call writeToFile when the user specifically asks to write or add something to their notes.' 
      : ''
    
    const finalSystemPrompt = systemPrompt + ollamaExtraPrompt

    // Log which model is being used
    console.log(`[Chat API] Using model: ${modelConfig?.name || modelId} (provider: ${modelConfig?.provider || 'unknown'}, modelId: ${modelConfig?.modelId || modelId})`)
    
    // Add extra logging for Ollama models
    if (modelConfig?.provider === 'ollama') {
      console.log(`[Chat API] ⚠️ Using LOCAL Ollama model`)
      console.log(`[Chat API] Make sure Ollama is running: ollama serve`)
      console.log(`[Chat API] Make sure model is installed: ollama list`)
    }

    const result = await streamText({
      model: modelInstance,
      messages,
      system: finalSystemPrompt,
      temperature,
      maxSteps: 5, // Allow multiple tool calls and responses
      // For Ollama models, be more conservative with tool usage
      ...(modelConfig?.provider === 'ollama' && { toolChoice: 'auto' }),
      tools: {
        getCalendarInfo: tool({
          description: 'Fetch and parse calendar information from the user\'s configured iCal calendar URL. Use this to get information about upcoming events, meetings, and schedule. IMPORTANT: You must ONLY use the exact calendar URL that was provided in the system prompt. Do NOT use example URLs, placeholder URLs, or make up calendar URLs.',
          parameters: z.object({
            calendarUrl: z.string().describe('MUST be the exact calendar URL provided in the system prompt. Do NOT use example.com or any placeholder URL.'),
            maxEvents: z.number().optional().default(10).describe('Maximum number of events to include in each section (default: 10)')
          }),
          execute: async ({ calendarUrl, maxEvents }) => {
            try {
              // Validate that this is not an example/placeholder URL
              if (calendarUrl.includes('example.com') || calendarUrl.includes('placeholder') || calendarUrl.includes('your-calendar')) {
                return {
                  success: false,
                  error: 'Invalid calendar URL. You must use the actual calendar URL provided by the user, not an example or placeholder URL. Check the system prompt for the correct calendar URL.',
                }
              }

              // Convert webcal:// to https://
              const httpUrl = calendarUrl.replace(/^webcal:\/\//, 'https://')

              const calendarInfo = await parseICalFromUrl(httpUrl)
              const summary = formatCalendarSummary(calendarInfo, maxEvents)

              return {
                success: true,
                summary,
                stats: {
                  totalEvents: calendarInfo.totalEvents,
                  todayCount: calendarInfo.todayEvents.length,
                  thisWeekCount: calendarInfo.thisWeekEvents.length,
                  upcomingCount: calendarInfo.upcomingEvents.length,
                },
                // Return structured data for further processing
                todayEvents: calendarInfo.todayEvents.slice(0, maxEvents).map(e => ({
                  summary: e.summary,
                  start: e.start.toISOString(),
                  end: e.end.toISOString(),
                  location: e.location,
                  description: e.description,
                })),
                thisWeekEvents: calendarInfo.thisWeekEvents.slice(0, maxEvents).map(e => ({
                  summary: e.summary,
                  start: e.start.toISOString(),
                  end: e.end.toISOString(),
                  location: e.location,
                  description: e.description,
                })),
              }
            } catch (error) {
              return {
                success: false,
                error: `Failed to fetch calendar: ${error instanceof Error ? error.message : String(error)}`,
              }
            }
          },
        }),
        writeToFile: tool({
          description: 'Write or append content to a note file. Use this when the user asks to add something to their notes, TODO list, or any file. IMPORTANT: After using this tool, you MUST confirm to the user what was done and which file was modified.',
          parameters: z.object({
            filePath: z.string().describe('The full path to the file to write to'),
            content: z.string().describe('The content to append to the file'),
            mode: z.enum(['append', 'write']).default('append').describe('Whether to append to the file or overwrite it. Use append for adding TODO items.')
          }),
          execute: async ({ filePath, content, mode }) => {
            try {
              if (mode === 'append') {
                await appendFile(filePath, '\n' + content, 'utf-8')
                return { success: true, message: `Successfully appended content to ${filePath}` }
              } else {
                await writeFile(filePath, content, 'utf-8')
                return { success: true, message: `Successfully wrote content to ${filePath}` }
              }
            } catch (error) {
              return { success: false, error: `Failed to write to file: ${error}` }
            }
          },
        }),
        createGoogleCalendarLink: tool({
          description: 'Generate a Google Calendar link and .ics file for creating a calendar event. Use this when the user asks to create a calendar reminder, event, or schedule something. Returns both a Google Calendar link and an .ics file download link that works with any calendar app (Apple Calendar, Outlook, etc.). CRITICAL INSTRUCTIONS: The tool returns a "message" field that contains the complete formatted response with markdown links. You MUST use the "message" field value EXACTLY as-is in your response. Do NOT create your own links, modify the URLs, add your own text, or use localhost URLs. Simply return the "message" field value directly without any modifications.',
          parameters: z.object({
            title: z.string().describe('The title/name of the calendar event'),
            startDateTime: z.string().describe('Start date and time in ISO 8601 format (e.g., "2026-01-15T14:00:00Z" for UTC, or "2026-01-15T14:00:00" for local time)'),
            endDateTime: z.string().optional().describe('End date and time in ISO 8601 format. If not provided, defaults to 1 hour after start time. For all-day events, use the same date for start and end.'),
            description: z.string().optional().describe('Event description or notes'),
            location: z.string().optional().describe('Event location'),
            recurrence: z.string().optional().describe('Recurrence rule for recurring events. Use RRULE format, e.g., "RRULE:FREQ=DAILY" for daily, "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR" for specific days')
          }),
          execute: async ({ title, startDateTime, endDateTime, description, location, recurrence }) => {
            try {
              // Parse start date
              const startDate = new Date(startDateTime)
              if (isNaN(startDate.getTime())) {
                return { success: false, error: 'Invalid start date format' }
              }

              // Parse or calculate end date
              let endDate: Date
              if (endDateTime) {
                endDate = new Date(endDateTime)
                if (isNaN(endDate.getTime())) {
                  return { success: false, error: 'Invalid end date format' }
                }
              } else {
                // Default to 1 hour after start
                endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
              }

              // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
              const formatGoogleDate = (date: Date): string => {
                return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
              }

              // Format dates for .ics file (YYYYMMDDTHHmmssZ)
              const formatICSDate = (date: Date): string => {
                return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
              }

              const startFormatted = formatGoogleDate(startDate)
              const endFormatted = formatGoogleDate(endDate)

              // Build Google Calendar URL parameters
              const params = new URLSearchParams({
                action: 'TEMPLATE',
                text: title,
                dates: `${startFormatted}/${endFormatted}`,
              })

              if (description) {
                params.append('details', description)
              }

              if (location) {
                params.append('location', location)
              }

              if (recurrence) {
                params.append('recur', recurrence)
              }

              const calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`

              // Generate .ics file content
              const icsStart = formatICSDate(startDate)
              const icsEnd = formatICSDate(endDate)
              const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@opencoach`
              const now = formatICSDate(new Date())

              // Escape special characters in .ics content
              const escapeICS = (text: string): string => {
                return text
                  .replace(/\\/g, '\\\\')
                  .replace(/;/g, '\\;')
                  .replace(/,/g, '\\,')
                  .replace(/\n/g, '\\n')
              }

              let icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//OpenCoach//Calendar Event//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${now}`,
                `DTSTART:${icsStart}`,
                `DTEND:${icsEnd}`,
                `SUMMARY:${escapeICS(title)}`,
              ]

              if (description) {
                icsContent.push(`DESCRIPTION:${escapeICS(description)}`)
              }

              if (location) {
                icsContent.push(`LOCATION:${escapeICS(location)}`)
              }

              if (recurrence) {
                // Remove "RRULE:" prefix if present, as .ics format expects just the rule
                const rrule = recurrence.startsWith('RRULE:') ? recurrence.substring(6) : recurrence
                icsContent.push(`RRULE:${rrule}`)
              }

              icsContent.push('END:VEVENT')
              icsContent.push('END:VCALENDAR')

              const icsFileContent = icsContent.join('\r\n')
              const icsFileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`

              // Create API endpoint URL for .ics file download
              // Build query parameters for the API endpoint
              const icsParams = new URLSearchParams({
                title: title,
                startDateTime: startDate.toISOString(),
                endDateTime: endDate.toISOString(),
              })
              if (description) {
                icsParams.append('description', description)
              }
              if (location) {
                icsParams.append('location', location)
              }
              if (recurrence) {
                icsParams.append('recurrence', recurrence)
              }
              
              // Use the API endpoint instead of data URL
              const icsDataUrl = `/api/calendar/ics?${icsParams.toString()}`
              
              // Also keep the data URL for backwards compatibility, but prefer the API endpoint
              const icsDataUrlFallback = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFileContent)}`

              // Create pre-formatted markdown links that the agent should use exactly as-is
              const googleCalendarMarkdown = `[Add to Google Calendar](${calendarUrl})`
              const icsFileMarkdown = `[Download .ics file](${icsDataUrl})`

              return {
                success: true,
                // Primary message that agent should use directly
                message: `I've created a calendar event "${title}". Here are the links to add it to your calendar:\n\n${googleCalendarMarkdown}\n\n${icsFileMarkdown}`,
                // Also provide the markdown separately for reference
                markdownResponse: `${googleCalendarMarkdown}\n\n${icsFileMarkdown}`,
                // Individual components for reference
                googleCalendarUrl: calendarUrl,
                googleCalendarMarkdown: googleCalendarMarkdown,
                icsDataUrl: icsDataUrl,
                icsFileMarkdown: icsFileMarkdown,
                icsFileName: icsFileName,
                eventDetails: {
                  title,
                  start: startDate.toISOString(),
                  end: endDate.toISOString(),
                  description,
                  location,
                  recurrence
                }
              }
            } catch (error) {
              return { success: false, error: `Failed to create calendar link: ${error}` }
            }
          },
        }),
      },
    })

    console.log(`[Chat API] streamText result created, streaming response...`)

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[Chat API] ❌ Error in chat API:', error)
    if (error instanceof Error) {
      console.error('[Chat API] Error message:', error.message)
      console.error('[Chat API] Error stack:', error.stack)
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function readNotesFromFolder(folderPath: string): Promise<{ 
  notes: string[], 
  metadata: Array<{ name: string; path: string; mtime: Date }> 
}> {
  const notes: string[] = []
  const metadata: Array<{ name: string; path: string; mtime: Date }> = []
  const textFileExtensions = ['.md', '.txt', '.markdown', '.mdx']
  
  try {
    const entries = await readdir(folderPath)
    
    for (const entry of entries) {
      const fullPath = join(folderPath, entry)
      
      try {
        const stats = await stat(fullPath)
        
        // Only process files (not directories)
        if (stats.isFile()) {
          const ext = entry.substring(entry.lastIndexOf('.')).toLowerCase()
          
          // Only read text files
          if (textFileExtensions.includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8')
              notes.push(`### ${entry}\n\n${content}`)
              
              // Track file metadata
              metadata.push({
                name: entry,
                path: fullPath,
                mtime: stats.mtime
              })
            } catch (readError) {
              console.error(`Error reading file ${entry}:`, readError)
            }
          }
        }
      } catch (statError) {
        console.error(`Error getting stats for ${entry}:`, statError)
      }
    }
  } catch (error) {
    throw new Error(`Failed to read folder: ${error}`)
  }
  
  return { notes, metadata }
}

