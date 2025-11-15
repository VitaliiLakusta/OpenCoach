import { readdir, stat } from 'fs/promises'
import { join } from 'path'

export async function POST(req: Request) {
  try {
    const { notesFolderPath } = await req.json()

    if (!notesFolderPath || typeof notesFolderPath !== 'string' || !notesFolderPath.trim()) {
      return Response.json({ ok: false, error: 'Notes folder path is required' }, { status: 400 })
    }

    const folderPath = notesFolderPath.trim()

    try {
      const entries = await readdir(folderPath)
      const spaces: Array<{ name: string; path: string }> = []

      // Filter for directories only
      for (const entry of entries) {
        const fullPath = join(folderPath, entry)

        try {
          const stats = await stat(fullPath)

          // Only include directories (not files)
          if (stats.isDirectory()) {
            // Skip hidden directories (starting with .)
            if (!entry.startsWith('.')) {
              spaces.push({
                name: entry,
                path: fullPath
              })
            }
          }
        } catch (statError) {
          console.error(`Error getting stats for ${entry}:`, statError)
          // Continue with other entries if one fails
        }
      }

      // Sort spaces alphabetically
      spaces.sort((a, b) => a.name.localeCompare(b.name))

      return Response.json({ ok: true, spaces })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return Response.json({ ok: false, error: `Failed to read directory: ${errorMessage}` }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in spaces API:', error)
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
