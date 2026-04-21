import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs, ungroupAllTabs } from "./src/tab-organizer.browser.js";
import {
  STORAGE_KEYS,
  ALLOWED_COLORS,
  getDefaultSettings,
  resolvePopupSettings,
  buildEnabledRulesForSave,
  getActiveRules as getActiveRulesFromState,
  getManagedRules as getManagedRulesFromState,
  extractJiraIssueKeys,
  mergeIssueKeys,
  extractGoogleDocIds,
  mergeDocIds,
  createPatternPreview,
  parseListInput,
  serializeCustomRules,
  parseImportedCustomRules,
  resolveCommandShortcuts,
} from "./src/popup-logic.mjs";

const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tabCount");
const btnDedupEl = document.getElementById("btnDedup");
const btnSortEl = document.getElementById("btnSort");
const btnUngroupAllEl = document.getElementById("btnUngroupAll");
const btnUngroupDefaultOnlyEl = document.getElementById("btnUngroupDefaultOnly");
const shortcutRemoveDuplicatesEl = document.getElementById("shortcutRemoveDuplicates");
const shortcutGroupByDomainEl = document.getElementById("shortcutGroupByDomain");
const shortcutUngroupAllEl = document.getElementById("shortcutUngroupAll");
const ruleListEl = document.getElementById("ruleList");
const allWindowsEl = document.getElementById("allWindows");
const collapseGroupsEl = document.getElementById("collapseGroups");
const customRuleListEl = document.getElementById("customRuleList");
const customRuleFormEl = document.getElementById("customRuleForm");
const customRuleNameEl = document.getElementById("customRuleName");
const customRuleColorPaletteEl = document.getElementById("customRuleColorPalette");
const customRuleColorEl = document.getElementById("customRuleColor");
const customRulePatternsEl = document.getElementById("customRulePatterns");
const customRuleKeysEl = document.getElementById("customRuleKeys");
const customRuleDocIdsEl = document.getElementById("customRuleDocIds");
const fillJiraKeysEl = document.getElementById("fillJiraKeys");
const fillGoogleDocIdsEl = document.getElementById("fillGoogleDocIds");
const formTitleEl = document.getElementById("formTitle");
const customRuleSubmitEl = document.getElementById("customRuleSubmit");
const cancelRuleEditEl = document.getElementById("cancelRuleEdit");
const btnExportCustomRulesEl = document.getElementById("btnExportCustomRules");
const btnImportCustomRulesEl = document.getElementById("btnImportCustomRules");
const customRulesImportFileEl = document.getElementById("customRulesImportFile");
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
const COLOR_LABELS = {
  blue: "Blue",
  cyan: "Cyan",
  green: "Green",
  grey: "Grey",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  red: "Red",
  yellow: "Yellow",
};

let enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
let customRules = [];
let editingRuleId = null;

function showStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = "status";
  }, 3000);
}

function getActiveRules() {
  return getActiveRulesFromState(GROUP_RULES, enabledRuleNames, customRules);
}

function getManagedRules() {
  return getManagedRulesFromState(GROUP_RULES, customRules);
}

function getDefaultRulesExcludingCustomNames() {
  const customRuleNames = new Set(customRules.map((rule) => rule.name));
  return GROUP_RULES.filter((rule) => !customRuleNames.has(rule.name));
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

  const settings = await storage.get(getDefaultSettings(GROUP_RULES));
  const resolvedSettings = resolvePopupSettings(settings, GROUP_RULES);
  allWindowsEl.checked = resolvedSettings.allWindows;
  collapseGroupsEl.checked = resolvedSettings.collapseGroups;
  enabledRuleNames = resolvedSettings.enabledRuleNames;
  customRules = resolvedSettings.customRules;
}

async function saveAllWindowsSetting() {
  const storage = getStorageArea();
  if (!storage) return;
  await storage.set({ [STORAGE_KEYS.allWindows]: allWindowsEl.checked });
}

async function saveCollapseGroupsSetting() {
  const storage = getStorageArea();
  if (!storage) return;
  await storage.set({ [STORAGE_KEYS.collapseGroups]: collapseGroupsEl.checked });
}

async function saveEnabledRules() {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({
    [STORAGE_KEYS.enabledRules]: buildEnabledRulesForSave(enabledRuleNames, GROUP_RULES),
  });
}

async function saveCustomRules() {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await storage.set({ [STORAGE_KEYS.customRules]: customRules });
}

function downloadTextFile(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "rule-edit";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      populateFormWithRule(rule);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "rule-delete";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", async () => {
      if (editingRuleId === rule.id) resetCustomRuleForm();
      customRules = customRules.filter((customRule) => customRule.id !== rule.id);
      await saveCustomRules();
      renderCustomRules();
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    item.appendChild(label);
    item.appendChild(actions);
    customRuleListEl.appendChild(item);
  }
}

