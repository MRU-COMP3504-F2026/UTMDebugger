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

    const chip = document.createElement("span");
    chip.className = "tracker-chip";
    chip.textContent = config.chip;

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