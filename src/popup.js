import {database} from "./utils/dbhelper.js";
import {readUTM, UTM_PARAMETERS} from "./utils/utm.js";

// Connect to the background script to keep the popup alive while it's open
if (globalThis.chrome?.runtime?.id) {
  chrome.runtime.connect({ name: "popup" });
}

// Get the current page URL using the Chrome Tabs API
async function currentPageURL() {
  if (!globalThis.chrome?.runtime?.id) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

// Describe the UTM parameters in a human-readable format
export function describeUTM(fields) {
  return Object.entries(UTM_PARAMETERS)
    .filter(([, field]) => fields?.[field])
    .map(([parameter, field]) => `${parameter}=${fields[field]}`)
    .join(", ");
}

// Determine the state of a tracker based on its requests and the page's UTM parameters
export function trackerState(name, requests, pageUTM) {
  if (!requests.length) {
    return { name, description: "Not detected", status: "Missing" };
  }

  const [latest] = requests;
  const reported = describeUTM(latest) || "no UTM values";
  const mismatched = Object.entries(pageUTM ?? {}).filter(
    ([field, value]) => latest[field] !== value
  );

  if (mismatched.length) {
    return {
      name,
      description: `Expected ${describeUTM(Object.fromEntries(mismatched))}, reported ${reported}`,
      status: "Error"
    };
  }

  return { name, description: `Reported ${reported}`, status: "Healthy" };
}

// Load trackers from the database and determine their state based on the page's UTM parameters
async function loadTrackers(pageURL, pageUTM) {
  const trackingDomains = await database.list("trackingDomains");
  const history = await database.getRequestHistory(pageURL ? { pageURL } : {});
  const providerNames = [
    ...new Set(trackingDomains.map((trackingDomain) => trackingDomain.providerName))
  ];

  return providerNames.map((name) => {
    const requests = Object.values(history)
      .flatMap((providers) => providers[name] ?? [])
      .sort((first, second) => second.timeStamp - first.timeStamp || second.id - first.id);

    return trackerState(name, requests, pageUTM);
  });
}

// ---------- Blocking tab: services and Chrome rules ----------

// The name matches the provider in the database.
// The toggleId matches the checkbox in popup.html.
// The ruleId lets Chrome turn one service on or off independently.
// blocked is false on a fresh install. Saved choices are restored below.
const blockerServices = [
  {
    name: "Google Analytics",
    toggleId: "block-ga4",
    ruleId: 1001,
    blocked: false,
    condition: {
      requestDomains: ["analytics.google.com", "google-analytics.com"],
      urlFilter: "/collect^"
    }
  },
  {
    name: "Google Ads",
    toggleId: "block-google-ads",
    ruleId: 1002,
    blocked: false,
    condition: {
      requestDomains: [
        "googleadservices.com",
        "googleads.g.doubleclick.net",
        "google.com"
      ],
      // Limit the rule to conversion and audience tracking endpoints.
      regexFilter:
        "^https?://[^/]+/pagead/(1p-)?(conversion|viewthroughconversion|user-list)([/?]|$)"
    }
  },
  {
    name: "Microsoft Clarity",
    toggleId: "block-clarity",
    ruleId: 1003,
    blocked: false,
    condition: {
      requestDomains: ["clarity.ms"],
      urlFilter: "/collect^"
    }
  },
  {
    name: "HubSpot",
    toggleId: "block-hubspot",
    ruleId: 1004,
    blocked: false,
    condition: {
      requestDomains: ["track.hubspot.com", "track.hubspot.eu"],
      urlFilter: "/__ptq.gif^"
    }
  },
  {
    name: "Meta Pixel",
    toggleId: "block-meta-pixel",
    ruleId: 1005,
    blocked: false,
    condition: {
      requestDomains: ["facebook.com"],
      // Match the /tr pixel endpoint, including /tr/ and /tr?...
      regexFilter: "^https?://[^/]+/tr([/?]|$)"
    }
  }
];

// Ask Chrome to apply the switch to future matching requests on all sites.
async function setServiceBlocked(service, blocked) {
  const rule = {
    id: service.ruleId,
    priority: 1,
    action: { type: "block" },
    condition: {
      ...service.condition,
      // Allow direct navigation to a page in the browser tab.
      excludedResourceTypes: ["main_frame"]
    }
  };

  // ON replaces this service's rule. OFF removes it.
  // Rules belonging to other services keep their current settings.
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [service.ruleId],
    addRules: blocked ? [rule] : []
  });

  // Update the popup's boolean only after Chrome accepts the change.
  service.blocked = blocked;
}

