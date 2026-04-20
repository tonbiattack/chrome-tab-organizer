import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs, mergeWindowsToLimit } from "./src/tab-organizer.browser.js";

const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tabCount");
const ruleListEl = document.getElementById("ruleList");
const allWindowsEl = document.getElementById("allWindows");
const maxWindowsRowEl = document.getElementById("maxWindowsRow");
const enableMaxWindowsEl = document.getElementById("enableMaxWindows");
const maxWindowsInputEl = document.getElementById("maxWindowsInput");
const maxWindowsCountEl = document.getElementById("maxWindowsCount");

const RULE_COLORS = {
  blue: "#3b82f6",
  purple: "#a855f7",
  yellow: "#eab308",
  grey: "#6b7280",
  green: "#22c55e",
  teal: "#14b8a6",
  red: "#ef4444",
  orange: "#f97316",
  pink: "#ec4899",
  cyan: "#06b6d4",
};

function showStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = "status";
  }, 3000);
}

function renderRules() {
  ruleListEl.innerHTML = "";
  for (const rule of GROUP_RULES) {
    const item = document.createElement("div");
    item.className = "rule-item";

    const dot = document.createElement("span");
    dot.className = "rule-dot";
    dot.style.background = RULE_COLORS[rule.color] ?? "#9ca3af";

    const label = document.createElement("span");
    label.textContent = `${rule.name} — ${rule.patterns.map((p) => p.source).join(", ")}`;

    item.appendChild(dot);
    item.appendChild(label);
    ruleListEl.appendChild(item);
  }
}

async function getTargetTabs() {
  return chrome.tabs.query(allWindowsEl.checked ? {} : { currentWindow: true });
}

function groupTabsByWindow(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    if (!map.has(tab.windowId)) map.set(tab.windowId, []);
    map.get(tab.windowId).push(tab);
  }
  return map;
}

async function updateTabCount() {
  const tabs = await getTargetTabs();
  if (allWindowsEl.checked) {
    const windowCount = new Set(tabs.map((t) => t.windowId)).size;
    tabCountEl.textContent = `${tabs.length} タブ (${windowCount} ウィンドウ)`;
  } else {
    tabCountEl.textContent = `${tabs.length} タブ`;
  }
}

async function init() {
  await updateTabCount();
  renderRules();
}

allWindowsEl.addEventListener("change", () => {
  maxWindowsRowEl.style.display = allWindowsEl.checked ? "" : "none";
  if (!allWindowsEl.checked) {
    enableMaxWindowsEl.checked = false;
    maxWindowsInputEl.style.display = "none";
  }
  updateTabCount();
});

enableMaxWindowsEl.addEventListener("change", () => {
  maxWindowsInputEl.style.display = enableMaxWindowsEl.checked ? "" : "none";
});

async function applyWindowLimit() {
  if (!allWindowsEl.checked || !enableMaxWindowsEl.checked) return null;
  const max = parseInt(maxWindowsCountEl.value, 10);
  if (!max || max < 1) return null;
  return mergeWindowsToLimit(max);
}

document.getElementById("btnDedup").addEventListener("click", async () => {
  try {
    const windowResult = await applyWindowLimit();
    const tabs = await getTargetTabs();
    const { removed } = await removeDuplicateTabs(tabs);

    const parts = [];
    if (windowResult && windowResult.merged > 0) parts.push(`${windowResult.merged} ウィンドウを統合`);
    if (removed > 0) parts.push(`${removed} 件の重複タブを削除`);
    showStatus(parts.length ? parts.join("、") + "しました" : "重複タブはありませんでした", "success");
    await updateTabCount();
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

document.getElementById("btnSort").addEventListener("click", async () => {
  try {
    const windowResult = await applyWindowLimit();
    const tabs = await getTargetTabs();
    const windowsMap = groupTabsByWindow(tabs);
    let totalGroups = 0;
    for (const [windowId, windowTabs] of windowsMap) {
      const { groupCount } = await sortAndGroupTabs(windowTabs, windowId);
      totalGroups += groupCount;
    }

    const parts = [];
    if (windowResult && windowResult.merged > 0) parts.push(`${windowResult.merged} ウィンドウを統合`);
    parts.push(`${totalGroups} グループに整理`);
    showStatus(parts.join("、") + "しました", "success");
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

init();
