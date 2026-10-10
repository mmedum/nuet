// Times as Claude Code writes its own clock, the "done 9:10 PM" on a turn's
// closing line: by its timeFormat and timeZone settings, in the locale.

// A string is measured by its code points, so it is spread into them here.
/* oxlint-disable typescript/no-misused-spread */

import type { Clock, Stamp } from '../types'

export const DEFAULT_CLOCK: Clock = { format: 'auto', zone: null, locale: null, hasSeconds: false }

// The time formats Claude Code writes through Intl, by their exact names.
const PRESETS = ['auto', '12-hour', '24-hour', '24-hour-utc']

// The clock's own settings, as Claude Code reads them; a value it couldn't
// use is left for its default.
export function clockOf(settings: Readonly<Record<string, unknown>>, locale: string | null, hasSeconds: boolean): Clock {
  const zone = typeof settings.timeZone === 'string' && isZone(settings.timeZone) ? settings.timeZone : null
  return { format: formatOf(settings.timeFormat), zone, locale, hasSeconds }
}

// A time format as Claude Code takes one: a preset by its name, else a
// strftime pattern, cleaned, or auto when no % is left in it.
function formatOf(value: unknown): string {
  if (typeof value !== 'string') {
    return 'auto'
  }
  if (PRESETS.includes(value)) {
    return value
  }
  const pattern = cleaned(value)
  return pattern.includes('%') ? pattern : 'auto'
}

function isZone(zone: string): boolean {
  try {
    formatter('zone', 'en-US', zone)
    return true
  } catch {
    return false
  }
}

// What Claude Code takes out of a strftime pattern, so the time stays one
// line: unpaired surrogates, terminal escape sequences, then control,
// format and invisible characters. It takes the last out in two passes, the
// second a superset of the first, so one pass with the superset does the same.
const UNPAIRED = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g
const ESCAPES =
  // oxlint-disable-next-line no-control-regex -- escape sequences start with one
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?(?:\u0007|\u001b\u005c|\u009c))|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}\u2028\u2029]/gu

function cleaned(pattern: string): string {
  return cut(pattern.replace(UNPAIRED, '').replace(ESCAPES, '').replace(INVISIBLE, ''))
}

// Claude Code keeps a strftime pattern, and what it writes, to 100 UTF-16
// units, with no half of a surrogate pair at the end.
const MOST = 100

function cut(text: string): string {
  if (text.length <= MOST) {
    return text
  }
  const kept = text.slice(0, MOST)
  const last = kept.charCodeAt(MOST - 1)

  return last >= 0xd800 && last <= 0xdbff ? kept.slice(0, -1) : kept
}

// The locale as Claude Code reads it from a POSIX environment: the first of
// LC_ALL, LC_TIME and LANG that is set, up to its . and its @ ("da_DK.UTF-8"
// is da-DK). Null for C, POSIX or none, or a tag Intl refuses: Intl then
// writes in its own default locale.
export function localeOf(...values: readonly (string | undefined)[]): string | null {
  const value = values.find(one => one !== undefined && one !== '')
  if (value === undefined || value === 'C' || value === 'POSIX') {
    return null
  }
  const tag = (value.split('.')[0] ?? '').split('@')[0]?.replaceAll('_', '-') ?? ''
  if (tag === '') {
    return null
  }
  try {
    formatter('zone', tag, undefined)
    return tag
  } catch {
    return null
  }
}

const TIME = { hour: 'numeric', minute: '2-digit' } as const
const SECONDS = { ...TIME, second: '2-digit' } as const

// What nuet asks Intl for, each by a fixed name: a time's fields for
// strftime and to tell days apart, as Claude Code reads them; a preset's
// time, with seconds or without, in its hour cycle (auto keeps the
// locale's); the date before a time; strftime's names; and none, to try a
// zone or a locale.
const OPTIONS = {
  fields: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  },
  auto: TIME,
  'auto seconds': SECONDS,
  '12-hour': { ...TIME, hourCycle: 'h12' },
  '12-hour seconds': { ...SECONDS, hourCycle: 'h12' },
  '24-hour': { ...TIME, hourCycle: 'h23' },
  '24-hour seconds': { ...SECONDS, hourCycle: 'h23' },
  date: { weekday: 'short', month: 'short', day: 'numeric', calendar: 'gregory' },
  a: { weekday: 'short', calendar: 'gregory' },
  A: { weekday: 'long', calendar: 'gregory' },
  b: { month: 'short', calendar: 'gregory' },
  B: { month: 'long', calendar: 'gregory' },
  zone: {},
} satisfies Record<string, Intl.DateTimeFormatOptions>

