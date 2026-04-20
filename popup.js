import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs } from "./src/tab-organizer.browser.js";

const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tabCount");
const ruleListEl = document.getElementById("ruleList");
const allWindowsEl = document.getElementById("allWindows");
const STORAGE_KEYS = {
  allWindows: "allWindows",
  enabledRules: "enabledRules",
};

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

let enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));

function showStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = "status";
  }, 3000);
}

function getDefaultSettings() {
  return {
    [STORAGE_KEYS.allWindows]: false,
    [STORAGE_KEYS.enabledRules]: GROUP_RULES.map((rule) => rule.name),
  };
}

function getActiveRules() {
  return GROUP_RULES.filter((rule) => enabledRuleNames.has(rule.name));
}

function getStorageArea() {
  return chrome?.storage?.local ?? null;
}

async function loadSettings() {
  const storage = getStorageArea();
  if (!storage) {
    allWindowsEl.checked = false;
    enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
    showStatus("設定保存が使えません。拡張を再読み込みしてください", "error");
    return;
  }

  const settings = await storage.get(getDefaultSettings());
  allWindowsEl.checked = Boolean(settings[STORAGE_KEYS.allWindows]);

  const validRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
  enabledRuleNames = new Set(
    (settings[STORAGE_KEYS.enabledRules] ?? []).filter((name) => validRuleNames.has(name))
  );

  if (enabledRuleNames.size === 0) {
    enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
  }
}

async function saveAllWindowsSetting() {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({ [STORAGE_KEYS.allWindows]: allWindowsEl.checked });
}

async function saveEnabledRules() {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({
    [STORAGE_KEYS.enabledRules]: GROUP_RULES
      .map((rule) => rule.name)
      .filter((name) => enabledRuleNames.has(name)),
  });
}

function renderRules() {
  ruleListEl.innerHTML = "";
  for (const rule of GROUP_RULES) {
    const item = document.createElement("div");
    item.className = "rule-item";

    const label = document.createElement("label");
    label.className = "rule-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = enabledRuleNames.has(rule.name);
    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) {
        enabledRuleNames.add(rule.name);
      } else if (enabledRuleNames.size === 1) {
        checkbox.checked = true;
        showStatus("少なくとも1つのルールを有効にしてください", "error");
        return;
      } else {
        enabledRuleNames.delete(rule.name);
      }

      await saveEnabledRules();
    });

    const dot = document.createElement("span");
    dot.className = "rule-dot";
    dot.style.background = RULE_COLORS[rule.color] ?? "#9ca3af";

    const text = document.createElement("span");
    text.className = "rule-text";

    const name = document.createElement("span");
    name.className = "rule-name";
    name.textContent = rule.name;

    const patterns = document.createElement("span");
    patterns.className = "rule-patterns";
    patterns.textContent = rule.patterns.map((pattern) => pattern.source).join(", ");

    text.appendChild(name);
    text.appendChild(patterns);
    label.appendChild(checkbox);
    label.appendChild(dot);
    label.appendChild(text);
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
  await loadSettings();
  await updateTabCount();
  renderRules();
}

allWindowsEl.addEventListener("change", async () => {
  await saveAllWindowsSetting();
  await updateTabCount();
});

document.getElementById("btnDedup").addEventListener("click", async () => {
  const tabs = await getTargetTabs();
  try {
    const { removed } = await removeDuplicateTabs(tabs);
    if (removed === 0) {
      showStatus("重複タブはありませんでした", "success");
    } else {
      showStatus(`${removed} 件の重複タブを削除しました`, "success");
    }
    await updateTabCount();
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

document.getElementById("btnSort").addEventListener("click", async () => {
  const activeRules = getActiveRules();
  if (activeRules.length === 0) {
    showStatus("有効なグループルールがありません", "error");
    return;
  }

  const tabs = await getTargetTabs();
  const windowsMap = groupTabsByWindow(tabs);
  try {
    let totalGroups = 0;
    for (const [windowId, windowTabs] of windowsMap) {
      const { groupCount } = await sortAndGroupTabs(windowTabs, windowId, activeRules);
      totalGroups += groupCount;
    }
    if (windowsMap.size > 1) {
      showStatus(`${windowsMap.size} ウィンドウを ${totalGroups} グループに整理しました`, "success");
    } else {
      showStatus(`${totalGroups} グループに整理しました`, "success");
    }
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

init();
