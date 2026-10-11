// nuet puts a dim time over the blank line above each prompt and reply in
// the transcript: when Claude Code added the row, written the way its own
// clock writes a turn's "done 9:10 PM".

import type { EngineInterface, Register, RenderElement, RenderInput, SessionAppendInput } from 'claude-code'
import { atom, memberOf, read, update } from 'claude-code'
import type { Clock, Stamp } from '../types'
import { DEFAULT_CLOCK, cells, clockOf, isSameDay, labelOf, localeOf, timeOf } from './clock'
import { colorOf } from './paint'

const stamps = atom({ plugin: 'nuet', key: 'stamps' } as const, null)
const last = atom({ plugin: 'nuet', key: 'last' } as const, null)
const clock = atom({ plugin: 'nuet', key: 'clock' } as const, DEFAULT_CLOCK)
const isShown = atom({ plugin: 'nuet', key: 'isShown' } as const, true)

// Whether the person last asked for the times on or off, for state that
// starts over at /clear; the Seconds option; and the Time color option, by
// default Claude Code's own color for hints and timestamps.
let isShownNow = true
let hasSeconds = false
let timeColor = 'inactive'

// What /nuet answers, from what was asked and whether the times showed.
// Claude Code puts "nuet: " before it.
function answerTo(asked: string, was: boolean): string {
  switch (asked) {
    case '':
      return was
        ? "on. The times above your prompts and Claude's replies are nuet's. /nuet off hides them."
        : 'off for this session. /nuet on shows its times again.'
    case 'on':
      return was ? 'already on. /nuet off hides its times.' : 'on: its times show again. /nuet off hides them.'
    case 'off':
      return was ? 'off for this session: its times are hidden. /nuet on shows them again.' : 'already off. /nuet on shows its times again.'
    default:
      return "/nuet takes on or off, or nothing to say whether it's on. To turn nuet off for good: claude plugin disable nuet@nuet"
  }
}

// The rows drawn as messages: the person's prompt, typed at the prompt or
// while Claude was busy (Claude Code delivers that one as a queued command),
// and a reply that says something (not one that only thinks or calls a tool).
function isPrompt(e: SessionAppendInput): boolean {
  if (!isPersons(e.origin)) {
    return false
  }
  if (e.message.type === 'attachment') {
    return e.message.name === 'queued_command'
  }

  return e.message.type === 'user' && e.door === 'prompt' && e.message.isMeta !== true
}
function isReply(e: SessionAppendInput): boolean {
  return e.message.type === 'assistant' && e.door === 'response' && e.message.content.some(block => block.type === 'text')
}

// The locale every format is written in, read when the session starts or starts over:
// the environment doesn't change under it.
async function readLocale($: EngineInterface) {
  const locale = localeOf(await $.env.get('LC_ALL'), await $.env.get('LC_TIME'), await $.env.get('LANG'))
  await update($, clock, now => ({ ...now, locale }))
}

// Claude Code's own time settings, written only when they changed, so the
// times already drawn redraw only then. A read that fails keeps the ones
// last read.
async function readSettings($: EngineInterface) {
  const settings = await $.settings.read().catch(() => null)
  const was = await read($, clock)
  const fresh = settings === null ? { ...was, hasSeconds } : clockOf(settings, was.locale, hasSeconds)
  if (fresh.format !== was.format || fresh.zone !== was.zone || fresh.hasSeconds !== was.hasSeconds) {
    await update($, clock, now => ({ ...now, format: fresh.format, zone: fresh.zone, hasSeconds: fresh.hasSeconds }))
  }
}

// Whether a prompt is the person's own words, as Claude Code's origins say
// so: typed, sent through Remote Control or from Slack, or sent by a plugin
// as theirs. Claude Code queues a background task's notification, another
// session's or a channel's message, and a schedule's prompt the same way.
function isPersons(origin: SessionAppendInput['origin']): boolean {
  switch (origin.kind) {
    case 'composer':
    case 'bridge':
    case 'slack-ping':
      return true
    case 'plugin':
      return 'asUser' in origin && origin.asUser
    default:
      return false
  }
}

