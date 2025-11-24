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
  console.log(`[RemindersCheck ${timestamp}]`, ...args)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const notesFolderPath = searchParams.get('notesFolderPath')

    if (!notesFolderPath) {
      // If no notes folder is provided, we can't check for reminders
      return new Response(
        JSON.stringify({ ok: true, dueReminders: [], error: 'No notesFolderPath provided' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const statePath = join(notesFolderPath, 'state.json')

    // Load state.json
    let state: StateFile = {}
    if (fs.existsSync(statePath)) {
      try {
        const raw = await readFile(statePath, 'utf-8')
        state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}
      } catch (err) {
        log('Failed to read/parse state.json:', err)
        return new Response(
          JSON.stringify({ ok: false, error: 'Failed to read state.json' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }
    } else {
      log('state.json does not exist yet.')
      return new Response(
        JSON.stringify({ ok: true, dueReminders: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const reminders = state.reminders || []
    if (reminders.length === 0) {
      log('No reminders in state.json.')
      return new Response(
        JSON.stringify({ ok: true, dueReminders: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const now = new Date()
    const dueReminders: Array<{ dateTime: string; reminderText: string; completed?: boolean }> = []

    for (const reminder of reminders) {
      // Skip reminders that are already completed
      if (reminder.completed === true) {
        continue
      }

      try {
        const reminderTime = new Date(reminder.dateTime)
        if (reminderTime <= now) {
          log(`Found due reminder: "${reminder.reminderText}" at ${reminder.dateTime}`)
          dueReminders.push(reminder)
        }
      } catch (err) {
        log(`Error parsing reminder dateTime "${reminder.dateTime}":`, err)
      }
    }

    if (dueReminders.length > 0) {
      log(`Found ${dueReminders.length} due reminder(s).`)

      // Mark these reminders as completed immediately to prevent duplicate fires
      let markedAny = false
      for (const dueReminder of dueReminders) {
        const reminder = reminders.find(r => r.dateTime === dueReminder.dateTime)
        if (reminder && !reminder.completed) {
          reminder.completed = true
          markedAny = true
          log(`Marked reminder as completed: "${reminder.reminderText}" at ${reminder.dateTime}`)
        }
      }

      // Save state if we marked any reminders
      if (markedAny) {
        try {
          const updatedState: StateFile = {
            ...state,
            reminders,
          }
          await writeFile(statePath, JSON.stringify(updatedState, null, 2), 'utf-8')
          log('Updated state.json with completed reminders')
        } catch (err) {
          log('Failed to save state.json after marking reminders as completed:', err)
          // Continue anyway - we'll return the reminders
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, dueReminders, notesFolderPath: state.notesFolderPath }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    log('Unexpected error in reminders check API:', err)
    return new Response(JSON.stringify({ ok: false, error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

