# UTM Debugger User Manual

This manual describes UTM Debugger as it will be at the final release.
Features that are not finished in the current release ([`v1.0.0-beta`](https://github.com/MRU-COMP3504-F2026/UTMDebugger/releases/tag/v1.0.0-beta)) are marked **Work in progress (WIP)**.

- [Overview](#overview)
- [Who this is for](#who-this-is-for)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Run](#run)
- [Use](#use)
- [Privacy](#privacy)
- [Update or uninstall](#update-or-uninstall)
- [How to report a bug](#how-to-report-a-bug)
- [Known bugs and limitations](#known-bugs-and-limitations)

## Overview

UTM Debugger is a Google Chrome extension that helps users identify website tracking software and check whether its outgoing requests contain the same UTM campaign values as the current page’s URL. UTM parameters describe how visitors arrive at a website, including the campaign’s source, medium, and name. Keeping these values consistent helps businesses understand which marketing campaigns bring visitors to their websites.

Tracking issues can occur after website updates or changes to tracking configurations. Investigating these problems often requires manually inspecting network requests and comparing campaign values. UTM Debugger simplifies this process by displaying information about supported trackers in one interface, helping users identify discrepancies more quickly.

The Status tab groups trackers as Healthy, Error, or Not detected based on observed requests and their UTM values. Users can review the reported campaign information and identify missing or mismatched values. These checks help reveal potential tracking issues, although they do not confirm that a tracking platform successfully received or attributed the data. Collected debugging information is stored locally in the browser.

The extension also includes Errors, Blocking, and Settings tabs, which are currently works in progress. These features are intended to provide diagnostic history and log exports, controls for blocking supported trackers, and domain-based activation settings. Together, they aim to make website tracking easier to inspect and manage for developers, marketers, and everyday users interested in privacy.

### Supported trackers

| Tracker | Detected by requests to | Status |
| --- | --- | --- |
| Google Analytics 4 | `analytics.google.com` | UTM check available. Provider details are WIP. |
| Google Ads | `www.googleadservices.com` | UTM check available. Provider details are WIP. |
| HubSpot | `track.hubspot.com` | UTM check available. Provider details are WIP. |
| Microsoft Clarity | `clarity.ms` | UTM check and user ID available. |
| Meta Pixel | `www.facebook.com/tr` | UTM check, browser ID (`fbp`), pixel ID, event name and click ID (`fbc`) available. |
| LinkedIn Insight Tag | `px.ads.linkedin.com` | WIP, not enabled. |

## Who this is for

Website developers and testers: Check tracking behaviour after website changes and investigate missing or mismatched UTM values.

Digital marketers and analysts: Verify that campaign information is included correctly in supported tracking requests.

Everyday users interested in privacy: See which supported trackers send requests from a page. The planned Blocking tab will let users control requests to supported tracking providers.

## Prerequisites

| Requirement | Version | Why | How to get it |
| --- | --- | --- | --- |
| Google Chrome | Current stable release (minimum 92) | Runs the extension (Manifest V3 with a module service worker). | [google.com/chrome](https://www.google.com/chrome/) |
| Node.js | 22.12 or later (22 LTS recommended) | Builds the extension from source. | [nodejs.org](https://nodejs.org/en/download) or `nvm install 22` |
| npm | 10 or later (bundled with Node.js 22) | Installs build tools. | Included with Node.js |
| Git | Any recent version | Downloads the source. Optional if you download a ZIP. | [git-scm.com](https://git-scm.com/downloads) |

Other Chromium browsers (Edge, Brave) may work but are not tested.

## Install

1. Clone with Git:

   ```bash
   git clone https://github.com/MRU-COMP3504-F2026/UTMDebugger.git
   ```

   or by downloading the ZIP for the
   [`v1.0.0-beta` release](https://github.com/MRU-COMP3504-F2026/UTMDebugger/releases/tag/v1.0.0-beta)
   and extracting it.
2. Open a terminal in the project folder:

   ```bash
   cd UTMDebugger
   ```

3. Install the build tools:

   ```bash
   npm ci
   ```

4. Build the extension:

   ```bash
   npm run build
   ```

   This creates the `dist/` folder. The extension will not load without it.
5. In Chrome, go to `chrome://extensions`.
6. Turn on **Developer mode** (top right).
7. Click **Load unpacked** and select the `UTMDebugger` folder, the one that contains `manifest.json`. Do not select `dist/`.

## Run

## Use

### Status tab

### Errors tab (WIP)

### Blocking tab (WIP)

### Settings tab (WIP)

### Other planned features (WIP)

## Privacy

## Update or uninstall

## How to report a bug

Search the [open issues](https://github.com/MRU-COMP3504-F2026/UTMDebugger/issues)
and [Known bugs and limitations](#known-bugs-and-limitations) first. If the problem is new, [open a bug report](https://github.com/MRU-COMP3504-F2026/UTMDebugger/issues/new?template=bug_report.md).
The template asks for the following...

| Field | What to write |
| --- | --- |
| Title | One sentence naming the tab or tracker and what goes wrong, for example "Clarity shows Not detected on pages with utm_campaign". |
| Version | The release tag or commit (`git rev-parse --short HEAD`) and the version in the popup footer. |
| Environment | Chrome version (`chrome://version`), operating system, other extensions that block ads or trackers. |
| Page | The full address you tested, including UTM parameters. Remove anything private. |
| Steps to reproduce | Numbered steps starting from a freshly loaded page. |
| Expected result | What you expected the popup to show. |
| Actual result | What it showed. Add a screenshot of the popup. |
| Console output | Errors from the service worker: in `chrome://extensions`, click **service worker** on the UTM Debugger card and copy the Console output. |
| Frequency | Always, sometimes, or once. |

One bug per report. For more advice, see Mozilla's [Bug Writing Guidelines](https://bugzilla.mozilla.org/page.cgi?id=bug-writing.html).

## Known bugs and limitations

Known bugs are tracked in the [issue tracker under the `bug` label](https://github.com/MRU-COMP3504-F2026/UTMDebugger/issues?q=is%3Aissue+label%3Abug).
The main ones in `v1.0.0-beta` are:

| Area | Bug or limitation |
| --- | --- |
| Errors, Blocking, Settings | Not functional yet (see [Use](#use)). |

[living document]: https://drive.google.com/drive/folders/1e1vB8FgEADZmQ7_LU2bbv6SzU05HoB7D
