import { describe, expect, test } from 'claude-code/testing'
import { MINUTE, SAT_19_10, holding, lines, once, prompt, promptRow, queuedPrompt, reply, replyRow, started, toolCall, toolResult } from './kit'

describe('times', () => {
  test('times a prompt and a reply as Claude Code adds them', async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'Which file sets the retries?')
    await clock.advance(2 * MINUTE + 30_000)
    await reply($, 'r1', 'src/config.ts does.')

    expect(await lines(await promptRow($, 'p1', 'Which file sets the retries?'))).toEqual(['❯ Which file sets the retries?', 'Sat, Oct 10 · 9:10 PM'])
    expect(await lines(await replyRow($, 'r1', 'src/config.ts does.'))).toEqual(['● src/config.ts does.', '9:12 PM'])
  })

  test('shows a reply its time only when it reads differently from the last time shown, and every prompt its own', async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'one')
    await clock.advance(40_000)
    await reply($, 'r1', 'same minute')
    await clock.advance(30_000)
    await reply($, 'r2', 'a minute on')
    await prompt($, 'p2', 'same minute as the reply')

    expect(await lines(await replyRow($, 'r1', 'same minute'))).toEqual(['● same minute'])
    expect(await lines(await replyRow($, 'r2', 'a minute on'))).toEqual(['● a minute on', '9:11 PM'])
    expect(await lines(await promptRow($, 'p2', 'same minute as the reply'))).toEqual(['❯ same minute as the reply', '9:11 PM'])
  })

  test("times no reply that only calls a tool, no tool's result and none of a subagent", async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'go')
    await clock.advance(MINUTE)
    await toolCall($, 't1')
    await toolResult($, 't1')
    await reply($, 'a1', 'a subagent says', { agentId: 'agent-1' })
    await clock.advance(10_000)
    await reply($, 'r1', 'done')

    expect(await lines(await replyRow($, 'a1', 'a subagent says'))).toEqual(['● a subagent says'])
    expect(await lines(await replyRow($, 'r1', 'done'))).toEqual(['● done', '9:11 PM'])
  })

  test('puts the date before the first time shown and the first time of each new day', async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'late')
    // 21:10 to 08:00 the next morning in Copenhagen.
    await clock.advance(10 * 60 * MINUTE + 50 * MINUTE)
    await prompt($, 'p2', 'early')
    await clock.advance(MINUTE)
    await prompt($, 'p3', 'later')

    expect(await lines(await promptRow($, 'p1', 'late'))).toEqual(['❯ late', 'Sat, Oct 10 · 9:10 PM'])
    expect(await lines(await promptRow($, 'p2', 'early'))).toEqual(['❯ early', 'Sun, Oct 11 · 8:00 AM'])
    expect(await lines(await promptRow($, 'p3', 'later'))).toEqual(['❯ later', '8:01 AM'])
  })

  test('leaves a row it has no time for as Claude Code draws it', async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    expect(await once(promptRow($, 'p0', 'from before nuet'))).toEqual(['❯ from before nuet'])
  })

  test('drops the date before the time when only the time fits', async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    // "Sat, Oct 10 · 9:10 PM" takes 21 cells.
    expect(await once(promptRow($, 'p1', 'hi', { columns: 21 }))).toEqual(['❯ hi', '9:10 PM'])
    expect(await once(promptRow($, 'p1', 'hi', { columns: 22 }))).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
  })

  test('leaves a row too narrow even for its time as Claude Code draws it', async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    // "9:10 PM" takes 7 cells.
    expect(await once(promptRow($, 'p1', 'hi', { columns: 7 }))).toEqual(['❯ hi'])
    expect(await once(promptRow($, 'p1', 'hi', { columns: 8 }))).toEqual(['❯ hi', '9:10 PM'])
  })

  test('times a prompt unfolded with ctrl+o or --verbose too', async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    expect(await lines(await promptRow($, 'p1', 'hi', { isExpanded: true }))).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
  })

  test('times a prompt typed while Claude was busy', async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'run the tests')
    await clock.advance(MINUTE)
    await queuedPrompt($, 'q1', 'and then the linter')

    expect(await lines(await promptRow($, 'q1', 'and then the linter'))).toEqual(['❯ and then the linter', '9:11 PM'])
  })

  test("times the person's own prompt sent from elsewhere, typed or queued", async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'run the tests')
    await clock.advance(MINUTE)
    // Through Remote Control, from Slack, and by a plugin as their own words.
    const theirs = [{ kind: 'bridge' }, { kind: 'slack-ping' }, { kind: 'plugin', name: 'other', asUser: true }] as const
    for (const origin of theirs) {
      await queuedPrompt($, `queued ${origin.kind}`, 'and then the linter', { origin })
      await prompt($, `typed ${origin.kind}`, 'and then the linter', { origin })
    }

    for (const origin of theirs) {
      expect(await once(promptRow($, `queued ${origin.kind}`, 'and then the linter'))).toEqual(['❯ and then the linter', '9:11 PM'])
      expect(await once(promptRow($, `typed ${origin.kind}`, 'and then the linter'))).toEqual(['❯ and then the linter', '9:11 PM'])
    }
  })

  test("times no notification or other sender's message as the person's prompt, typed or queued", async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'run the tests')
    await clock.advance(MINUTE)
    const others = [
      { kind: 'task-notification' },
      { kind: 'peer' },
      { kind: 'channel', server: 'chat' },
      { kind: 'scheduled-trigger' },
      { kind: 'unclassified' },
      { kind: 'plugin', name: 'other' },
    ] as const
    for (const origin of others) {
      await queuedPrompt($, `queued ${origin.kind}`, 'from elsewhere', { origin })
      await prompt($, `typed ${origin.kind}`, 'from elsewhere', { origin })
    }
    await reply($, 'r1', 'the tests pass')

    for (const origin of others) {
      expect(await once(promptRow($, `queued ${origin.kind}`, 'from elsewhere'))).toEqual(['❯ from elsewhere'])
      expect(await once(promptRow($, `typed ${origin.kind}`, 'from elsewhere'))).toEqual(['❯ from elsewhere'])
    }
    // None of them was the last time shown, so the reply in the next minute
    // shows its own.
    expect(await lines(await replyRow($, 'r1', 'the tests pass'))).toEqual(['● the tests pass', '9:11 PM'])
  })

  test('shows a reply its time and date on a new day, though the time reads the same', async ($, on) => {
    const { clock } = await started($, on, { settings: { timeFormat: '24-hour', timeZone: 'Europe/Copenhagen' } })
    await prompt($, 'p1', 'start the backup')
    await clock.advance(24 * 60 * MINUTE)
    await reply($, 'r1', 'the backup finished')

    expect(await lines(await replyRow($, 'r1', 'the backup finished'))).toEqual(['● the backup finished', 'Sun, Oct 11 · 21:10'])
  })

  test('weighs replies added at once one after the other', async ($, on) => {
    const { clock } = await started($, on)
    await prompt($, 'p1', 'go')
    await clock.advance(MINUTE)
    await Promise.all([reply($, 'r1', 'one'), reply($, 'r2', 'two')])

    expect(await lines(await replyRow($, 'r1', 'one'))).toEqual(['● one', '9:11 PM'])
    expect(await lines(await replyRow($, 'r2', 'two'))).toEqual(['● two'])
  })

  test('shows no time for a reply that finishes after a later one', async ($, on) => {
    const { isReached, release } = holding(on, 'r1')
    const { clock } = await started($, on)
    await prompt($, 'p1', 'go')
    const early = reply($, 'r1', 'early')
    await isReached
    await clock.advance(MINUTE)
    await reply($, 'r2', 'later')
    release()
    await early

    // The early reply came in the same minute as the prompt, which shows it.
    expect(await lines(await replyRow($, 'r1', 'early'))).toEqual(['● early'])
    expect(await lines(await replyRow($, 'r2', 'later'))).toEqual(['● later', '9:11 PM'])
  })

  test('keeps a later time as the last shown when a prompt finishes after it', async ($, on) => {
    const { isReached, release } = holding(on, 'p2')
    const { clock } = await started($, on)
    await prompt($, 'p1', 'go')
    const early = prompt($, 'p2', 'and the docs')
    await isReached
    await clock.advance(MINUTE)
    await reply($, 'r1', 'later')
    release()
    await early
    await reply($, 'r2', 'same minute as the later one')

    // A prompt always shows its time.
    expect(await lines(await promptRow($, 'p2', 'and the docs'))).toEqual(['❯ and the docs', '9:10 PM'])
    expect(await lines(await replyRow($, 'r2', 'same minute as the later one'))).toEqual(['● same minute as the later one'])
  })

  test('decides whether a reply shows its time in the time format in force', async ($, on) => {
    const { settings, clock } = await started($, on, { settings: { timeFormat: '12-hour', timeZone: 'Europe/Copenhagen' } })
    await prompt($, 'p1', 'hi')
    settings.timeFormat = '24-hour'
    await clock.advance(20_000)
    await reply($, 'r1', 'same minute')

    expect(await lines(await promptRow($, 'p1', 'hi'))).toEqual(['❯ hi', 'Sat, Oct 10 · 21:10'])
    expect(await lines(await replyRow($, 'r1', 'same minute'))).toEqual(['● same minute'])
  })

  test('measures an accent mark as no cell of its own', async ($, on) => {
    const { clock } = await started($, on, { env: { LANG: 'hi_IN.UTF-8' } })
    await prompt($, 'p1', 'late')
    await clock.advance(10 * 60 * MINUTE + 50 * MINUTE)
    await prompt($, 'p2', 'early')

    // "रवि, 11 अक्टू॰ · 8:00 am" takes 22 cells in 24 code points: it fits 23
    // columns, though its code points would not.
    expect(await once(promptRow($, 'p2', 'early', { columns: 23 }))).toEqual(['❯ early', 'रवि, 11 अक्टू॰ · 8:00 am'])
  })
})