// Whether a reply's time is news after the last time shown: later, and
// reading differently or on another day. A reply that finishes after a
// later row has had its time shown is not.
function isNew(before: number | null, at: number, now: Clock): boolean {
  return before === null || (at > before && (!isSameDay(before, at, now) || timeOf(before, now) !== timeOf(at, now)))
}

// The part of a row's id that a stamp is kept under. Claude Code draws a
// message under its id, or, seen with typed prompts and with replies that
// think first, one row per part under the id with its last twelve digits
// replaced by the part's number (`…000000000000` the first); a queued prompt
// kept its full id. The first twenty digits are the same either way, and
// unique in practice.
const rowKey = (id: string) => id.slice(0, 23)

// Whether a row is a later part of a message drawn in parts, which shows no
// time: the first part, or a row under the full id, shows the message's.
const isLaterPart = (id: string) => /^-0{9}[0-9a-f]{3}$/.test(id.slice(23)) && !id.endsWith('-000000000000')

// A message row as Claude Code drew it and, over the blank line it leaves
// above the message, the row's time at its end; the time without its date
// when there is no room for both, and the row alone when it shows no time
// or has no room even for the time.
async function withTime($: EngineInterface, e: RenderInput<'UserMessage' | 'AssistantMessage'>, drawn: RenderElement): Promise<RenderElement> {
  const stamp = await read($, memberOf(stamps, { requestId: rowKey(e.requestId) }))
  if (stamp === null || isLaterPart(e.requestId) || !(await read($, isShown))) {
    return drawn
  }
  const { time, dated } = labelOf(stamp, await read($, clock))
  const columns = e.viewport?.columns ?? 80
  const label = (dated === null ? [time] : [dated, time]).find(one => cells(one) < columns)
  if (label === undefined) {
    return drawn
  }

  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {drawn}
      <Box position="absolute" top={0} left={columns - cells(label)}>
        <Text color={timeColor}>{label}</Text>
      </Box>
    </Box>
  )
}

export const register: Register = (on, options) => {
  hasSeconds = options.seconds === true
  timeColor = colorOf(options.timeColor, 'inactive')

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'nuet',
      description: "Show whether nuet's times are on, or turn them on or off for this session",
      argumentHint: '[on|off]',
      immediate: true,
    })
    await readLocale($)
    return next(e)
  })

  // /nuet says whether nuet is on; /nuet on and /nuet off switch it,
  // and say how it stands after. The answer is a dim line Claude doesn't read.
  on('command.run', { command: 'nuet' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase()
    const was = await read($, isShown)
    if (asked === 'on' || asked === 'off') {
      isShownNow = asked === 'on'
      await update($, isShown, () => isShownNow)
    }
    $.ui.log(answerTo(asked, was))
    return {}
  })

  // /clear, /resume and /branch put nuet's state back to how it starts:
  // the person's switch outlives them, and the locale is read again.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, isShown, () => isShownNow)
    await readLocale($)
    return next(e)
  })

  // Each prompt and reply of the main conversation is timed as Claude Code
  // adds it, and the row passes on unchanged before the rest is worked out.
  // A prompt always shows its time; a reply only when it reads differently
  // from the last time shown, a new minute or a new day. The settings are
  // read again first: Claude Code takes a changed one in only after its hooks
  // on the change have run, and every time drawn follows it. The last time
  // shown is weighed and moved in one write, so rows added at once each see
  // the one before, and it never moves back.
  on('session.append', async ($, e, next) => {
    const isTimed = e.agentId === undefined && (isPrompt(e) || isReply(e))
    const at = isTimed ? await $.clock.now() : 0
    const added = await next(e)
    if (isTimed) {
      await readSettings($)
      const now = await read($, clock)
      let stamp = null as Stamp | null
      await update($, last, before => {
        stamp = isPrompt(e) || isNew(before, at, now) ? { at, previous: before } : null
        return stamp === null ? before : Math.max(before ?? at, at)
      })
      // The row's id is the requestId it is drawn with (see rowKey).
      if (stamp !== null) {
        await update($, memberOf(stamps, { requestId: rowKey(e.uuid) }), () => stamp)
      }
    }

    return added
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => withTime($, e, await next(e)))
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => withTime($, e, await next(e)))
}
