// What the test files share: Claude Code's side beneath nuet, the rows it
// adds to the conversation, and the message rows it asks nuet to draw.

import type { On, SessionAppendInput } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { ElementQuery, Engine, FoundElement } from 'claude-code/testing'

// 2026-10-10, 19:10:00 UTC: 21:10 in Copenhagen, a Saturday.
export const SAT_19_10 = Date.UTC(2026, 9, 10, 19, 10, 0)
export const MINUTE = 60_000

// Beneath nuet: a session that starts with these settings and this
// environment, a clock that moves only when the test moves it, and Claude
// Code's own drawing of a prompt and a reply, one line each. The settings
// object is the one nuet reads, so a test may change it, and after
// failSettings every read of it fails. The dim lines nuet logs into the
// transcript are returned.
export async function started($: Engine, on: On, options: { settings?: Record<string, unknown>; env?: Record<string, string>; now?: number } = {}) {
  const { settings = { timeZone: 'Europe/Copenhagen' }, env = {}, now = SAT_19_10 } = options
  const logged: string[] = []
  let isReadable = true
  const clock = mock.clock(on, { now })
  mock.env(on, env)
  on('settings.read', (_$, e, next) => (isReadable ? { value: settings } : next(e)))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('classic.SessionStart', () => ({}))
  on('ui.log', (_$, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  on('ui.render', { component: 'UserMessage' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)
    return <Text>{`❯ ${e.props.text}`}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, (beneath, e) => {
    const { Text } = beneath.ui.resolve(e)
    return <Text>{`● ${e.props.text}`}</Text>
  })
  await $.session.start({ cwd: '/home/demo/app', surface: 'terminal', isInteractive: true })
  const failSettings = () => {
    isReadable = false
  }
  return { clock, logged, settings, failSettings }
}

// Who sent a prompt: the person at the composer, unless a test names
// another sender.
type From = { origin?: SessionAppendInput['origin'] }

// The person's prompt, added to the conversation; or another sender's.
export const prompt = ($: Engine, uuid: string, text: string, { origin = { kind: 'composer' } }: From = {}) =>
  $.session.append({ door: 'prompt', origin, uuid, message: { type: 'user', role: 'user', content: [{ type: 'text', text }] } })

// A prompt typed while Claude was busy, which Claude Code delivers as a
// queued command; or what it queues the same way for another sender, such
// as a background task's notification.
export const queuedPrompt = ($: Engine, uuid: string, text: string, { origin = { kind: 'composer' } }: From = {}) =>
  $.session.append({
    door: 'delivery',
    origin,
    uuid,
    message: { type: 'attachment', name: 'queued_command', content: [{ type: 'text', text }] },
  })

// A reply block, added as the model streams it: text, a tool call, or only
// thinking; a subagent's, with its id.
export const reply = ($: Engine, uuid: string, text: string, { agentId }: { agentId?: string } = {}) =>
  $.session.append({
    door: 'response',
    origin: { kind: 'model', model: 'claude-haiku-5-5' },
    uuid,
    ...(agentId === undefined ? {} : { agentId }),
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text }] },
  })
export const toolCall = ($: Engine, uuid: string) =>
  $.session.append({
    door: 'response',
    origin: { kind: 'model', model: 'claude-haiku-5-5' },
    uuid,
    message: {
      type: 'assistant',
      role: 'assistant',
      content: [{ type: 'tool_use', id: `tool-${uuid}`, name: 'Read', input: { file_path: 'README.md' } }],
    },
  })

// A tool's result, which Claude Code adds as a user row.
export const toolResult = ($: Engine, uuid: string) =>
  $.session.append({
    door: 'tool-result',
    origin: { kind: 'tool', tool: 'Read' },
    uuid,
    message: { type: 'user', role: 'user', content: [{ type: 'tool_result', tool_use_id: `tool-${uuid}`, content: 'probe' }] },
  })

// A row Claude Code holds beneath nuet as it adds it, until the test lets
// it go: reached once nuet has timed it and handed it on.
export function holding(on: On, uuid: string) {
  let reached = () => {}
  let release = () => {}
  const isReached = new Promise<void>(resolve => {
    reached = resolve
  })
  const isReleased = new Promise<void>(resolve => {
    release = resolve
  })
  on('session.append', async (_$, e, next) => {
    if (e.uuid === uuid) {
      reached()
      await isReleased
    }
    return next(e)
  })
  return { isReached, release }
}

// A prompt's row and a reply's row as the transcript draws them, in a
// terminal `columns` wide; a prompt unfolded with ctrl+o.
export function promptRow($: Engine, uuid: string, text: string, { columns = 80, isExpanded = false } = {}) {
  return $.ui.mount({
    plugin: 'nuet',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: uuid,
    props: { text, origin: { kind: 'composer' }, isExpanded },
    viewport: { columns, rows: 40 },
  })
}
export function replyRow($: Engine, uuid: string, text: string, { columns = 80 } = {}) {
  return $.ui.mount({
    plugin: 'nuet',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: uuid,
    props: { text, isFirstOfReply: true },
    viewport: { columns, rows: 40 },
  })
}

// /nuet and what follows it, typed at the prompt.
export function nuet($: Engine, args = '') {
  return $.command.run({ command: 'nuet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
}

// The lines a mounted row draws, Claude Code's first.
export async function lines(ui: { findAll: (query: ElementQuery) => Promise<FoundElement[]> }): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map(text => text.text)
}

// The lines of a row drawn once, then taken down, so the same row can be
// drawn again another way.
export async function once(
  mounting: Promise<{ findAll: (query: ElementQuery) => Promise<FoundElement[]>; unmount: () => Promise<void> }>,
): Promise<string[]> {
  const ui = await mounting
  const drawn = await lines(ui)
  await ui.unmount()
  return drawn
}
