# Security policy

## Supported versions

Only the latest release gets fixes.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub instead: [report a vulnerability](https://github.com/mmedum/nuet/security/advisories/new), under the repository's Security tab.

Say which nuet and Claude Code versions you use, what someone could do with the problem, and how to reproduce it. nuet is maintained by one person, so allow a few days for an answer.

## What counts

nuet runs inside Claude Code with your permissions. These are in scope:

- nuet reading, running, writing or sending anything that [How it works](README.md#how-it-works) doesn't list.
- nuet changing a message, a row added to the conversation, or what Claude reads. It must always hand them on unchanged.
- A transcript row that nuet draws showing something it shouldn't, such as content from another session.

A problem in Claude Code itself goes to Anthropic, through [Claude Code's security policy](https://github.com/anthropics/claude-code/blob/main/SECURITY.md).