function setSelectedCustomRuleColor(color) {
  const selectedColor = ALLOWED_COLORS.includes(color) ? color : "blue";
  customRuleColorEl.value = selectedColor;

  const colorButtons = customRuleColorPaletteEl.querySelectorAll(".color-chip");
  for (const button of colorButtons) {
    const isSelected = button.dataset.color === selectedColor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
  }
}

function renderColorPalette() {
  customRuleColorPaletteEl.innerHTML = "";

  for (const color of ALLOWED_COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-chip";
    button.dataset.color = color;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", `${COLOR_LABELS[color] ?? color} を選択`);

    const swatch = document.createElement("span");
    swatch.className = "color-chip-swatch";
    swatch.style.background = RULE_COLORS[color] ?? "#9ca3af";

    const label = document.createElement("span");
    label.textContent = COLOR_LABELS[color] ?? color;

    button.appendChild(swatch);
    button.appendChild(label);
    button.addEventListener("click", () => {
      setSelectedCustomRuleColor(color);
    });

    customRuleColorPaletteEl.appendChild(button);
  }

  setSelectedCustomRuleColor(customRuleColorEl.value || "blue");
}

function resetCustomRuleForm() {
  customRuleFormEl.reset();
  setSelectedCustomRuleColor("blue");
  editingRuleId = null;
  formTitleEl.textContent = "ルール追加";
  customRuleSubmitEl.textContent = "カスタムルールを追加";
  cancelRuleEditEl.hidden = true;
}

function populateFormWithRule(rule) {
  editingRuleId = rule.id;
  customRuleNameEl.value = rule.name;
  setSelectedCustomRuleColor(rule.color);
  customRuleKeysEl.value = (rule.issueKeys ?? []).join(", ");
  customRuleDocIdsEl.value = (rule.docIds ?? []).join(", ");
  customRulePatternsEl.value = (rule.patterns ?? []).join("\n");

  formTitleEl.textContent = "ルール編集";
  customRuleSubmitEl.textContent = "カスタムルールを更新";
  cancelRuleEditEl.hidden = false;
  customRuleFormEl.scrollIntoView({ behavior: "smooth" });
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

  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
    enabled: true,
  };

  const issueKeys = parseListInput(customRuleKeysEl.value)
    .map((key) => key.toUpperCase())
    .filter((key) => /^[A-Z][A-Z0-9_]*-\d+$/.test(key));

  const docIds = parseListInput(customRuleDocIdsEl.value)
    .filter((id) => /^[-_a-zA-Z0-9]{25,}$/.test(id));

  const patterns = parseListInput(customRulePatternsEl.value);

  for (const pattern of patterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      throw new Error(`無効な正規表現です: ${pattern}`);
    }
  }

  if (issueKeys.length === 0 && docIds.length === 0 && patterns.length === 0) {
    throw new Error("Jira課題キー、Google Doc ID、またはURLパターンを1件以上入力してください");
  }

  return { ...base, issueKeys, docIds, patterns };
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

async function renderCommandShortcuts() {
  if (!chrome?.commands?.getAll) {
    return;
  }

  const shortcuts = resolveCommandShortcuts(await chrome.commands.getAll());
  const shortcutElements = {
    "remove-duplicates": shortcutRemoveDuplicatesEl,
    "group-by-domain": shortcutGroupByDomainEl,
    "ungroup-all-managed": shortcutUngroupAllEl,
  };

  for (const [commandName, element] of Object.entries(shortcutElements)) {
    const shortcut = shortcuts[commandName];
    if (!shortcut) {
      element.hidden = true;
      continue;
    }

    element.textContent = shortcut;
    element.hidden = false;
  }
}

async function init() {
  await loadSettings();
  await updateTabCount();
  await renderCommandShortcuts();
  renderColorPalette();
  renderRules();
  renderCustomRules();
  resetCustomRuleForm();
}

allWindowsEl.addEventListener("change", async () => {
  await saveAllWindowsSetting();
  await updateTabCount();
});

collapseGroupsEl.addEventListener("change", saveCollapseGroupsSetting);

