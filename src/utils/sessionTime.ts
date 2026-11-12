/**
 * When a session really starts and ends. The server stores the instants (starts_at / ends_at);
 * session_date + start_time are the Babalawo's own clock. Old rows without the instants are read
 * in Lagos time. Format the result with the viewer's own clock (date-fns `format` does).
 */
export interface SessionTimeFields {
  session_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

const lagos = (date: string, hhmm: string) => new Date(`${date}T${hhmm.slice(0, 5)}:00+01:00`);

export function sessionStart(s: SessionTimeFields): Date {
  if (s.starts_at) return new Date(s.starts_at);
  return lagos(String(s.session_date), String(s.start_time ?? '00:00'));
}

export function sessionEnd(s: SessionTimeFields): Date {
  if (s.ends_at) return new Date(s.ends_at);
  const start = sessionStart(s);
  if (!s.end_time) return new Date(start.getTime() + 3600e3);
  let end = lagos(String(s.session_date), String(s.end_time));
  if (end <= start) end = new Date(end.getTime() + 864e5);
  return end;
}

/** "2:30 pm" on the viewer's clock. */
export function clockLabel(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "2:30 pm - 3:30 pm" on the viewer's clock. */
export function sessionTimeRange(s: SessionTimeFields): string {
  return `${clockLabel(sessionStart(s))} - ${clockLabel(sessionEnd(s))}`;
}
