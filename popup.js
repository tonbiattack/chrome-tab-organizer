import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs } from "./src/tab-organizer.browser.js";

const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tabCount");
const ruleListEl = document.getElementById("ruleList");
const allWindowsEl = document.getElementById("allWindows");
const customRuleListEl = document.getElementById("customRuleList");
const customRuleFormEl = document.getElementById("customRuleForm");
const customRuleNameEl = document.getElementById("customRuleName");
const customRuleColorEl = document.getElementById("customRuleColor");
const customRuleTypeEl = document.getElementById("customRuleType");
const customRulePatternsEl = document.getElementById("customRulePatterns");
const customRuleKeysEl = document.getElementById("customRuleKeys");
const customPatternFieldsEl = document.getElementById("customPatternFields");
const customJiraFieldsEl = document.getElementById("customJiraFields");
const fillJiraKeysEl = document.getElementById("fillJiraKeys");
const STORAGE_KEYS = {
  allWindows: "allWindows",
  enabledRules: "enabledRules",
  customRules: "customRules",
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

const ALLOWED_COLORS = ["blue", "cyan", "green", "grey", "orange", "pink", "purple", "red", "yellow"];

let enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
let customRules = [];

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
    [STORAGE_KEYS.customRules]: [],
  };
}

function getActiveRules() {
  return [
    ...customRules.filter((rule) => rule.enabled).map(compileCustomRule),
    ...GROUP_RULES.filter((rule) => enabledRuleNames.has(rule.name)),
  ];
}

function getStorageArea() {
  return chrome?.storage?.local ?? null;
}

async function loadSettings() {
  const storage = getStorageArea();
  if (!storage) {
    allWindowsEl.checked = false;
    enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
    customRules = [];
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

  customRules = sanitizeCustomRules(settings[STORAGE_KEYS.customRules] ?? []);
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

async function saveCustomRules() {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({ [STORAGE_KEYS.customRules]: customRules });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseListInput(value) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildJiraPattern(issueKey) {
  const escapedKey = escapeRegExp(issueKey.toUpperCase());
  return `(?:/browse/|[?&]selectedIssue=)${escapedKey}(?:[/?#&]|$)`;
}

function extractJiraIssueKeys(url) {
  if (!url) {
    return [];
  }

  const matches = new Set();

  for (const match of url.matchAll(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/gi)) {
    matches.add(match[1].toUpperCase());
  }

  try {
    const parsedUrl = new URL(url);
    const selectedIssue = parsedUrl.searchParams.get("selectedIssue");
    if (selectedIssue && /^[A-Z][A-Z0-9_]*-\d+$/i.test(selectedIssue)) {
      matches.add(selectedIssue.toUpperCase());
    }
  } catch {
    // URLとして解釈できない場合は browse パスの抽出結果だけ使う
  }

  return [...matches];
}

function sanitizeCustomRule(rule) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const name = String(rule.name ?? "").trim();
  const id = String(rule.id ?? "").trim();
  const type = rule.type === "jira-keys" ? "jira-keys" : "url-pattern";
  const color = ALLOWED_COLORS.includes(rule.color) ? rule.color : "blue";
  const enabled = rule.enabled !== false;

  if (!id || !name) {
    return null;
  }

  if (type === "jira-keys") {
    const issueKeys = parseListInput((rule.issueKeys ?? []).join(","))
      .map((key) => key.toUpperCase())
      .filter((key) => /^[A-Z][A-Z0-9_]*-\d+$/.test(key));

    if (issueKeys.length === 0) {
      return null;
    }

    return { id, name, type, color, enabled, issueKeys };
  }

  const patterns = parseListInput((rule.patterns ?? []).join("\n"));
  if (patterns.length === 0) {
    return null;
  }

  for (const pattern of patterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      return null;
    }
  }

  return { id, name, type, color, enabled, patterns };
}

function sanitizeCustomRules(rules) {
  return rules
    .map(sanitizeCustomRule)
    .filter(Boolean);
}

function compileCustomRule(rule) {
  if (rule.type === "jira-keys") {
    return {
      name: rule.name,
      color: rule.color,
      patterns: rule.issueKeys.map((issueKey) => new RegExp(buildJiraPattern(issueKey), "i")),
    };
  }

  return {
    name: rule.name,
    color: rule.color,
    patterns: rule.patterns.map((pattern) => new RegExp(pattern, "i")),
  };
}

function createPatternPreview(rule) {
  if (rule.type === "jira-keys") {
    return `Jira課題: ${rule.issueKeys.join(", ")}`;
  }

  return rule.patterns.join(", ");
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

function renderCustomRules() {
  customRuleListEl.innerHTML = "";

  if (customRules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "カスタムルールはまだありません";
    customRuleListEl.appendChild(empty);
    return;
  }

  for (const rule of customRules) {
    const item = document.createElement("div");
    item.className = "rule-item custom-rule-item";

    const label = document.createElement("label");
    label.className = "rule-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = rule.enabled;
    checkbox.addEventListener("change", async () => {
      rule.enabled = checkbox.checked;
      await saveCustomRules();
    });

    const dot = document.createElement("span");
    dot.className = "rule-dot";
    dot.style.background = RULE_COLORS[rule.color] ?? "#9ca3af";

    const text = document.createElement("span");
    text.className = "rule-text";

    const name = document.createElement("span");
    name.className = "rule-name";
    name.textContent = rule.name;

    const meta = document.createElement("span");
    meta.className = "rule-patterns";
    meta.textContent = createPatternPreview(rule);

    text.appendChild(name);
    text.appendChild(meta);
    label.appendChild(checkbox);
    label.appendChild(dot);
    label.appendChild(text);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "rule-delete";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", async () => {
      customRules = customRules.filter((customRule) => customRule.id !== rule.id);
      await saveCustomRules();
      renderCustomRules();
    });

    item.appendChild(label);
    item.appendChild(deleteButton);
    customRuleListEl.appendChild(item);
  }
}

