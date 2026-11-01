import {database} from "./utils/dbhelper.js";
import {readUTM, UTM_PARAMETERS} from "./utils/utm.js";

if (globalThis.chrome?.runtime?.id) {
  chrome.runtime.connect({ name: "popup" });
}

async function currentPageURL() {
  if (!globalThis.chrome?.runtime?.id) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

export function describeUTM(fields) {
  return Object.entries(UTM_PARAMETERS)
    .filter(([, field]) => fields?.[field])
    .map(([parameter, field]) => `${parameter}=${fields[field]}`)
    .join(", ");
}

export function trackerState(name, requests, pageUTM) {
  if (!requests.length) return { name, description: "Not detected", status: "Missing" };
  const [latest] = requests;
  const reported = describeUTM(latest) || "no UTM values";
  const mismatched = Object.entries(pageUTM ?? {}).filter(([field, value]) => latest[field] !== value);
  if (mismatched.length) {
    return { name, description: `Expected ${describeUTM(Object.fromEntries(mismatched))}, reported ${reported}`, status: "Error" };
  }
  return { name, description: `Reported ${reported}`, status: "Healthy" };
}

async function loadTrackers(pageURL, pageUTM) {
  const trackingDomains = await database.list("trackingDomains");
  const history = await database.getRequestHistory(pageURL ? { pageURL } : {});
  const providerNames = [...new Set(trackingDomains.map((trackingDomain) => trackingDomain.providerName))];
  return providerNames.map((name) => {
      const requests = Object.values(history)
        .flatMap((providers) => providers[name] ?? [])
        .sort((first, second) => second.timeStamp - first.timeStamp || second.id - first.id);
      return trackerState(name, requests, pageUTM);
  });
}

const pageURL = await currentPageURL();
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

const trackers = await loadTrackers(pageURL, pageUTM);
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

const trackerList = document.querySelector("#tracker-list");
const groupedTrackers = {
  Healthy: [],
  Error: [],
  Missing: []
};

trackers.forEach((tracker) => {
    if (groupedTrackers[tracker.status]) {
      groupedTrackers[tracker.status].push(tracker);
    }
});

Object.entries(statusConfig).forEach(([status, config]) => {
    const group = document.createElement("section");
    group.className = "tracker-group";
    const header = document.createElement("div");
    header.className = "group-header";
    const dot = document.createElement("span");
    dot.className = `dot ${config.dot}`;
    dot.setAttribute("aria-hidden", "true");
    const title = document.createElement("span");
    title.textContent = config.label;
    header.append(dot, title);
    const grid = document.createElement("div");
    grid.className = "tracker-grid";
    groupedTrackers[status].forEach((tracker) => {
        const card = document.createElement("article");
        card.className = `tracker-card tracker-card--${status.toLowerCase()}`;
        const name = document.createElement("h3");
        name.textContent = tracker.name;
        const description = document.createElement("p");
        description.className = "tracker-description";
        description.textContent = tracker.description;
        const chip = document.createElement("span");
        chip.className = "tracker-chip";
        chip.textContent = config.chip;
        card.append(name, description, chip);
        grid.append(card);
    });
    group.append(header, grid);
    trackerList.append(group);
});

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
});