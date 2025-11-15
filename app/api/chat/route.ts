import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { readdir, readFile, stat, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'

// For bare minimum prototype, using OpenAI directly via Vercel AI SDK
// This will be replaced with Mastra agent integration later
export async function POST(req: Request) {
  try {
    const { messages, notesFolderPath } = await req.json()

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

    const systemPrompt = 'You are OpenCoach, an AI coaching assistant. Help the user with their goals and priorities.' + notesContent

    const result = await streamText({
      model: openai('gpt-3.5-turbo'),
      messages,
      system: systemPrompt,
      maxSteps: 5, // Allow multiple tool calls and responses
      tools: {
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
          description: 'Generate a Google Calendar link for creating a calendar event. Use this when the user asks to create a calendar reminder, event, or schedule something. The link can be clicked to add the event to their Google Calendar.',
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

              const startFormatted = formatGoogleDate(startDate)
              const endFormatted = formatGoogleDate(endDate)

              // Build URL parameters
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

              return {
                success: true,
                url: calendarUrl,
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

