// How nuet writes a time: Claude Code's own timeFormat and timeZone
// settings ("auto", "12-hour", "24-hour", "24-hour-utc" or a strftime
// pattern; an IANA zone, or null for the system's), the locale the times
// are written in (null for Intl's own default), and whether times carry
// seconds.
export type Clock = {
  format: string
  zone: string | null
  locale: string | null
  hasSeconds: boolean
}

// The time of a row that shows one: when Claude Code added it, and the time
// shown before it, if any, which tells whether a new day began between.
export type Stamp = {
  at: number
  previous: number | null
}

declare module 'claude-code' {
  interface PluginState {
    nuet: {
      // Each timed row's time, by the row's id; null for a row that shows none.
      stamps: StateFamily<Stamp | null>
      // When the last time shown was, to tell a new minute or day from the
      // same one.
      last: number | null
      clock: Clock
      // Whether nuet draws its times; /nuet off hides them for the session.
      isShown: boolean
    }
  }
}
