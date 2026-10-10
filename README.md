# nuet

A dim time above each prompt and each reply in the Claude Code transcript, written the way your own clock setting writes it.

[![CI](https://github.com/mmedum/nuet/actions/workflows/ci.yml/badge.svg)](https://github.com/mmedum/nuet/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/mmedum/nuet?label=release)](https://github.com/mmedum/nuet/releases/latest)

_nuet_ is Danish for "the now", as in _leve i nuet_, to live in the moment. Each time nuet writes is the now of one message: when you sent it, or when Claude's answer came. Its icon says the same: everything stays as it is, and each message keeps its now.

Claude Code says when a turn finished, `done 9:10 PM`, but not when you asked or when Claude answered. In a long session that's what you need to line the conversation up with your logs, or to see how long Claude worked on something. nuet puts the time on the blank line Claude Code already leaves above each message, at its right end:

![A Claude Code transcript with nuet, set to 24-hour time. A dim Sun, Oct 11 · 09:03 sits at the right end of the blank line above the first prompt; its answer came in the same minute and shows no time. The next prompt shows 09:04, and 09:05 sits above Claude's answer, which came in the next minute.](docs/screenshot.png)

Nothing else changes. The messages keep their width and their words, and `/nuet off` hides the times whenever you want Claude Code's own view.

## Install

```text
/plugin install nuet --marketplace mmedum/nuet
```

Tested with Claude Code 2.1.296 in a terminal. Mods don't draw in the VS Code panel, which has message times of its own, or with `-p`.

Third-party marketplaces don't update on their own. To update, run `claude plugin update nuet@nuet` and restart Claude Code. To remove nuet, run `claude plugin uninstall nuet@nuet`.

## What it shows

- **Above each prompt:** when you sent it. A prompt you type while Claude is busy shows when Claude Code took it in, at its next step. A prompt you send through Remote Control or from Slack, or that a plugin sends as your words, is yours too; what Claude Code delivers the same way from elsewhere, a background task's notification or a message from another session or a channel, shows none.
- **Above a reply:** when it arrived, if that reads differently from the last time shown or falls on a new day. A reply in the same minute as your prompt shows none, so a quick answer adds nothing; a long one shows when it came.
- **The date:** the first time shown, and the first of each new day, carry the date, as in `Sun, Oct 11 · 8:00 AM`, so every stretch of a long session can be placed. On a line with room only for the time, the date is left out, so a new day goes unmarked there.
- **In your format:** Claude Code's own Time format setting (`timeFormat`: auto, 12-hour, 24-hour, 24-hour UTC or a strftime pattern) and `timeZone`, the ones its `done` time follows, so both agree. Set it in `/config` (Time format) or `settings.json`. Times are written in your locale, as Claude Code writes them: the first of `LC_ALL`, `LC_TIME` and `LANG` that is set, or the runtime's default for none or `C`. Auto takes the locale's own form, so `en_US` gives 12-hour times and most other locales 24-hour; 12-hour and 24-hour change only the hour cycle, so a Danish 24-hour time is `21.10`. A strftime pattern takes every field Claude Code's does, with days and months named in your locale and glibc's `%-` for no padding (`%-I:%M %p`); a field it doesn't know is written as it is. As Claude Code does, nuet takes terminal escapes and control and invisible characters out of a pattern, and cuts the pattern, and what it writes, at 100 characters. A strftime pattern that already says which day it is, with the day of the month or year, the weekday or the whole date, gets no second date from nuet. A changed setting shows from the next message on, and every time above redraws in it.
- **Seconds,** if you want them: turn on the Seconds option in `/config` or with `/plugin configure nuet@nuet`. A strftime format decides for itself.
- **In your theme's color:** by default the times take Claude Code's own color for hints and timestamps, the `inactive` role, so they follow `/theme`, light or dark. The Time color option takes another role, such as `claude` or `success`, or a color: `#7aa2f7`, `rgb(122,162,247)`, `ansi256(110)` or `ansi:cyan`. A value nuet can't read leaves the default. To restyle quiet text all over Claude Code, override `inactive` in a [custom theme](https://code.claude.com/docs/en/terminal-config#create-a-custom-theme) instead; a hex or `rgb()` color doesn't follow light or dark themes, while color names, `ansi:` names and `ansi256()` from 0 to 15 follow your terminal's own palette.

The times cover the messages added since nuet loaded. After `/resume`, older messages show none. In ctrl+o's transcript viewer, Claude Code times the replies itself and nuet times the prompts. A subagent's messages, tool calls and their results get no time.

## Turning it off

```text
/nuet        says whether nuet is on
/nuet off    hides nuet's times
/nuet on     shows them again
```

`/nuet off` hides the times on screen, those already drawn too, and `/nuet on` brings them back. Messages added while it's off are still timed, so their times show once it's on. The switch lasts for the session, through `/clear`, and a new session starts with nuet on. To turn nuet off for good, run `claude plugin disable nuet@nuet`.

`/nuet` answers with a dim line that Claude doesn't read, and works while Claude is busy.

## How it works

Mods run with your permissions, so here is everything nuet touches. `claude plugin validate` lists the same.

### What it reads

- The kind of each row added to the conversation, who sent it, and its id: whether it's your prompt, typed or queued while Claude was busy, or a reply with text in it. nuet never reads what a message says.
- The clock, when a prompt or a reply is added (`$.clock.now`).
- Claude Code's settings, as it reads them (`$.settings.read`), for two of them only: `timeFormat` and `timeZone`.
- The environment variables `LC_ALL`, `LC_TIME` and `LANG`, for the locale the times are written in.
- What you type after `/nuet`, and the Seconds and Time color options.

### What it runs and writes

Nothing. nuet runs no programs, reads no files, writes no files, makes no network requests and uses no plugin store. Each message's time, and whether you turned nuet off, live in the session's own state and go with it.

### What its hooks change

- Two kinds of transcript rows, your prompts and Claude's replies: the time is drawn over the blank line above the message.
- Its hook on rows added to the conversation only notes the time, and hands every row on unchanged.
- It adds the `/nuet` command, which answers with a dim line in the transcript. Its hook on a session restarting (`/clear`, `/resume`, `/branch`) only puts the switch back as you left it.

## Privacy

nuet collects no data about you and sends nothing anywhere. It runs only on your machine, inside Claude Code, and keeps nothing after the session ends.

## Contributing

Questions and bugs: [open an issue](https://github.com/mmedum/nuet/issues). For a pull request, open an issue first. [CONTRIBUTING.md](CONTRIBUTING.md) says how to run, test and release nuet. To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE) © 2026 Mark Medum Bundgaard
