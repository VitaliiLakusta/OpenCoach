import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { readdir, readFile, stat, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { parseICalFromUrl, formatCalendarSummary } from '@/lib/calendar'

// For bare minimum prototype, using OpenAI directly via Vercel AI SDK
// This will be replaced with Mastra agent integration later
export async function POST(req: Request) {
  try {
    const { messages, notesFolderPath, calendarUrl } = await req.json()

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

    const result = await streamText({
      model: openai('gpt-5-mini'),
      messages,
      system: systemPrompt,
      temperature: 1, // GPT-5 models only support temperature: 1 (default), not 0
      maxSteps: 5, // Allow multiple tool calls and responses
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

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response('Internal Server Error', { status: 500 })
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

