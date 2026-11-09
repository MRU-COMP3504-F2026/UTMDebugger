# UTM Debugger

## Project Members

- Jordan Kulcsar
- Zen Noakes (also owns the account "Zilbo")
- Patrick Hsueh
- Anferne Pineda
- Kevin Bertasius

### Communication Channel

https://discord.gg/8ZK86bfrB

### Shared Google Folder

https://drive.google.com/drive/folders/1e1vB8FgEADZmQ7_LU2bbv6SzU05HoB7D

## Requirements

* Node.js 22 and npm
* Google Chrome

## Build

1. Clone the repository with `git clone https://github.com/MRU-COMP3504-F2026/UTMDebugger.git`.
2. Change directory with `cd UTMDebugger`.
3. Run `npm ci`.
4. Run `npm run build`.

The build creates the `dist/` folder that `manifest.json` points to, so the
extension won't load until you build it.

## Running

1.  Go to chrome://extensions and turn on **Developer mode** in the top right.
2.  Click **Load unpacked** and select the repository root folder
    (the one containing everything, specifically with `manifest.json`).
3.  Check the extension menu (puzzle piece) in the chrome toolbar, and pin the extension.
4.  Open a new page that uses a supported tracker such as [shanehomes.com](https://www.shanehomes.com/)
5.  Click the extension icon in the top right. The popup will show the current
    status of each of the 5 trackers:
    * Healthy (green): a request was found active on this page and reports the correct
      UTM values as the page.
    * Error (red): the page has UTM values that the tracker's latest request does
      not have.
    * Not detected (gray): no request from the tracker was found for this page.

## Operational Use Cases

### Completed

* Status page: the popup shows each tracker as Healthy, Error, or Not detected
  for the current page.
* Clarity and Meta Pixel handlers are functional but not fully wired in.
* Supported trackers: Google Analytics, Microsoft Clarity, HubSpot, Meta Pixel,
  and Google Ads
 
### Not finished yet:
 
* Remaining trackers
* Blocker, Error, and Settings tab

### Running CI test suite locally

1. Change directory to working directory.
2. Run `npm ci` (clean install).
3. Run `npx playwright install chromium` to automate browser.
4. Run `npm test` to run test suite.

