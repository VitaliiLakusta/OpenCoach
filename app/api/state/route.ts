import { readFile, writeFile } from 'fs/promises'
import fs from 'fs'
import { join } from 'path'

const STATE_PATH = join(process.cwd(), 'state.json')

type StateFile = {
  reminders?: Array<{
    dateTime: string
    reminderText: string
    completed?: boolean
  }>
  lastRun?: string
  lastContextMtimeMs?: number
  notesFolderPath?: string
  [key: string]: any
}

export async function GET() {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw = await readFile(STATE_PATH, 'utf-8')
    const state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error reading state:', error)
    return new Response(JSON.stringify({ error: 'Failed to read state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function POST(req: Request) {
  try {
    const updates = await req.json()

    // Load existing state
    let state: StateFile = {}
    if (fs.existsSync(STATE_PATH)) {
      try {
        const raw = await readFile(STATE_PATH, 'utf-8')
        state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}
      } catch (err) {
        console.error('Failed to read existing state:', err)
        state = {}
      }
    }

    // Merge updates into state
    state = { ...state, ...updates }

    // Write updated state
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error updating state:', error)
    return new Response(JSON.stringify({ ok: false, error: 'Failed to update state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
