import type { CalendarEvent, TimeRange } from '@daybrief/core';
import {
  formEncode,
  isRecord,
  listAllPages,
  ok,
  str,
  type ConnectorDeps,
  type GoogleResult,
  type Json,
} from '../google/http';

const API = 'https://www.googleapis.com/calendar/v3';
const API_NAME = 'Calendar API';

// Partial responses (https://developers.google.com/workspace/calendar/api/guides/performance):
// descriptions, attendee emails and attachments never leave Google. Only `self` and
// `responseStatus` of attendees are read, to drop events the user declined.
const CALENDAR_LIST_FIELDS = 'nextPageToken,items(id,summary,summaryOverride,primary,selected)';
const EVENT_FIELDS =
  'nextPageToken,items(id,status,eventType,summary,start,end,htmlLink,hangoutLink,location,' +
  'conferenceData/entryPoints(entryPointType,uri),attendees(self,responseStatus))';

export type SelectedCalendar = { id: string; title: string; primary: boolean };

/** Calendars shown in the user's Google Calendar UI (`selected: true`, M1 decisions). */
export async function listSelectedCalendars(
  accessToken: string,
  deps: ConnectorDeps,
): Promise<GoogleResult<SelectedCalendar[]>> {
  const items = await listAllPages(
    API_NAME,
    (pageToken) =>
      `${API}/users/me/calendarList?${formEncode({ maxResults: 250, fields: CALENDAR_LIST_FIELDS, pageToken })}`,
    accessToken,
    deps,
  );
  if (!items.ok) return items;
  return ok(
    items.value.flatMap((item) => {
      const id = str(item.id);
      if (!id || item.selected !== true) return [];
      return [
        {
          id,
          title: str(item.summaryOverride) ?? str(item.summary) ?? id,
          primary: item.primary === true,
        },
      ];
    }),
  );
}

/**
 * Events of one calendar overlapping `range`, recurring ones expanded into instances
 * (`singleEvents=true`), ordered by start. Cancelled and declined events are dropped.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  range: TimeRange,
  deps: ConnectorDeps,
): Promise<GoogleResult<CalendarEvent[]>> {
  const items = await listAllPages(
    API_NAME,
    (pageToken) =>
      `${API}/calendars/${encodeURIComponent(calendarId)}/events?${formEncode({
        timeMin: range.start,
        timeMax: range.end,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        fields: EVENT_FIELDS,
        pageToken,
      })}`,
    accessToken,
    deps,
  );
  if (!items.ok) return items;
  return ok(items.value.flatMap((item) => toCalendarEvent(item, calendarId) ?? []));
}

/** Google event resource → dashboard event, or null if it shouldn't be shown. */
export function toCalendarEvent(item: Json, calendarId: string): CalendarEvent | null {
  const id = str(item.id);
  if (!id || item.status === 'cancelled') return null;
  // Working location is a status marker, not something on the timeline.
  if (item.eventType === 'workingLocation') return null;
  const attendees = Array.isArray(item.attendees) ? item.attendees.filter(isRecord) : [];
  if (attendees.some((a) => a.self === true && a.responseStatus === 'declined')) return null;

  const start = isRecord(item.start) ? item.start : {};
  const end = isRecord(item.end) ? item.end : {};
  const base = {
    id,
    calendarId,
    title: str(item.summary) ?? '',
    videoUrl: videoUrl(item),
    htmlLink: str(item.htmlLink) ?? null,
  };

  const startDateTime = str(start.dateTime);
  if (startDateTime) {
    const startMs = Date.parse(startDateTime);
    const endMs = Date.parse(str(end.dateTime) ?? startDateTime);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
    return {
      ...base,
      allDay: false,
      start: new Date(startMs).toISOString(),
      end: new Date(Math.max(startMs, endMs)).toISOString(),
    };
  }
  const startDate = str(start.date);
  if (startDate)
    return { ...base, allDay: true, start: startDate, end: str(end.date) ?? startDate };
  return null;
}

const VIDEO_HOSTS = [
  /(^|\.)zoom\.us$/,
  /^meet\.google\.com$/,
  /(^|\.)teams\.microsoft\.com$/,
  /^teams\.live\.com$/,
];

/** `hangoutLink`, else a video entry point of `conferenceData`, else the first Zoom/Meet/Teams URL in `location`. */
export function videoUrl(item: Json): string | null {
  const hangoutLink = str(item.hangoutLink);
  if (hangoutLink) return hangoutLink;

  const entryPoints =
    isRecord(item.conferenceData) && Array.isArray(item.conferenceData.entryPoints)
      ? item.conferenceData.entryPoints.filter(isRecord)
      : [];
  const video = entryPoints.find(
    (p) => p.entryPointType === 'video' && str(p.uri)?.startsWith('https://'),
  );
  if (video) return str(video.uri) ?? null;

  for (const match of (str(item.location) ?? '').matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[.,;:!?)\]]+$/, '');
    const host = /^https?:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase();
    if (host && VIDEO_HOSTS.some((re) => re.test(host))) return url;
  }
  return null;
}