type Options = keyof typeof OPTIONS

// Each Intl formatter made once, by its options' name, locale and zone, as
// Claude Code keeps its own: every row writes its time again on each render.
// Undefined is the default locale, or the system's zone.
const formatters = new Map<Options, Map<string | undefined, Map<string | undefined, Intl.DateTimeFormat>>>()

function formatter(options: Options, locale: string | undefined, zone: string | undefined): Intl.DateTimeFormat {
  let byLocale = formatters.get(options)
  if (byLocale === undefined) {
    byLocale = new Map()
    formatters.set(options, byLocale)
  }
  let byZone = byLocale.get(locale)
  if (byZone === undefined) {
    byZone = new Map()
    byLocale.set(locale, byZone)
  }
  let made = byZone.get(zone)
  if (made === undefined) {
    made = new Intl.DateTimeFormat(locale, zone === undefined ? OPTIONS[options] : { ...OPTIONS[options], timeZone: zone })
    byZone.set(zone, made)
  }

  return made
}

// The time zone a clock writes in: UTC for "24-hour-utc", else its own.
function zoneOf(clock: Clock): string | undefined {
  return clock.format === '24-hour-utc' ? 'UTC' : (clock.zone ?? undefined)
}

function isPattern(format: string): boolean {
  return !PRESETS.includes(format) && format.includes('%')
}

function fieldsOf(at: number, zone: string | undefined): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  return Object.fromEntries(
    formatter('fields', 'en-US', zone)
      .formatToParts(at)
      .map(part => [part.type, part.value]),
  )
}

// A preset's options: "24-hour-utc" is "24-hour" in UTC.
function presetOptions(clock: Clock): Options {
  switch (clock.format) {
    case '12-hour':
      return clock.hasSeconds ? '12-hour seconds' : '12-hour'
    case '24-hour':
    case '24-hour-utc':
      return clock.hasSeconds ? '24-hour seconds' : '24-hour'
    default:
      return clock.hasSeconds ? 'auto seconds' : 'auto'
  }
}

// A preset written as Claude Code writes it: the locale's own form with
// only the hour cycle set, a Z after "24-hour-utc"'s minutes or seconds.
// ICU's narrow space before AM or PM becomes a plain one, as a terminal
// draws it.
function presetOf(at: number, clock: Clock): string {
  const made = formatter(presetOptions(clock), clock.locale ?? undefined, zoneOf(clock))
  if (clock.format !== '24-hour-utc') {
    return plain(made.format(at))
  }
  const parts = made.formatToParts(at)
  const zulu = parts.findLastIndex(part => part.type === 'minute' || part.type === 'second')

  return plain(parts.map((part, i) => (i === zulu ? `${part.value}Z` : part.value)).join(''))
}

function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, ' ')
}

// A time as the clock writes it.
export function timeOf(at: number, clock: Clock): string {
  return isPattern(clock.format) ? cut(strftime(clock.format, at, zoneOf(clock), clock.locale ?? undefined)) : presetOf(at, clock)
}

// A strftime field, with glibc's - before its name to drop the padding.
const FIELD = /%(-?)([\s\S])/g

const zero = (n: number, bare: boolean, width = 2) => (bare ? String(n) : String(n).padStart(width, '0'))
const space = (n: number, bare: boolean) => (bare ? String(n) : String(n).padStart(2, ' '))

