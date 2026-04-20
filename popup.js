import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs } from "./src/tab-organizer.browser.js";

const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tabCount");
const ruleListEl = document.getElementById("ruleList");

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

async function getCurrentWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

async function init() {
  const tabs = await getCurrentWindowTabs();
  tabCountEl.textContent = `${tabs.length} タブ`;
  renderRules();
}

document.getElementById("btnDedup").addEventListener("click", async () => {
  const tabs = await getCurrentWindowTabs();
  try {
    const { removed } = await removeDuplicateTabs(tabs);
    if (removed === 0) {
      showStatus("重複タブはありませんでした", "success");
    } else {
      showStatus(`${removed} 件の重複タブを削除しました`, "success");
    }
    const updated = await getCurrentWindowTabs();
    tabCountEl.textContent = `${updated.length} タブ`;
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

document.getElementById("btnSort").addEventListener("click", async () => {
  const tabs = await getCurrentWindowTabs();
  const windowId = tabs[0]?.windowId;
  if (!windowId) return;
  try {
    const { groupCount } = await sortAndGroupTabs(tabs, windowId);
    showStatus(`${groupCount} グループに整理しました`, "success");
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

init();
