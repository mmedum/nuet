# Changelog

Notable changes to nuet. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and nuet uses [Semantic Versioning](https://semver.org/). While it is on 0.x, what it shows may change between minor versions.

## [Unreleased]

## [0.1.1] - 2026-10-11

### Fixed

- Typed prompts and replies could show no time. Claude Code can draw a message in parts, one row each, under its id with the last twelve digits replaced by the part's number, so nuet didn't find the time it had kept for the message; only a prompt queued while Claude was busy, drawn under its full id, got one. nuet now matches a row by the part of its id that stays the same, and puts the time on the message's first part only.

## [0.1.0] - 2026-10-11

### Added

- A dim time over the blank line above each prompt you send, and above each reply whose time reads differently from the last one shown or falls on a new day, at the line's right end; the first time shown and the first of each new day carry the date, or show the time alone where the line has room only for that.
- Times written the way Claude Code's own clock writes them, by its `timeFormat` and `timeZone` settings and in the locale: auto, 12-hour and 24-hour in the locale's own form, and every strftime field Claude Code knows, glibc's `%-` included, a pattern cleaned and cut as Claude Code cleans and cuts one; a Seconds option, and a Time color option that takes a theme role or a color, with a color name, an `ansi:` name and `ansi256()` from 0 to 15 drawn in the terminal's own palette.
- `/nuet` says whether nuet's times are on. `/nuet off` hides them, those already drawn too, and `/nuet on` shows them again; the switch lasts for the session.

[Unreleased]: https://github.com/mmedum/nuet/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/mmedum/nuet/releases/tag/v0.1.1
[0.1.0]: https://github.com/mmedum/nuet/releases/tag/v0.1.0
