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

function log(...args: any[]) {
  const timestamp = new Date().toISOString()
  console.log(`[RemindersComplete ${timestamp}]`, ...args)
}

const STATE_PATH = join(process.cwd(), 'state.json')

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const reminderDateTimes = Array.isArray(body?.reminderDateTimes) 
      ? body.reminderDateTimes 
      : typeof body?.reminderDateTime === 'string'
      ? [body.reminderDateTime]
      : []

    if (reminderDateTimes.length === 0) {
      log('Missing reminderDateTimes in request body.')
      return new Response(
        JSON.stringify({ ok: false, error: 'reminderDateTimes is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Load state.json
    let state: StateFile = {}
    if (fs.existsSync(STATE_PATH)) {
      try {
        const raw = await readFile(STATE_PATH, 'utf-8')
        state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}
      } catch (err) {
        log('Failed to read/parse state.json:', err)
        return new Response(
          JSON.stringify({ ok: false, error: 'Failed to read state.json' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }
    } else {
      log('state.json does not exist.')
      return new Response(
        JSON.stringify({ ok: false, error: 'state.json does not exist' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const reminders = state.reminders || []
    let markedCount = 0

    // Mark reminders as completed
    for (const reminder of reminders) {
      if (reminderDateTimes.includes(reminder.dateTime) && !reminder.completed) {
        reminder.completed = true
        markedCount++
        log(`Marked reminder as completed: "${reminder.reminderText}" at ${reminder.dateTime}`)
      }
    }

    if (markedCount === 0) {
      log('No reminders were marked as completed (they may already be completed or not found).')
      return new Response(
        JSON.stringify({ ok: true, markedCount: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Save updated state
    const updatedState: StateFile = {
      ...state,
      reminders,
    }

    await writeFile(STATE_PATH, JSON.stringify(updatedState, null, 2), 'utf-8')
    log(`Marked ${markedCount} reminder(s) as completed and updated state.json`)

    return new Response(
      JSON.stringify({ ok: true, markedCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    log('Unexpected error in reminders complete API:', err)
    return new Response(JSON.stringify({ ok: false, error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

