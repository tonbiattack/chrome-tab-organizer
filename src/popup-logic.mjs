const STORAGE_KEYS = {
  allWindows: "allWindows",
  collapseGroups: "collapseGroups",
  enabledRules: "enabledRules",
  customRules: "customRules",
};

const ALLOWED_COLORS = ["blue", "cyan", "green", "grey", "orange", "pink", "purple", "red", "yellow"];
const CUSTOM_RULES_EXPORT_VERSION = 1;
const DEFAULT_COMMAND_SHORTCUTS = {
  "remove-duplicates": "Alt+Shift+D",
  "group-by-domain": "Alt+Shift+G",
  "ungroup-all-managed": "Alt+Shift+U",
};

function getDefaultSettings(groupRules) {
  return {
    [STORAGE_KEYS.allWindows]: false,
    [STORAGE_KEYS.collapseGroups]: false,
    [STORAGE_KEYS.enabledRules]: groupRules.map((rule) => rule.name),
    [STORAGE_KEYS.customRules]: [],
  };
}

function buildEnabledRuleNames(enabledRuleNames, groupRules) {
  const validRuleNames = new Set(groupRules.map((rule) => rule.name));
  const filteredNames = (enabledRuleNames ?? []).filter((name) => validRuleNames.has(name));
  return new Set(filteredNames);
}

function resolvePopupSettings(settings, groupRules) {
  const rawEnabledRules = settings[STORAGE_KEYS.enabledRules];
  const enabledRuleNames = buildEnabledRuleNames(rawEnabledRules, groupRules);

  return {
    allWindows: Boolean(settings[STORAGE_KEYS.allWindows]),
    collapseGroups: Boolean(settings[STORAGE_KEYS.collapseGroups]),
    enabledRuleNames: rawEnabledRules === undefined
      ? new Set(groupRules.map((rule) => rule.name))
      : enabledRuleNames,
    customRules: sanitizeCustomRules(settings[STORAGE_KEYS.customRules] ?? []),
  };
}

function buildEnabledRulesForSave(enabledRuleNames, groupRules) {
  return groupRules
    .map((rule) => rule.name)
    .filter((name) => enabledRuleNames.has(name));
}

function getActiveRules(groupRules, enabledRuleNames, customRules) {
  return [
    ...customRules.filter((rule) => rule.enabled).map(compileCustomRule),
    ...groupRules.filter((rule) => enabledRuleNames.has(rule.name)),
  ];
}

function getManagedRules(groupRules, customRules) {
  return [
    ...customRules.map(compileCustomRule),
    ...groupRules,
  ];
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

function buildGoogleDocPattern(docId) {
  const escapedId = escapeRegExp(docId);
  return `docs\\.google\\.com/(?:document|spreadsheets|presentation|forms|drawings)/d/${escapedId}(?:[/?#]|$)`;
}

function extractGoogleDocIds(url) {
  if (!url) {
    return [];
  }

  const matches = new Set();
  for (const match of url.matchAll(/docs\.google\.com\/(?:document|spreadsheets|presentation|forms|drawings)\/d\/([-_a-zA-Z0-9]{25,})/g)) {
    matches.add(match[1]);
  }

  return [...matches];
}

function mergeDocIds(currentValue, docIds) {
  const merged = new Set([
    ...parseListInput(currentValue),
    ...docIds,
  ]);
  return [...merged].join(", ");
}

function normalizeIssueKeys(value) {
  return parseListInput((value ?? []).join(","))
    .map((key) => key.toUpperCase())
    .filter((key) => /^[A-Z][A-Z0-9_]*-\d+$/.test(key));
}

function normalizeDocIds(value) {
  return parseListInput((value ?? []).join(","))
    .filter((docId) => /^[-_a-zA-Z0-9]{25,}$/.test(docId));
}

function normalizePatterns(value) {
  const patterns = parseListInput((value ?? []).join("\n"));

  for (const pattern of patterns) {
    try {
      new RegExp(pattern, "i");
    } catch {
      return null;
    }
  }

  return patterns;
}

function sanitizeCustomRule(rule) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const name = String(rule.name ?? "").trim();
  const id = String(rule.id ?? "").trim();
  const color = ALLOWED_COLORS.includes(rule.color) ? rule.color : "blue";
  const enabled = rule.enabled !== false;

  if (!id || !name) {
    return null;
  }

  let issueKeys = [];
  let docIds = [];
  let patterns = [];

  if (rule.type === "jira-keys") {
    issueKeys = normalizeIssueKeys(rule.issueKeys ?? []);
  } else if (rule.type === "google-doc-ids") {
    docIds = normalizeDocIds(rule.docIds ?? []);
  } else if (rule.type === "url-pattern") {
    patterns = normalizePatterns(rule.patterns ?? []);
  } else {
    issueKeys = normalizeIssueKeys(rule.issueKeys ?? []);
    docIds = normalizeDocIds(rule.docIds ?? []);
    patterns = normalizePatterns(rule.patterns ?? []);
  }

  if (!patterns) {
    return null;
  }

  if (issueKeys.length === 0 && docIds.length === 0 && patterns.length === 0) {
    return null;
  }

  return { id, name, color, enabled, issueKeys, docIds, patterns };
}

