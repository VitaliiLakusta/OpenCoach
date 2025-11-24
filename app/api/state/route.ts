import { readFile, writeFile } from 'fs/promises'
import fs from 'fs'
import { join } from 'path'

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const notesFolderPath = searchParams.get('notesFolderPath')

    if (!notesFolderPath) {
      return new Response(JSON.stringify({ error: 'notesFolderPath query parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const statePath = join(notesFolderPath, 'state.json')

    if (!fs.existsSync(statePath)) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const raw = await readFile(statePath, 'utf-8')
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
    const notesFolderPath = typeof updates?.notesFolderPath === 'string' ? updates.notesFolderPath.trim() : ''

    if (!notesFolderPath) {
      return new Response(JSON.stringify({ ok: false, error: 'notesFolderPath is required in body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const statePath = join(notesFolderPath, 'state.json')

    // Load existing state
    let state: StateFile = {}
    if (fs.existsSync(statePath)) {
      try {
        const raw = await readFile(statePath, 'utf-8')
        state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}
      } catch (err) {
        console.error('Failed to read existing state:', err)
        state = {}
      }
    }

    // Merge updates into state
    state = { ...state, ...updates }

    // Write updated state
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')

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
