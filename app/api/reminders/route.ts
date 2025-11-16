import { readFile, stat, writeFile } from 'fs/promises'
import fs from 'fs'
import { join } from 'path'

type RemindersPayload = {
  reminders: Array<{
    dateTime: string
    reminderText: string
  }>
}

type StateFile = {
  reminders?: Array<{
    dateTime: string
    reminderText: string
    completed?: boolean
  }>
  lastRun?: string
  lastContextMtimeMs?: number
  notesFolderPath?: string
  // Allow arbitrary extra fields without type errors
  [key: string]: any
}

function log(...args: any[]) {
  const timestamp = new Date().toISOString()
  console.log(`[RemindersAPI ${timestamp}]`, ...args)
}

const STATE_PATH = join(process.cwd(), 'state.json')

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const notesFolderPath = typeof body?.notesFolderPath === 'string' ? body.notesFolderPath.trim() : ''
    const openaiApiKey = typeof body?.openaiApiKey === 'string' ? body.openaiApiKey.trim() : ''

    if (!notesFolderPath) {
      log('Missing notesFolderPath in request body. Skipping.')
      return new Response(JSON.stringify({ ok: false, error: 'notesFolderPath is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const contextPath = join(notesFolderPath, 'CONTEXT.md')
    log('Checking CONTEXT.md at:', contextPath)

    let contextStats
    try {
      contextStats = await stat(contextPath)
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        log('CONTEXT.md not found at provided notes folder path. Skipping this run.')
        return new Response(
          JSON.stringify({ ok: true, skipped: 'no-context', contextPath }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      log('Error stating CONTEXT.md:', err)
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to access CONTEXT.md' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const currentMtimeMs = contextStats.mtimeMs

    // Load existing state.json if present
    let state: StateFile = {}
    if (fs.existsSync(STATE_PATH)) {
      try {
        const raw = await readFile(STATE_PATH, 'utf-8')
        state = raw.trim() ? (JSON.parse(raw) as StateFile) : {}
      } catch (err) {
        log('Failed to read/parse existing state.json, starting fresh:', err)
        state = {}
      }
    }

    if (typeof state.lastContextMtimeMs === 'number' && state.lastContextMtimeMs === currentMtimeMs) {
      log('CONTEXT.md unchanged since last run, skipping OpenAI call.')
      return new Response(
        JSON.stringify({ ok: true, skipped: 'unchanged', contextPath }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const contextContent = await readFile(contextPath, 'utf-8')
    log('CONTEXT.md changed, calling OpenAI to extract reminders...')

    const remindersPayload = await callOpenAIForReminders(contextContent, openaiApiKey)

    if (!remindersPayload) {
      log('OpenAI did not return a valid reminders payload. Skipping state update.')
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to extract reminders from CONTEXT.md' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const nowIso = new Date().toISOString()
    
    // Merge new reminders with existing ones, preserving completed status
    const existingReminders = state.reminders || []
    const existingRemindersMap = new Map<string, { dateTime: string; reminderText: string; completed?: boolean }>()
    
    // Create a map of existing reminders by dateTime
    for (const existing of existingReminders) {
      existingRemindersMap.set(existing.dateTime, existing)
    }
    
    // Merge: preserve completed reminders, update/add others
    const mergedReminders: Array<{ dateTime: string; reminderText: string; completed?: boolean }> = []
    
    // First, add all new reminders (or update existing non-completed ones)
    for (const newReminder of remindersPayload.reminders) {
      const existing = existingRemindersMap.get(newReminder.dateTime)
      if (existing && existing.completed === true) {
        // Keep the completed reminder as-is
        mergedReminders.push(existing)
        log(`Preserving completed reminder: "${existing.reminderText}" at ${existing.dateTime}`)
      } else {
        // Add new reminder or update existing non-completed one
        mergedReminders.push(newReminder)
      }
    }
    
    // Add any existing completed reminders that are not in the new list
    for (const existing of existingReminders) {
      if (existing.completed === true) {
        const stillExists = remindersPayload.reminders.some(r => r.dateTime === existing.dateTime)
        if (!stillExists) {
          // Keep completed reminders even if they're not in the new list
          mergedReminders.push(existing)
          log(`Preserving completed reminder not in new list: "${existing.reminderText}" at ${existing.dateTime}`)
        }
      }
    }
    
    const newState: StateFile = {
      ...state,
      reminders: mergedReminders,
      lastRun: nowIso,
      lastContextMtimeMs: currentMtimeMs,
      notesFolderPath: notesFolderPath,
    }

    await writeFile(STATE_PATH, JSON.stringify(newState, null, 2), 'utf-8')
    log('Updated state.json with new reminders and lastRun at', nowIso)

    return new Response(
      JSON.stringify({ ok: true, updated: true, lastRun: nowIso }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    log('Unexpected error in reminders API:', err)
    return new Response(JSON.stringify({ ok: false, error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function callOpenAIForReminders(contextText: string, apiKey: string): Promise<RemindersPayload | null> {
  // Use provided API key, fallback to environment variable
  const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!effectiveApiKey) {
    log('OPENAI_API_KEY is not provided in request or environment. Cannot call OpenAI.')
    return null
  }

  const systemPrompt = `
You are a strict JSON generator for OpenCoach.

Given the content of a CONTEXT.md file, you MUST extract a list of reminders.
Each reminder should include:
- "dateTime": ISO 8601 datetime string, e.g. "2025-11-16T09:00:00"
- "reminderText": short human-friendly reminder text

Output MUST be a single JSON object with this exact structure:
{
  "reminders": [
    {
      "dateTime": "2025-11-16T09:00:00",
      "reminderText": "Reflect on exercising"
    },
    {
      "dateTime": "2025-11-16T18:00:00",
      "reminderText": "Reflect in the evening"
    }
  ]
}

Do not include any extra fields. Do not include comments or explanations.
`

  const currentTimeISO = new Date().toISOString()
  const userPrompt = `
Current local time (ISO format): ${currentTimeISO}

Set the next reminder as early as possible after the current local time.

Here is the content of CONTEXT.md:

---
${contextText}
---

Extract reminders according to the required JSON schema. Use the current time provided above as a reference when interpreting relative times in the CONTEXT.md file.
`

  try {
    log('Calling OpenAI chat.completions for reminders extraction...')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      log('OpenAI API error:', response.status, response.statusText, errorText)
      return null
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content) {
      log('OpenAI response has no content.')
      return null
    }

    let parsed: RemindersPayload
    try {
      parsed = JSON.parse(content) as RemindersPayload
    } catch (err) {
      log('Failed to parse JSON from OpenAI response:', err)
      log('Raw content:', content)
      return null
    }

    if (!parsed || !Array.isArray(parsed.reminders)) {
      log('Parsed JSON does not have expected "reminders" array:', parsed)
      return null
    }

    log(`Extracted ${parsed.reminders.length} reminders from CONTEXT.md.`)
    return parsed
  } catch (err) {
    log('Error while calling OpenAI:', err)
    return null
  }
}