// Get the current page URL and its UTM parameters, then update the popup UI accordingly
const pageURL = await currentPageURL();

// Read the UTM parameters from the current page URL
const pageUTM = pageURL ? readUTM(pageURL) : null;

if (pageURL) {
  document.querySelector(".domain").textContent = new URL(pageURL).hostname;
}

const utmParameters = document.querySelector("#utm-parameters");

if (utmParameters && pageURL) {
  utmParameters.textContent = pageUTM
    ? `Page UTM: ${describeUTM(pageUTM)}`
    : "This page has no UTM parameters.";
}

// Load the trackers and display their status in the popup UI
const trackers = await loadTrackers(pageURL, pageUTM);
const trackerList = document.querySelector("#tracker-list");

const statusConfig = {
  Healthy: {
    dot: "green",
    label: "Healthy",
    chip: "Healthy"
  },
  Error: {
    dot: "red",
    label: "Error",
    chip: "Error"
  },
  Missing: {
    dot: "gray",
    label: "Not Detected",
    chip: "Not Detected"
  }
};

function renderStatus() {
  // Start with an empty list so moving a tracker never duplicates its card.
  trackerList.replaceChildren();

  const groupedTrackers = {
    Healthy: [],
    Error: [],
    Missing: []
  };

  for (const tracker of trackers) {
    const service = blockerServices.find((item) => item.name === tracker.name);

    if (service?.blocked) {
      // "Missing" is the existing group displayed as "Not Detected".
      // Copy the tracker so its original health and request history are preserved.
      groupedTrackers.Missing.push({
        ...tracker,
        status: "Missing",
        description: "Requests denied in the Blocking tab."
      });
    } else {
      // Switching blocking off restores the health calculated from recorded requests.
      groupedTrackers[tracker.status].push(tracker);
    }
  }

  for (const [status, config] of Object.entries(statusConfig)) {
    const group = createEl("section", "tracker-group");
    const header = createEl("div", "group-header");
    const dot = createEl("span", `dot ${config.dot}`);
    dot.setAttribute("aria-hidden", "true");

    const title = createEl("span", "", config.label);
    header.append(dot, title);

    const grid = createEl("div", "tracker-grid");

    for (const tracker of groupedTrackers[status]) {
      const card = createEl(
        "article",
        `tracker-card tracker-card--${status.toLowerCase()}`
      );

      const name = createEl("h3", "", tracker.name);
      const description = createEl("p", "tracker-description", tracker.description);
      const chip = createEl("span", "tracker-chip", config.chip);

      card.append(name, description, chip);
      grid.append(card);
    }

    group.append(header, grid);
    trackerList.append(group);
  }
}

// ---------- Blocking tab: switches and row appearance ----------

async function initializeBlockers() {
  const notice = document.querySelector(".blocking-notice");

  // Some popup tests only include the Status tab.
  if (!notice) return;

  notice.setAttribute("role", "status");

  // Wait for the saved rules before letting the user change a switch.
  const switches = document.querySelectorAll(".blocker-toggle");
  for (const input of switches) {
    input.disabled = true;
  }

  try {
    // Chrome keeps dynamic rules after the popup closes. Reading them here
    // restores the correct switches every time the user opens the extension.
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const installedIds = new Set(rules.map((rule) => rule.id));

    for (const service of blockerServices) {
      service.blocked = installedIds.has(service.ruleId);

      const input = document.getElementById(service.toggleId);
      if (!input) continue;

      const row = input.closest(".blocker-row");
      const caption = row.querySelector(".blocker-info p");

      // The checkbox, caption, and red X all reflect the same boolean.
      // popup.css draws the X when this row has the "is-blocked" class.
      function updateRow() {
        input.checked = service.blocked;
        row.classList.toggle("is-blocked", service.blocked);
        caption.textContent = service.blocked
          ? "Requests denied"
          : "Requests allowed";
      }

      updateRow();
      input.disabled = false;

      input.addEventListener("change", async () => {
        // Prevent a second click on this switch while Chrome updates its rule.
        input.disabled = true;

        try {
          await setServiceBlocked(service, input.checked);

          // Update Status immediately, even while the Blocking tab is open.
          renderStatus();

          notice.textContent = service.blocked
            ? `${service.name} blocking is on.`
            : `${service.name} blocking is off.`;
        } catch (error) {
          console.error(`Could not update ${service.name} blocking`, error);
          notice.textContent = `Could not update ${service.name}. Try again.`;
        } finally {
          // A rejected rule change leaves service.blocked at its previous
          // value, so this also restores the switch after a failure.
          updateRow();
          input.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error("Could not load tracker blocking settings", error);
    notice.textContent = "Blocking settings are unavailable. Reload the extension.";

    for (const input of switches) {
      const row = input.closest(".blocker-row");
      row.querySelector(".blocker-info p").textContent = "Unavailable";
      input.disabled = true;
    }
  }
}

// Restore saved switches before drawing the Status cards for the first time.
await initializeBlockers();
renderStatus();

// Switch between the four pages.
const buttons = document.querySelectorAll(".nav-button");
const pages = document.querySelectorAll(".page");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetPageId = button.dataset.target;

    pages.forEach((page) => {
      page.hidden = page.id !== targetPageId;
    });

    buttons.forEach((navButton) => {
      const isSelected = navButton === button;
      navButton.classList.toggle("active", isSelected);

      if (isSelected) {
        navButton.setAttribute("aria-current", "page");
      } else {
        navButton.removeAttribute("aria-current");
      }
    });
  });

  // This is the code that broke the Popup. It was removed to fix the issue, but it can be re-added if needed.
  /*buttons.forEach((navButton) => {
    const isSelected = navButton === button;

    navButton.classList.toggle("active", isSelected);

    if (isSelected) {
      navButton.setAttribute("aria-current", "page");
    } else {
      navButton.removeAttribute("aria-current");
    }
  });*/
});

