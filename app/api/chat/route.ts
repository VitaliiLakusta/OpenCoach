import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

// For bare minimum prototype, using OpenAI directly via Vercel AI SDK
// This will be replaced with Mastra agent integration later
export async function POST(req: Request) {
  try {
    const { messages, notesFolderPath } = await req.json()

    let notesContent = ''
    
    // If folder path is provided, read all notes from it
    if (notesFolderPath && typeof notesFolderPath === 'string' && notesFolderPath.trim()) {
      try {
        const notes = await readNotesFromFolder(notesFolderPath.trim())
        if (notes.length > 0) {
          notesContent = '\n\n## Notes from your folder:\n\n' + notes.join('\n\n---\n\n')
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
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Error in chat API:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

async function readNotesFromFolder(folderPath: string): Promise<string[]> {
  const notes: string[] = []
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
  
  return notes
}

