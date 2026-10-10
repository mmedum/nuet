import { describe, expect, test } from 'claude-code/testing'
import { lines, prompt, promptRow, reply, replyRow, nuet, started } from './kit'

describe('/nuet', () => {
  test("off hides nuet's times already drawn, and on shows them again, each saying how nuet stands", async ($, on) => {
    const { logged } = await started($, on)
    await prompt($, 'p1', 'hi')
    await reply($, 'r1', 'hello')
    const asked = await promptRow($, 'p1', 'hi')

    await nuet($, 'off')
    expect(await lines(asked)).toEqual(['❯ hi'])

    await nuet($, 'on')
    expect(await lines(asked)).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
    expect(logged).toEqual([
      'off for this session: its times are hidden. /nuet on shows them again.',
      'on: its times show again. /nuet off hides them.',
    ])
  })

  test('alone, says whether nuet is on and changes nothing', async ($, on) => {
    const { logged } = await started($, on)
    await prompt($, 'p1', 'hi')
    const asked = await promptRow($, 'p1', 'hi')

    await nuet($)
    expect(await lines(asked)).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
    await nuet($, 'off')
    await nuet($)
    expect(await lines(asked)).toEqual(['❯ hi'])
    expect(logged).toEqual([
      "on. The times above your prompts and Claude's replies are nuet's. /nuet off hides them.",
      'off for this session: its times are hidden. /nuet on shows them again.',
      'off for this session. /nuet on shows its times again.',
    ])
  })

  test('says so when nuet already stands as asked', async ($, on) => {
    const { logged } = await started($, on)

    await nuet($, 'on')
    await nuet($, 'off')
    await nuet($, 'off')

    expect(logged).toEqual([
      'already on. /nuet off hides its times.',
      'off for this session: its times are hidden. /nuet on shows them again.',
      'already off. /nuet on shows its times again.',
    ])
  })

  test('answers anything else with how to use it, and changes nothing', async ($, on) => {
    const { logged } = await started($, on)
    await prompt($, 'p1', 'hi')

    await nuet($, 'toggle')

    expect(await lines(await promptRow($, 'p1', 'hi'))).toEqual(['❯ hi', 'Sat, Oct 10 · 9:10 PM'])
    expect(logged).toEqual(["/nuet takes on or off, or nothing to say whether it's on. To turn nuet off for good: claude plugin disable nuet@nuet"])
  })

  test('takes on and off in any case, with spaces around', async ($, on) => {
    const { logged } = await started($, on)

    await nuet($, '  OFF ')

    expect(logged).toEqual(['off for this session: its times are hidden. /nuet on shows them again.'])
  })

  test('still times the rows added while off, and shows them once on', async ($, on) => {
    await started($, on)

    await nuet($, 'off')
    await reply($, 'r1', 'hello')
    await nuet($, 'on')

    expect(await lines(await replyRow($, 'r1', 'hello'))).toEqual(['● hello', 'Sat, Oct 10 · 9:10 PM'])
  })

  test('stays off after /clear, /resume and /branch', async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')
    const asked = await promptRow($, 'p1', 'hi')

    await nuet($, 'off')
    for (const source of ['clear', 'resume', 'fork'] as const) {
      await $.classic.SessionStart({ source })
      expect(await lines(asked)).toEqual(['❯ hi'])
    }
  })
})