function syncCustomRuleTypeFields() {
  const isJiraMode = customRuleTypeEl.value === "jira-keys";
  customPatternFieldsEl.hidden = isJiraMode;
  customJiraFieldsEl.hidden = !isJiraMode;
}

function resetCustomRuleForm() {
  customRuleFormEl.reset();
  customRuleColorEl.value = "blue";
  customRuleTypeEl.value = "jira-keys";
  syncCustomRuleTypeFields();
}

function buildCustomRuleFromForm() {
  const name = customRuleNameEl.value.trim();
  if (!name) {
    throw new Error("グループ名を入力してください");
  }

  const color = customRuleColorEl.value;
  if (!ALLOWED_COLORS.includes(color)) {
    throw new Error("使用できない色です");
  }

  const type = customRuleTypeEl.value;
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
    enabled: true,
  };

  if (type === "jira-keys") {
    const issueKeys = parseListInput(customRuleKeysEl.value)
      .map((key) => key.toUpperCase())
      .filter((key) => /^[A-Z][A-Z0-9_]*-\d+$/.test(key));

    if (issueKeys.length === 0) {
      throw new Error("Jira課題キーを1件以上入力してください");
    }

    return { ...base, type, issueKeys };
  }

  const patterns = parseListInput(customRulePatternsEl.value);
  if (patterns.length === 0) {
    throw new Error("URLパターンを1件以上入力してください");
  }

  for (const pattern of patterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      throw new Error(`無効な正規表現です: ${pattern}`);
    }
  }

  return { ...base, type, patterns };
}

function mergeIssueKeysIntoField(issueKeys) {
  const merged = new Set([
    ...parseListInput(customRuleKeysEl.value).map((key) => key.toUpperCase()),
    ...issueKeys.map((key) => key.toUpperCase()),
  ]);

  customRuleKeysEl.value = [...merged].join(", ");
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
  renderCustomRules();
  resetCustomRuleForm();
}

allWindowsEl.addEventListener("change", async () => {
  await saveAllWindowsSetting();
  await updateTabCount();
});

customRuleTypeEl.addEventListener("change", syncCustomRuleTypeFields);

customRuleFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const customRule = buildCustomRuleFromForm();
    if (customRules.some((rule) => rule.name === customRule.name)) {
      throw new Error("同じグループ名のカスタムルールは追加できません");
    }
    customRules.push(customRule);
    await saveCustomRules();
    renderCustomRules();
    resetCustomRuleForm();
    showStatus(`カスタムルール「${customRule.name}」を追加しました`, "success");
  } catch (error) {
    showStatus(`エラー: ${error.message}`, "error");
  }
});

fillJiraKeysEl.addEventListener("click", async () => {
  try {
    const tabs = await getTargetTabs();
    const issueKeys = [...new Set(tabs.flatMap((tab) => extractJiraIssueKeys(tab.url)))];

    if (issueKeys.length === 0) {
      showStatus("現在の対象タブから Jira 課題キーを見つけられませんでした", "error");
      return;
    }

    mergeIssueKeysIntoField(issueKeys);
    customRuleTypeEl.value = "jira-keys";
    syncCustomRuleTypeFields();
    showStatus(`${issueKeys.length} 件の Jira 課題キーを入力欄に追加しました`, "success");
  } catch (error) {
    showStatus(`エラー: ${error.message}`, "error");
  }
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