btnUngroupAllEl.addEventListener("click", async () => {
  try {
    const { ungrouped, removedBookmarkGroups } = await ungroupAllTabs(allWindowsEl.checked, getManagedRules());
    const total = ungrouped + removedBookmarkGroups;
    if (total === 0) {
      showStatus("解除するグループはありませんでした", "success");
    } else {
      showStatus(`${total} 件のグループを解除しました`, "success");
    }
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

btnUngroupDefaultOnlyEl.addEventListener("click", async () => {
  try {
    const defaultRules = getDefaultRulesExcludingCustomNames();
    const { ungrouped, removedBookmarkGroups } = await ungroupAllTabs(allWindowsEl.checked, defaultRules);
    const total = ungrouped + removedBookmarkGroups;
    if (total === 0) {
      showStatus("解除する標準ルールのグループはありませんでした", "success");
    } else {
      showStatus(`${total} 件の標準ルールグループを解除しました`, "success");
    }
  } catch (e) {
    showStatus(`エラー: ${e.message}`, "error");
  }
});

document.getElementById("btnCheckAll").addEventListener("click", async () => {
  enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));
  await saveEnabledRules();
  renderRules();
});

document.getElementById("btnUncheckAll").addEventListener("click", async () => {
  enabledRuleNames = new Set();
  await saveEnabledRules();
  renderRules();
});

cancelRuleEditEl.addEventListener("click", resetCustomRuleForm);

btnExportCustomRulesEl.addEventListener("click", () => {
  if (customRules.length === 0) {
    showStatus("エクスポートするカスタムルールがありません", "error");
    return;
  }

  const content = serializeCustomRules(customRules);
  downloadTextFile("tab-organizer-custom-rules.json", content);
  showStatus(`${customRules.length} 件のカスタムルールをエクスポートしました`, "success");
});

btnImportCustomRulesEl.addEventListener("click", () => {
  customRulesImportFileEl.click();
});

customRulesImportFileEl.addEventListener("change", async () => {
  const [file] = customRulesImportFileEl.files ?? [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const importedRules = parseImportedCustomRules(text);
    customRules = importedRules;
    if (editingRuleId && !customRules.some((rule) => rule.id === editingRuleId)) {
      resetCustomRuleForm();
    }
    await saveCustomRules();
    renderCustomRules();
    showStatus(`${customRules.length} 件のカスタムルールをインポートしました`, "success");
  } catch (error) {
    showStatus(`エラー: ${error.message}`, "error");
  } finally {
    customRulesImportFileEl.value = "";
  }
});

customRuleFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const customRule = buildCustomRuleFromForm();

    if (editingRuleId) {
      const index = customRules.findIndex((r) => r.id === editingRuleId);
      if (index === -1) throw new Error("編集対象のルールが見つかりませんでした");
      if (customRules.some((r) => r.name === customRule.name && r.id !== editingRuleId)) {
        throw new Error("同じグループ名のカスタムルールは追加できません");
      }
      customRules[index] = { ...customRule, id: editingRuleId, enabled: customRules[index].enabled };
      await saveCustomRules();
      renderCustomRules();
      resetCustomRuleForm();
      showStatus(`カスタムルール「${customRule.name}」を更新しました`, "success");
    } else {
      if (customRules.some((rule) => rule.name === customRule.name)) {
        throw new Error("同じグループ名のカスタムルールは追加できません");
      }
      customRules.push(customRule);
      await saveCustomRules();
      renderCustomRules();
      resetCustomRuleForm();
      showStatus(`カスタムルール「${customRule.name}」を追加しました`, "success");
    }
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

    customRuleKeysEl.value = mergeIssueKeys(customRuleKeysEl.value, issueKeys);
    showStatus(`${issueKeys.length} 件の Jira 課題キーを入力欄に追加しました`, "success");
  } catch (error) {
    showStatus(`エラー: ${error.message}`, "error");
  }
});

fillGoogleDocIdsEl.addEventListener("click", async () => {
  try {
    const tabs = await getTargetTabs();
    const docIds = [...new Set(tabs.flatMap((tab) => extractGoogleDocIds(tab.url)))];

    if (docIds.length === 0) {
      showStatus("現在の対象タブから Google Doc ID を見つけられませんでした", "error");
      return;
    }

    customRuleDocIdsEl.value = mergeDocIds(customRuleDocIdsEl.value, docIds);
    showStatus(`${docIds.length} 件の Google Doc ID を入力欄に追加しました`, "success");
  } catch (error) {
    showStatus(`エラー: ${error.message}`, "error");
  }
});

btnDedupEl.addEventListener("click", async () => {
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

btnSortEl.addEventListener("click", async () => {
  const activeRules = getActiveRules();
  const tabs = await getTargetTabs();
  const windowsMap = groupTabsByWindow(tabs);
  try {
    let totalGroups = 0;
    const collapsed = collapseGroupsEl.checked;
    for (const [windowId, windowTabs] of windowsMap) {
      const { groupCount } = await sortAndGroupTabs(windowTabs, windowId, activeRules, { collapsed });
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
