chrome.runtime.connect({ name: "popup" });
const trackers = [
  {
    name: "Google Analytics",
    description: "Tracking active",
    status: "Healthy"
  },
  {
    name: "Google Ads",
    description: "Conversions active",
    status: "Healthy"
  },
  {
    name: "Hubspot",
    description: "Tracking error",
    status: "Error"
  },
  {
    name: "Clarity",
    description: "Not detected",
    status: "Missing"
  },
  {
    name: "Meta",
    description: "Not detected",
    status: "Missing"
  }
];

const statusConfig = {
  Healthy: {
    dot: "green",
    label: "Healthy",
  },
  Error: {
    dot: "red",
    label: "Error",
  },
  Missing: {
    dot: "gray",
    label: "Not Detected",
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

    const chip = document.createElement("span");
    chip.className = "tracker-chip";
    chip.textContent = config.label;

    card.append(name, chip);
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
  list.replaceChildren();

  document.querySelector("#error-count").textContent =
    `${items.length} issue${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    list.append(createEl("p", "py-8 text-center text-[13px] text-muted dark:text-[#9aa7a1]", "No issues found."));
    return;
  }

  items.forEach((item) => {
    const card = createEl("article", "flex gap-3.5 rounded-2xl border border-warn-line bg-warn-bg p-5 text-black dark:border-[#5a4a1f] dark:bg-[#232826] dark:text-[#e8ecea]");

    card.append(createEl("div", "grid size-9 shrink-0 place-items-center rounded-full bg-warn-icon font-bold text-warn-ink dark:bg-[#4a3f1c] dark:text-[#f0d68a]", "!"));

    const body = createEl("div", "min-w-0 flex-1");
    body.append(
      createEl("h3", "text-sm font-bold", item.title),
      createEl("p", "mt-1.5 text-[13px] leading-normal text-muted dark:text-[#9aa7a1]", item.message)
    );

    const userRow = createEl("div", "mt-3.5 flex items-center justify-between rounded-xl border border-warn-line bg-white px-3.5 py-2.5 text-xs dark:border-[#3a413e] dark:bg-[#1b1f1e]");
    userRow.append(
      createEl("span", "text-muted dark:text-[#9aa7a1]", "User ID"),
      createEl("span", "font-bold", item.userId)
    );

    const compare = createEl("div", "mt-2.5 flex items-center gap-2.5");

    const beforeBox = createEl("div", "flex-1 rounded-xl bg-before-bg px-3.5 py-2.5 dark:bg-[#3a3118]");
    beforeBox.append(
      createEl("div", "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#c9b77a]", "Before"),
      createEl("div", "mt-1 text-sm font-bold", item.before)
    );

    const afterBox = createEl("div", "flex-1 rounded-xl bg-after-bg px-3.5 py-2.5 dark:bg-[#40201f]");
    afterBox.append(
      createEl("div", "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#e59a9d]", "Current page"),
      createEl("div", "mt-1 text-sm font-bold", item.current)
    );

    compare.append(beforeBox, createEl("span", "text-muted dark:text-[#9aa7a1]", "→"), afterBox);

    body.append(userRow, compare, createEl("p", "mt-4 text-xs text-muted dark:text-[#9aa7a1]", item.time));
    card.append(body);
    list.append(card);
  });
}

async function loadErrors() {
  renderErrors(await getErrors());
}

loadErrors();