function sanitizeCustomRules(rules) {
  return rules
    .map(sanitizeCustomRule)
    .filter(Boolean);
}

function compileCustomRule(rule) {
  return {
    name: rule.name,
    color: rule.color,
    patterns: [
      ...(rule.issueKeys ?? []).map((issueKey) => new RegExp(buildJiraPattern(issueKey), "i")),
      ...(rule.docIds ?? []).map((docId) => new RegExp(buildGoogleDocPattern(docId), "i")),
      ...(rule.patterns ?? []).map((pattern) => new RegExp(pattern, "i")),
    ],
  };
}

function createPatternPreview(rule) {
  const parts = [];
  if ((rule.issueKeys ?? []).length > 0) parts.push(`Jira課題: ${rule.issueKeys.join(", ")}`);
  if ((rule.docIds ?? []).length > 0) parts.push(`Google Doc: ${rule.docIds.join(", ")}`);
  if ((rule.patterns ?? []).length > 0) parts.push(rule.patterns.join(", "));
  return parts.join(" / ");
}

function mergeIssueKeys(currentValue, issueKeys) {
  const merged = new Set([
    ...parseListInput(currentValue).map((key) => key.toUpperCase()),
    ...issueKeys.map((key) => key.toUpperCase()),
  ]);
  return [...merged].join(", ");
}

function serializeCustomRules(customRules) {
  return JSON.stringify({
    version: CUSTOM_RULES_EXPORT_VERSION,
    customRules,
  }, null, 2);
}

function parseImportedCustomRules(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("JSON形式が不正です");
  }

  const rawRules = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.customRules)
      ? parsed.customRules
      : null;

  if (!rawRules) {
    throw new Error("カスタムルールの形式ではありません");
  }

  const customRules = sanitizeCustomRules(rawRules);
  if (customRules.length === 0) {
    throw new Error("有効なカスタムルールが含まれていません");
  }

  return customRules;
}

function resolveCommandShortcuts(commands, fallbackShortcuts = DEFAULT_COMMAND_SHORTCUTS) {
  const shortcuts = {};

  for (const [commandName, fallbackShortcut] of Object.entries(fallbackShortcuts)) {
    const command = commands.find((item) => item.name === commandName);
    shortcuts[commandName] = command?.shortcut || fallbackShortcut || "未設定";
  }

  return shortcuts;
}

export {
  STORAGE_KEYS,
  ALLOWED_COLORS,
  CUSTOM_RULES_EXPORT_VERSION,
  DEFAULT_COMMAND_SHORTCUTS,
  getDefaultSettings,
  buildEnabledRuleNames,
  resolvePopupSettings,
  buildEnabledRulesForSave,
  getActiveRules,
  getManagedRules,
  escapeRegExp,
  parseListInput,
  buildJiraPattern,
  extractJiraIssueKeys,
  mergeIssueKeys,
  buildGoogleDocPattern,
  extractGoogleDocIds,
  mergeDocIds,
  sanitizeCustomRule,
  sanitizeCustomRules,
  compileCustomRule,
  createPatternPreview,
  serializeCustomRules,
  parseImportedCustomRules,
  resolveCommandShortcuts,
};
