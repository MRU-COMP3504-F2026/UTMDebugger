# UTM Debugger

UTM Debugger is a Google Chrome extension that checks whether the tracking software on a web page (Google Analytics, Google Ads, HubSpot, Microsoft Clarity, and Meta Pixel) receives the same UTM campaign values as the page you are on.

## Current release

| Release | Git tag | Notes |
| --- | --- | --- |
| Beta (P8) | [`v1.0.0`](https://github.com/MRU-COMP3504-F2026/UTMDebugger/releases/tag/v1.0.0) | Status tab working for all five trackers. Errors, Blocking, and Settings tabs are work in progress. |

## Documentation

| Document | Audience | Contents |
| --- | --- | --- |
| [User Manual](docs/USER_MANUAL.md) | People using the extension | What it does, installing, running, using each tab, reporting bugs, known bugs |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Team and internal contributors | Getting the source, directory layout, building, testing, adding tests, releasing |
| [Living Document][living document] | Course staff and the team | Requirements, use cases, architecture, design, risks, test plan and schedule |
| [Weekly Reports](reports/) | Course staff and the team | Team and individual status reports |

## Quick start

Requires Node.js 22.12 or later and Google Chrome. Full steps are in the
[user manual](docs/USER_MANUAL.md#install).

```bash
git clone https://github.com/MRU-COMP3504-F2026/UTMDebugger.git
cd UTMDebugger
npm ci
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click
**Load unpacked** and select the `UTMDebugger` folder.

## Reporting bugs

Open an issue with the
[bug report template](https://github.com/MRU-COMP3504-F2026/UTMDebugger/issues/new?template=bug_report.md).
See [How to report a bug](docs/USER_MANUAL.md#how-to-report-a-bug) for what to include, and [Known bugs](docs/USER_MANUAL.md#known-bugs-and-limitations) before filing.

## Project members

- Jordan Kulcsar
- Zen Noakes (also owns the account "Zilbo")
- Patrick Hsueh
- Anferne Pineda
- Kevin Bertasius

- Communication: [Discord](https://discord.gg/8ZK86bfrB)
- Shared files: [Google Drive folder][living document]

[living document]: https://drive.google.com/drive/folders/1e1vB8FgEADZmQ7_LU2bbv6SzU05HoB7D