// ---------- Errors tab ----------

// make an element with Tailwind classes and optional text
function createEl(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Temporary dummy data. When the real log exists, only this function changes to fetch the data from the background script.
async function getErrors() {
  return [
    {
      title: "Hubspot source changed",
      message: "Hubspot recorded a different original source for this visitor than the one reported earlier.",
      userId: "hubspotutk_8f3a91c2",
      before: "Paid Search",
      current: "Direct Traffic",
      time: "Today at 10:15 AM"
    }
  ];
}

function renderErrors(items) {
  const list = document.querySelector("#error-messages");
  if (!list) return;

  list.replaceChildren();
  document.querySelector("#error-count").textContent =
    `${items.length} issue${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    list.append(
      createEl(
        "p",
        "py-8 text-center text-[13px] text-muted dark:text-[#9aa7a1]",
        "No issues found."
      )
    );
    return;
  }

  items.forEach((item) => {
    const card = createEl(
      "article",
      "flex gap-3.5 rounded-2xl border border-warn-line bg-warn-bg p-5 text-black dark:border-[#5a4a1f] dark:bg-[#232826] dark:text-[#e8ecea]"
    );

    card.append(
      createEl(
        "div",
        "grid size-9 shrink-0 place-items-center rounded-full bg-warn-icon font-bold text-warn-ink dark:bg-[#4a3f1c] dark:text-[#f0d68a]",
        "!"
      )
    );

    const body = createEl("div", "min-w-0 flex-1");
    body.append(
      createEl("h3", "text-sm font-bold", item.title),
      createEl(
        "p",
        "mt-1.5 text-[13px] leading-normal text-muted dark:text-[#9aa7a1]",
        item.message
      )
    );

    const userRow = createEl(
      "div",
      "mt-3.5 flex items-center justify-between rounded-xl border border-warn-line bg-white px-3.5 py-2.5 text-xs dark:border-[#3a413e] dark:bg-[#1b1f1e]"
    );
    userRow.append(
      createEl("span", "text-muted dark:text-[#9aa7a1]", "User ID"),
      createEl("span", "font-bold", item.userId)
    );

    const compare = createEl("div", "mt-2.5 flex items-center gap-2.5");

    const beforeBox = createEl(
      "div",
      "flex-1 rounded-xl bg-before-bg px-3.5 py-2.5 dark:bg-[#3a3118]"
    );
    beforeBox.append(
      createEl(
        "div",
        "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#c9b77a]",
        "Before"
      ),
      createEl("div", "mt-1 text-sm font-bold", item.before)
    );

    const afterBox = createEl(
      "div",
      "flex-1 rounded-xl bg-after-bg px-3.5 py-2.5 dark:bg-[#40201f]"
    );
    afterBox.append(
      createEl(
        "div",
        "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#e59a9d]",
        "Current page"
      ),
      createEl("div", "mt-1 text-sm font-bold", item.current)
    );

    compare.append(
      beforeBox,
      createEl("span", "text-muted dark:text-[#9aa7a1]", "→"),
      afterBox
    );

    body.append(
      userRow,
      compare,
      createEl("p", "mt-4 text-xs text-muted dark:text-[#9aa7a1]", item.time)
    );

    card.append(body);
    list.append(card);
  });
}

async function loadErrors() {
  renderErrors(await getErrors());
}

loadErrors();