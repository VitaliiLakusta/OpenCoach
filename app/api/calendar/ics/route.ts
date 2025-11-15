import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const title = searchParams.get('title')
    const startDateTime = searchParams.get('startDateTime')
    const endDateTime = searchParams.get('endDateTime')
    const description = searchParams.get('description') || ''
    const location = searchParams.get('location') || ''
    const recurrence = searchParams.get('recurrence') || ''

    if (!title || !startDateTime) {
      return new NextResponse('Missing required parameters: title and startDateTime', { status: 400 })
    }

    // Parse dates
    const startDate = new Date(startDateTime)
    if (isNaN(startDate.getTime())) {
      return new NextResponse('Invalid startDateTime format', { status: 400 })
    }

    let endDate: Date
    if (endDateTime) {
      endDate = new Date(endDateTime)
      if (isNaN(endDate.getTime())) {
        return new NextResponse('Invalid endDateTime format', { status: 400 })
      }
    } else {
      // Default to 1 hour after start
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    }

    // Format dates for .ics file (YYYYMMDDTHHmmssZ)
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }

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
      // Remove "RRULE:" prefix if present
      const rrule = recurrence.startsWith('RRULE:') ? recurrence.substring(6) : recurrence
      icsContent.push(`RRULE:${rrule}`)
    }

    icsContent.push('END:VEVENT')
    icsContent.push('END:VCALENDAR')

    const icsFileContent = icsContent.join('\r\n')
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`

    return new NextResponse(icsFileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating .ics file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

