import ical from 'node-ical'
import { readFile } from 'fs/promises'

export interface CalendarEvent {
  uid: string
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  status?: string
  organizer?: string
  attendees?: string[]
  recurrenceRule?: string
  isRecurring: boolean
}

export interface CalendarInfo {
  totalEvents: number
  upcomingEvents: CalendarEvent[]
  todayEvents: CalendarEvent[]
  thisWeekEvents: CalendarEvent[]
  allEvents: CalendarEvent[]
}

/**
 * Fetches and parses an iCal calendar from a URL
 */
export async function parseICalFromUrl(url: string): Promise<CalendarInfo> {
  try {
    console.log('[Calendar] Fetching calendar from URL:', url)

    // Use fetch instead of node-ical's fromURL for better error handling and CORS support
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
      },
    })

    if (!response.ok) {
      // Provide specific guidance based on status code
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Access denied (HTTP ${response.status}). This is likely a private calendar URL that requires authentication. Please make your calendar public or use a public/shared calendar URL. For Google Calendar: Settings → Select your calendar → Access permissions → Make available publicly.`)
      } else if (response.status === 404) {
        throw new Error(`Calendar not found (HTTP ${response.status}). Please verify the URL is correct.`)
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const icsContent = await response.text()
    console.log('[Calendar] Successfully fetched calendar, parsing events...')

    const events = ical.parseICS(icsContent)
    const calendarInfo = parseCalendarEvents(events)

    console.log('[Calendar] Parsed calendar:', {
      totalEvents: calendarInfo.totalEvents,
      todayEvents: calendarInfo.todayEvents.length,
      thisWeekEvents: calendarInfo.thisWeekEvents.length,
    })

    return calendarInfo
  } catch (error) {
    console.error('[Calendar] Error fetching calendar:', error)
    throw new Error(`Failed to fetch or parse iCal from URL: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Parses an iCal calendar from a file path
 */
export async function parseICalFromFile(filePath: string): Promise<CalendarInfo> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const events = ical.parseICS(content)
    return parseCalendarEvents(events)
  } catch (error) {
    throw new Error(`Failed to parse iCal from file: ${error}`)
  }
}

/**
 * Parses calendar events and organizes them into different time categories
 */
function parseCalendarEvents(events: any): CalendarInfo {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const allEvents: CalendarEvent[] = []
  const upcomingEvents: CalendarEvent[] = []
  const todayEvents: CalendarEvent[] = []
  const thisWeekEvents: CalendarEvent[] = []

  for (const event of Object.values(events)) {
    if ((event as any).type !== 'VEVENT') continue

    const vevent = event as any

    // Skip events without start date
    if (!vevent.start) continue

    const calendarEvent: CalendarEvent = {
      uid: vevent.uid || '',
      summary: vevent.summary || 'Untitled Event',
      description: vevent.description,
      location: vevent.location,
      start: new Date(vevent.start),
      end: vevent.end ? new Date(vevent.end) : new Date(vevent.start),
      status: vevent.status,
      organizer: vevent.organizer?.val || vevent.organizer,
      attendees: vevent.attendee
        ? (Array.isArray(vevent.attendee)
            ? vevent.attendee.map((a: any) => a.val || a)
            : [vevent.attendee.val || vevent.attendee])
        : undefined,
      recurrenceRule: vevent.rrule?.toString(),
      isRecurring: !!vevent.rrule,
    }

    allEvents.push(calendarEvent)

    // Categorize events
    const eventStart = calendarEvent.start

    if (eventStart >= now) {
      upcomingEvents.push(calendarEvent)
    }

    if (eventStart >= today && eventStart < endOfToday) {
      todayEvents.push(calendarEvent)
    }

    if (eventStart >= today && eventStart < endOfWeek) {
      thisWeekEvents.push(calendarEvent)
    }
  }

  // Sort all arrays by start time
  const sortByStartTime = (a: CalendarEvent, b: CalendarEvent) =>
    a.start.getTime() - b.start.getTime()

  allEvents.sort(sortByStartTime)
  upcomingEvents.sort(sortByStartTime)
  todayEvents.sort(sortByStartTime)
  thisWeekEvents.sort(sortByStartTime)

  return {
    totalEvents: allEvents.length,
    upcomingEvents,
    todayEvents,
    thisWeekEvents,
    allEvents,
  }
}

/**
 * Formats calendar info into a human-readable summary
 */
export function formatCalendarSummary(info: CalendarInfo, maxEvents: number = 10): string {
  let summary = `# Calendar Summary\n\n`
  summary += `Total Events: ${info.totalEvents}\n`
  summary += `Events Today: ${info.todayEvents.length}\n`
  summary += `Events This Week: ${info.thisWeekEvents.length}\n`
  summary += `Upcoming Events: ${info.upcomingEvents.length}\n\n`

  if (info.todayEvents.length > 0) {
    summary += `## Today's Events\n\n`
    for (const event of info.todayEvents.slice(0, maxEvents)) {
      summary += formatEvent(event)
    }
  }

  if (info.thisWeekEvents.length > 0) {
    summary += `\n## This Week's Events\n\n`
    for (const event of info.thisWeekEvents.slice(0, maxEvents)) {
      summary += formatEvent(event)
    }
  }

  if (info.upcomingEvents.length > 0 && info.upcomingEvents.length > info.thisWeekEvents.length) {
    summary += `\n## Other Upcoming Events (next ${Math.min(maxEvents, info.upcomingEvents.length - info.thisWeekEvents.length)})\n\n`
    const otherUpcoming = info.upcomingEvents.filter(
      e => !info.thisWeekEvents.some(we => we.uid === e.uid)
    )
    for (const event of otherUpcoming.slice(0, maxEvents)) {
      summary += formatEvent(event)
    }
  }

  return summary
}

/**
 * Formats a single event into a readable string
 */
function formatEvent(event: CalendarEvent): string {
  const startStr = event.start.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let eventStr = `### ${event.summary}\n`
  eventStr += `- **Time:** ${startStr}\n`

  if (event.location) {
    eventStr += `- **Location:** ${event.location}\n`
  }

  if (event.description) {
    eventStr += `- **Description:** ${event.description}\n`
  }

  if (event.isRecurring) {
    eventStr += `- **Recurring:** Yes\n`
  }

  eventStr += '\n'

  return eventStr
}