// The fields Claude Code's strftime knows, written as it writes them, the
// names in the clock's locale; one it doesn't know is written as it is.
function strftime(pattern: string, at: number, zone: string | undefined, locale: string | undefined): string {
  const f = fieldsOf(at, zone)
  const year = Number(f.year)
  const month = Number(f.month)
  const day = Number(f.day)
  const hour = Number(f.hour)
  const minute = f.minute ?? ''
  const second = f.second ?? ''
  const hour12 = ((hour + 11) % 12) + 1
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const meridiem = hour < 12 ? 'AM' : 'PM'

  return pattern.replace(FIELD, (whole, flag: string, name: string) => {
    const bare = flag === '-'
    switch (name) {
      case 'Y':
        return String(year)
      case 'y':
        return zero(year % 100, bare)
      case 'C':
        return zero(Math.floor(year / 100), bare)
      case 'm':
        return zero(month, bare)
      case 'd':
        return zero(day, bare)
      case 'e':
        return space(day, bare)
      case 'j':
        return zero((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000 + 1, bare, 3)
      case 'u':
        return String(weekday === 0 ? 7 : weekday)
      case 'w':
        return String(weekday)
      case 'H':
        return zero(hour, bare)
      case 'k':
        return space(hour, bare)
      case 'I':
        return zero(hour12, bare)
      case 'l':
        return space(hour12, bare)
      case 'M':
        return zero(Number(minute), bare)
      case 'S':
        return zero(Number(second), bare)
      case 'p':
        return meridiem
      case 'P':
        return meridiem.toLowerCase()
      case 's':
        return String(Math.floor(at / 1000))
      case 'a':
        return formatter('a', locale, zone).format(at)
      case 'A':
        return formatter('A', locale, zone).format(at)
      case 'b':
      case 'h':
        return formatter('b', locale, zone).format(at)
      case 'B':
        return formatter('B', locale, zone).format(at)
      case 'Z':
        return f.timeZoneName ?? ''
      case 'z':
        return offsetOf(at, Date.UTC(year, month - 1, day, hour, Number(minute), Number(second)))
      case 'F':
        return `${year}-${zero(month, false)}-${zero(day, false)}`
      case 'D':
        return `${zero(month, false)}/${zero(day, false)}/${zero(year % 100, false)}`
      case 'T':
        return `${zero(hour, false)}:${minute}:${second}`
      case 'R':
        return `${zero(hour, false)}:${minute}`
      case 'r':
        return `${zero(hour12, false)}:${minute}:${second} ${meridiem}`
      case '%':
        return '%'
      default:
        return whole
    }
  })
}

// The zone's offset from UTC, as +0200: how far its wall clock is ahead.
function offsetOf(at: number, wall: number): string {
  const minutes = Math.round((wall - Math.floor(at / 1000) * 1000) / 60_000)
  const away = Math.abs(minutes)
  return `${minutes < 0 ? '-' : '+'}${zero(Math.floor(away / 60), false)}${zero(away % 60, false)}`
}

// Whether two times fall on the same day in the clock's zone.
export function isSameDay(one: number, other: number, clock: Clock): boolean {
  const a = fieldsOf(one, zoneOf(clock))
  const b = fieldsOf(other, zoneOf(clock))
  return a.year === b.year && a.month === b.month && a.day === b.day
}

// The strftime fields that change every day: the day of the month or of the
// year, the weekday by name or number, and the whole date.
const DAY_FIELDS = new Set(['a', 'A', 'd', 'D', 'e', 'F', 'j', 'u', 'w'])

// Whether a strftime time format already writes which day it is, so a date
// before it would say it twice.
function namesTheDay(format: string): boolean {
  return isPattern(format) && [...format.matchAll(FIELD)].some(([, , name]) => DAY_FIELDS.has(name ?? ''))
}

// A row's time as drawn: the time, and the time led by the date on the first
// time shown and on the first of each new day ("Sat, Oct 10 · 9:10 PM"), so
// every stretch of a long session can be placed; no dated form where no date
// is due. The date in the clock's locale; both in the clock now in force.
export function labelOf(stamp: Stamp, clock: Clock): { time: string; dated: string | null } {
  const time = timeOf(stamp.at, clock)
  if (namesTheDay(clock.format) || (stamp.previous !== null && isSameDay(stamp.previous, stamp.at, clock))) {
    return { time, dated: null }
  }
  const date = formatter('date', clock.locale ?? undefined, zoneOf(clock)).format(stamp.at)

  return { time, dated: `${plain(date)} · ${time}` }
}

// Marks drawn on the character before them, and the joiners and selectors
// that shape a character without a cell of their own.
const NO_CELL = /^(?:\p{Mn}|\p{Me}|[\u200b-\u200f]|[\ufe00-\ufe0f])$/u

// Characters a terminal draws two cells wide: Chinese, Japanese and Korean
// script, their punctuation and full-width forms, and emoji drawn as emoji.
const TWO_CELLS =
  /^[\p{Emoji_Presentation}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]$/u

function cellsOf(char: string): number {
  if (NO_CELL.test(char)) {
    return 0
  }

  return TWO_CELLS.test(char) ? 2 : 1
}

// How many cells a label takes on the terminal.
export function cells(text: string): number {
  return [...text].reduce((sum, char) => sum + cellsOf(char), 0)
}