describe('time formats', () => {
  test("writes times as Claude Code's own clock does for each time format", async ($, on) => {
    const { settings } = await started($, on)
    // The first time shown carries the date; the ones after it don't.
    await prompt($, 'p0', 'first')
    const formats: [string, string][] = [
      ['12-hour', '9:10 PM'],
      ['24-hour', '21:10'],
      ['24-hour-utc', '19:10Z'],
      ['%a %H.%M.%S', 'Sat 21.10.00'],
      ['%I:%M %p %Z %% %q', '09:10 PM GMT+2 % %q'],
      ['%A %d %b %B %e %k %l %m %y %Y', 'Saturday 10 Oct October 10 21  9 10 26 2026'],
      ['%F %D %T %R', '2026-10-10 10/10/26 21:10:00 21:10'],
      ['%r %P', '09:10:00 PM pm'],
      ['%j %u %w %h %C', '283 6 6 Oct 20'],
      ['%s %z', '1791659400 +0200'],
    ]
    for (const [format, expected] of formats) {
      settings.timeFormat = format
      await prompt($, format, 'hi')

      expect(await lines(await promptRow($, format, 'hi'))).toEqual(['❯ hi', expected])
    }
  })

  test('drops the padding of a strftime field written with %-, as glibc does', async ($, on) => {
    // 2026-01-04, 08:05:03 UTC.
    const { settings } = await started($, on, { settings: { timeZone: 'UTC' }, now: Date.UTC(2026, 0, 4, 8, 5, 3) })
    await prompt($, 'p0', 'first')
    const formats: [string, string][] = [
      ['%-I:%M %p', '8:05 AM'],
      ['%-d/%-m/%-y %-H:%-M:%-S', '4/1/26 8:5:3'],
      ['%-e|%-k|%-l', '4|8|8'],
      ['%j %-j', '004 4'],
      // As Claude Code writes them: whole dates and times keep their padding,
      // and a field it doesn't know keeps its -.
      ['%-F %-T %-%', '2026-01-04 08:05:03 %'],
      ['%-q', '%-q'],
    ]
    for (const [format, expected] of formats) {
      settings.timeFormat = format
      await prompt($, format, 'hi')

      expect(await lines(await promptRow($, format, 'hi'))).toEqual(['❯ hi', expected])
    }
  })

  test("writes %z as the time zone's offset from UTC", async ($, on) => {
    const { settings } = await started($, on, { settings: { timeFormat: '%A %z' } })
    const zones: [string, string][] = [
      ['America/New_York', 'Saturday -0400'],
      ['Asia/Kolkata', 'Sunday +0530'],
      ['UTC', 'Saturday +0000'],
    ]
    for (const [zone, expected] of zones) {
      settings.timeZone = zone
      await prompt($, zone, 'hi')

      expect(await lines(await promptRow($, zone, 'hi'))).toEqual(['❯ hi', expected])
    }
  })

  test('counts Sunday as 7 for %u and as 0 for %w', async ($, on) => {
    const { clock } = await started($, on, { settings: { timeFormat: '%a %u %w', timeZone: 'Europe/Copenhagen' } })
    await clock.advance(24 * 60 * MINUTE)
    await prompt($, 'p1', 'hi')

    expect(await lines(await promptRow($, 'p1', 'hi'))).toEqual(['❯ hi', 'Sun 7 0'])
  })

  test('writes the names of days and months in the locale', async ($, on) => {
    await started($, on, { settings: { timeFormat: '%a %A %b %h %B', timeZone: 'Europe/Copenhagen' }, env: { LANG: 'da_DK.UTF-8' } })
    await prompt($, 'p1', 'hej')

    expect(await lines(await promptRow($, 'p1', 'hej'))).toEqual(['❯ hej', 'lør. lørdag okt. okt. oktober'])
  })

  test('writes 12-hour and 24-hour times in the locale, as Claude Code does, setting only the hour cycle', async ($, on) => {
    const { settings } = await started($, on, { env: { LANG: 'da_DK.UTF-8' } })
    await prompt($, 'p0', 'først')
    const formats: [string, string][] = [
      ['12-hour', '9.10 PM'],
      ['24-hour', '21.10'],
      ['24-hour-utc', '19.10Z'],
    ]
    for (const [format, expected] of formats) {
      settings.timeFormat = format
      await prompt($, format, 'hej')

      expect(await lines(await promptRow($, format, 'hej'))).toEqual(['❯ hej', expected])
    }
  })

  test('puts the date before a strftime time that names no day', async ($, on) => {
    await started($, on, { settings: { timeFormat: '%H:%M', timeZone: 'Europe/Copenhagen' }, env: { LANG: 'da_DK.UTF-8' } })
    await prompt($, 'p1', 'hej')

    expect(await lines(await promptRow($, 'p1', 'hej'))).toEqual(['❯ hej', 'lør. 10. okt. · 21:10'])
  })

  test('writes dates and month names by the Gregorian calendar in a locale that keeps another', async ($, on) => {
    const { settings } = await started($, on, { settings: { timeFormat: '24-hour', timeZone: 'Europe/Copenhagen' }, env: { LANG: 'fa_IR.UTF-8' } })
    await prompt($, 'p1', 'سلام')
    const dated = await once(promptRow($, 'p1', 'سلام'))
    settings.timeFormat = '%B %H:%M'
    await prompt($, 'p2', 'سلام')

    // Saturday, 10 October, where the Persian calendar's own would be 18 Mehr.
    expect(dated).toEqual(['❯ سلام', 'شنبه ۱۰ اکتبر · ۲۱:۱۰'])
    expect(await lines(await promptRow($, 'p2', 'سلام'))).toEqual(['❯ سلام', 'اکتبر 21:10'])
  })

  test('redraws every time in a changed format once the next row is added', async ($, on) => {
    const { settings } = await started($, on)
    await prompt($, 'p1', 'one')
    const first = await promptRow($, 'p1', 'one')

    settings.timeFormat = '24-hour'
    expect(await lines(first)).toEqual(['❯ one', 'Sat, Oct 10 · 9:10 PM'])
    await prompt($, 'p2', 'two')
    expect(await lines(first)).toEqual(['❯ one', 'Sat, Oct 10 · 21:10'])
  })

  test('follows the locale for "auto", as LC_ALL, then LC_TIME, then LANG name it', async ($, on) => {
    await started($, on, { env: { LC_ALL: 'da_DK.UTF-8', LANG: 'en_US.UTF-8' } })
    await prompt($, 'p1', 'hej')

    expect(await lines(await promptRow($, 'p1', 'hej'))).toEqual(['❯ hej', 'lør. 10. okt. · 21.10'])
  })

  test("writes in Intl's own locale for the C locale, en-US where the tests run", async ($, on) => {
    await started($, on, { env: { LANG: 'C.UTF-8' } })
    await prompt($, 'p1', 'hi')

    expect(await lines(await promptRow($, 'p1', 'hi'))).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
  })

  test('takes a time zone that does not exist for none', async ($, on) => {
    const { settings } = await started($, on, { settings: { timeFormat: '24-hour', timeZone: 'Mars/Olympus' } })
    await prompt($, 'p0', 'first')
    await prompt($, 'p1', 'hi')
    const unknown = await once(promptRow($, 'p1', 'hi'))
    delete settings.timeZone
    await prompt($, 'p2', 'hi')

    expect(unknown).toHaveLength(2)
    expect(unknown).toEqual(await lines(await promptRow($, 'p2', 'hi')))
  })

  test('redraws every time in a changed time zone once the next row is added', async ($, on) => {
    const { settings } = await started($, on)
    await prompt($, 'p1', 'one')
    const first = await promptRow($, 'p1', 'one')

    settings.timeZone = 'UTC'
    await prompt($, 'p2', 'two')
    expect(await lines(first)).toEqual(['❯ one', 'Sat, Oct 10 · 7:10 PM'])
  })

  test('keeps the time format and zone it last read when reading the settings fails', async ($, on) => {
    const { clock, failSettings } = await started($, on, { settings: { timeFormat: '24-hour', timeZone: 'Asia/Tokyo' } })
    await prompt($, 'p1', 'one')
    failSettings()
    await clock.advance(MINUTE)
    await prompt($, 'p2', 'two')

    expect(await lines(await promptRow($, 'p1', 'one'))).toEqual(['❯ one', 'Sun, Oct 11 · 04:10'])
    expect(await lines(await promptRow($, 'p2', 'two'))).toEqual(['❯ two', '04:11'])
  })

  test('writes midnight and noon as 12 in the 12-hour format', async ($, on) => {
    const { clock } = await started($, on, { settings: { timeFormat: '12-hour', timeZone: 'UTC' }, now: Date.UTC(2026, 9, 10, 0, 30) })
    await prompt($, 'p1', 'night')
    await clock.advance(12 * 60 * MINUTE)
    await prompt($, 'p2', 'noon')

    expect(await lines(await promptRow($, 'p1', 'night'))).toEqual(['❯ night', 'Sat, Oct 10 · 12:30 AM'])
    expect(await lines(await promptRow($, 'p2', 'noon'))).toEqual(['❯ noon', '12:30 PM'])
  })

  test('adds seconds with the Seconds option, except to a strftime pattern', { options: { seconds: true } }, async ($, on) => {
    const { settings } = await started($, on)
    await prompt($, 'p0', 'first')
    const formats: [string, string][] = [
      ['auto', '9:10:00 PM'],
      ['12-hour', '9:10:00 PM'],
      ['24-hour', '21:10:00'],
      ['24-hour-utc', '19:10:00Z'],
      ['%H:%M', '21:10'],
    ]
    for (const [format, expected] of formats) {
      settings.timeFormat = format
      await prompt($, format, 'hi')

      expect(await lines(await promptRow($, format, 'hi'))).toEqual(['❯ hi', expected])
    }
  })

  test('leaves its own date out only when the time format already names the day', async ($, on) => {
    const { settings, clock } = await started($, on)
    // One a day, from Saturday the 10th, so each is due a date.
    const formats: [string, string][] = [
      ['%a %d %b %H:%M', 'Sat 10 Oct 21:10'],
      ['%-d/%-m %R', '11/10 21:10'],
      ['%F %R', '2026-10-12 21:10'],
      ['%j %R', '286 21:10'],
      ['%%d %R', 'Wed, Oct 14 · %d 21:10'],
      // Claude Code writes %c as it is.
      ['%c %R', 'Thu, Oct 15 · %c 21:10'],
      // The year and the month stay the same from one day to the next.
      ['%C%y %Y %B %b %h %m %R', 'Fri, Oct 16 · 2026 2026 October Oct Oct 10 21:10'],
    ]
    for (const [format, expected] of formats) {
      settings.timeFormat = format
      await prompt($, format, 'hi')
      await clock.advance(24 * 60 * MINUTE)

      expect(await lines(await promptRow($, format, 'hi'))).toEqual(['❯ hi', expected])
    }
  })

  test('cleans a strftime pattern as Claude Code does, so the time stays one line', async ($, on) => {
    const { settings } = await started($, on)
    await prompt($, 'p0', 'first')
    const formats: [string, string][] = [
      // A terminal's escape sequences, control and format characters, the
      // invisible ones, line separators and half a surrogate pair go.
      ['\u001b[2m%H:%M\u001b[0m', '21:10'],
      ['%H\n:\t%M\u200b', '21:10'],
      ['%H\u115f:%M\u2028', '21:10'],
      ['%H:%M\ud800', '21:10'],
      ['\u001b[\ud80031m%H:%M', '21:10'],
      // A pattern whose only % is inside an escape sequence is auto.
      ['\u001b]8;;%H\u0007', '9:10 PM'],
      // The pattern, and what it writes, are cut at 100 UTF-16 units, never
      // between the two halves of a surrogate pair.
      ['x'.repeat(99) + '%H', 'x'.repeat(99) + '%'],
      ['%A'.repeat(13), 'Saturday'.repeat(12) + 'Satu'],
      ['%%' + 'x'.repeat(97) + '\ud83d\ude00', '%' + 'x'.repeat(97)],
    ]
    for (const [i, [format, expected]] of formats.entries()) {
      settings.timeFormat = format
      await prompt($, `p${i + 1}`, 'hi')

      expect(await lines(await promptRow($, `p${i + 1}`, 'hi', { columns: 200 }))).toEqual(['❯ hi', expected])
    }
  })

  test('pads %e and %l with a space', async ($, on) => {
    await started($, on, { settings: { timeFormat: '%e|%l', timeZone: 'UTC' }, now: Date.UTC(2026, 9, 4, 8, 5) })
    await prompt($, 'p1', 'hi')

    expect(await lines(await promptRow($, 'p1', 'hi'))).toEqual(['❯ hi', ' 4| 8'])
  })

  test('measures a date in wide characters by the cells it takes', async ($, on) => {
    const { clock } = await started($, on, { env: { LANG: 'ja_JP.UTF-8' }, now: SAT_19_10 })
    await prompt($, 'p1', 'late')
    await clock.advance(10 * 60 * MINUTE + 50 * MINUTE)
    await prompt($, 'p2', 'early')

    // "10月11日(日) · 8:00" takes 19 cells in 16 code points: too many for 19
    // columns, though its code points would fit, so the time shows alone.
    expect(await once(promptRow($, 'p2', 'early', { columns: 19 }))).toEqual(['❯ early', '8:00'])
    expect(await once(promptRow($, 'p2', 'early', { columns: 20 }))).toEqual(['❯ early', '10月11日(日) · 8:00'])
  })
})
