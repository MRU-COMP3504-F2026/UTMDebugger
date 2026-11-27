import { a as database, i as readUTM, o as init_dbhelper, r as init_utm, t as UTM_PARAMETERS } from "./assets/utm-Cx-_hj0n.js";
//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region src/popup.js
init_dbhelper();
init_utm();
if (globalThis.chrome?.runtime?.id) chrome.runtime.connect({ name: "popup" });
async function currentPageURL() {
	if (!globalThis.chrome?.runtime?.id) return null;
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	return tab?.url ?? null;
}
function describeUTM(fields) {
	return Object.entries(UTM_PARAMETERS).filter(([, field]) => fields?.[field]).map(([parameter, field]) => `${parameter}=${fields[field]}`).join(", ");
}
function trackerState(name, requests, pageUTM) {
	if (!requests.length) return {
		name,
		description: "Not detected",
		status: "Missing"
	};
	const [latest] = requests;
	const reported = describeUTM(latest) || "no UTM values";
	const mismatched = Object.entries(pageUTM ?? {}).filter(([field, value]) => latest[field] !== value);
	if (mismatched.length) return {
		name,
		description: `Expected ${describeUTM(Object.fromEntries(mismatched))}, reported ${reported}`,
		status: "Error"
	};
	return {
		name,
		description: `Reported ${reported}`,
		status: "Healthy"
	};
}
async function loadTrackers(pageURL, pageUTM) {
	const trackingDomains = await database.list("trackingDomains");
	const history = await database.getRequestHistory(pageURL ? { pageURL } : {});
	return [...new Set(trackingDomains.map((trackingDomain) => trackingDomain.providerName))].map((name) => {
		return trackerState(name, Object.values(history).flatMap((providers) => providers[name] ?? []).sort((first, second) => second.timeStamp - first.timeStamp || second.id - first.id), pageUTM);
	});
}
var pageURL = await currentPageURL();
var pageUTM = pageURL ? readUTM(pageURL) : null;
if (pageURL) document.querySelector(".domain").textContent = new URL(pageURL).hostname;
var utmParameters = document.querySelector("#utm-parameters");
if (utmParameters && pageURL) utmParameters.textContent = pageUTM ? `Page UTM: ${describeUTM(pageUTM)}` : "This page has no UTM parameters.";
var trackers = await loadTrackers(pageURL, pageUTM);
var statusConfig = {
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
var trackerList = document.querySelector("#tracker-list");
var groupedTrackers = {
	Healthy: [],
	Error: [],
	Missing: []
};
trackers.forEach((tracker) => {
	if (groupedTrackers[tracker.status]) groupedTrackers[tracker.status].push(tracker);
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
var buttons = document.querySelectorAll(".nav-button");
var pages = document.querySelectorAll(".page");
buttons.forEach((button) => {
	button.addEventListener("click", () => {
		const targetPageId = button.dataset.target;
		pages.forEach((page) => {
			page.hidden = page.id !== targetPageId;
		});
		buttons.forEach((navButton) => {
			const isSelected = navButton === button;
			navButton.classList.toggle("active", isSelected);
			if (isSelected) navButton.setAttribute("aria-current", "page");
			else navButton.removeAttribute("aria-current");
		});
	});
});
function createEl(tag, className, text) {
	const node = document.createElement(tag);
	node.className = className;
	if (text) node.textContent = text;
	return node;
}
async function getErrors() {
	return [{
		title: "Hubspot source changed",
		message: "Hubspot recorded a different original source for this visitor than the one reported earlier.",
		userId: "hubspotutk_8f3a91c2",
		before: "Paid Search",
		current: "Direct Traffic",
		time: "Today at 10:15 AM"
	}];
}
function renderErrors(items) {
	const list = document.querySelector("#error-messages");
	list.replaceChildren();
	document.querySelector("#error-count").textContent = `${items.length} issue${items.length === 1 ? "" : "s"}`;
	if (items.length === 0) {
		list.append(createEl("p", "py-8 text-center text-[13px] text-muted dark:text-[#9aa7a1]", "No issues found."));
		return;
	}
	items.forEach((item) => {
		const card = createEl("article", "flex gap-3.5 rounded-2xl border border-warn-line bg-warn-bg p-5 text-black dark:border-[#5a4a1f] dark:bg-[#232826] dark:text-[#e8ecea]");
		card.append(createEl("div", "grid size-9 shrink-0 place-items-center rounded-full bg-warn-icon font-bold text-warn-ink dark:bg-[#4a3f1c] dark:text-[#f0d68a]", "!"));
		const body = createEl("div", "min-w-0 flex-1");
		body.append(createEl("h3", "text-sm font-bold", item.title), createEl("p", "mt-1.5 text-[13px] leading-normal text-muted dark:text-[#9aa7a1]", item.message));
		const userRow = createEl("div", "mt-3.5 flex items-center justify-between rounded-xl border border-warn-line bg-white px-3.5 py-2.5 text-xs dark:border-[#3a413e] dark:bg-[#1b1f1e]");
		userRow.append(createEl("span", "text-muted dark:text-[#9aa7a1]", "User ID"), createEl("span", "font-bold", item.userId));
		const compare = createEl("div", "mt-2.5 flex items-center gap-2.5");
		const beforeBox = createEl("div", "flex-1 rounded-xl bg-before-bg px-3.5 py-2.5 dark:bg-[#3a3118]");
		beforeBox.append(createEl("div", "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#c9b77a]", "Before"), createEl("div", "mt-1 text-sm font-bold", item.before));
		const afterBox = createEl("div", "flex-1 rounded-xl bg-after-bg px-3.5 py-2.5 dark:bg-[#40201f]");
		afterBox.append(createEl("div", "text-[10px] font-bold tracking-wide text-muted uppercase dark:text-[#e59a9d]", "Current page"), createEl("div", "mt-1 text-sm font-bold", item.current));
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
//#endregion
