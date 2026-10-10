import { describe, expect, test } from 'claude-code/testing'
import { colorOf } from '../hooks/paint'
import { prompt, promptRow, started } from './kit'

describe('time color', () => {
  test("reads a color as Claude Code's custom themes spell one, and falls back on anything else", () => {
    const cases: [unknown, string][] = [
      ['inactive', 'inactive'],
      ['claude', 'claude'],
      ['briefLabelClaude', 'briefLabelClaude'],
      ['inactiveShimmer', 'inactiveShimmer'],
      ['blue_FOR_SUBAGENTS_ONLY', 'blue_FOR_SUBAGENTS_ONLY'],
      ['rainbow_violet_shimmer', 'rainbow_violet_shimmer'],
      ['cyan', 'ansi256(6)'],
      ['redBright', 'ansi256(9)'],
      ['gray', 'ansi256(8)'],
      [' #F80 ', '#ff8800'],
      ['#7AA2F7', '#7aa2f7'],
      ['rgb(122, 162, 247)', '#7aa2f7'],
      ['rgb(255, 255, 255)', '#ffffff'],
      ['ansi256(0)', 'ansi256(0)'],
      ['ansi256( 110 )', 'ansi256(110)'],
      ['ansi256(255)', 'ansi256(255)'],
      ['ansi:black', 'ansi256(0)'],
      ['ansi:cyan', 'ansi256(6)'],
      [' ansi:blackBright ', 'ansi256(8)'],
      ['ansi:whiteBright', 'ansi256(15)'],
      ['ansi:grey', 'ansi256(8)'],
      ['rgb(256, 0, 0)', 'inactive'],
      ['ansi256(256)', 'inactive'],
      ['ansi:teal', 'inactive'],
      ['#12345', 'inactive'],
      ['nonsense', 'inactive'],
      [42, 'inactive'],
    ]
    for (const [value, expected] of cases) {
      expect(colorOf(value, 'inactive')).toBe(expected)
    }
  })

  test("draws the time in Claude Code's color for hints and timestamps", async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    expect((await (await promptRow($, 'p1', 'hi')).find({ type: 'Text', text: '9:10 PM' }))?.props).toEqual({ color: 'inactive' })
  })

  // An ansi: name, which Claude Code refuses as written: the whole row
  // would fall back to its own drawing.
  test('draws the time in the Time color option', { options: { timeColor: 'ansi:cyan' } }, async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    expect((await (await promptRow($, 'p1', 'hi')).find({ type: 'Text', text: '9:10 PM' }))?.props).toEqual({ color: 'ansi256(6)' })
  })

  test("leaves the default for a color nuet can't read", { options: { timeColor: 'teal' } }, async ($, on) => {
    await started($, on)
    await prompt($, 'p1', 'hi')

    expect((await (await promptRow($, 'p1', 'hi')).find({ type: 'Text', text: '9:10 PM' }))?.props).toEqual({ color: 'inactive' })
  })
})
