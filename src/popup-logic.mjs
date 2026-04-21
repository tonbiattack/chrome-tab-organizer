const STORAGE_KEYS = {
  allWindows: "allWindows",
  collapseGroups: "collapseGroups",
  enabledRules: "enabledRules",
  customRules: "customRules",
};

const ALLOWED_COLORS = ["blue", "cyan", "green", "grey", "orange", "pink", "purple", "red", "yellow"];
const CUSTOM_RULES_EXPORT_VERSION = 1;

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

function sanitizeCustomRule(rule) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const name = String(rule.name ?? "").trim();
  const id = String(rule.id ?? "").trim();
  const rawType = rule.type;
  const type = rawType === "jira-keys" ? "jira-keys"
    : rawType === "google-doc-ids" ? "google-doc-ids"
    : rawType === "combined" ? "combined"
    : "url-pattern";
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

  if (type === "google-doc-ids") {
    const docIds = parseListInput((rule.docIds ?? []).join(","))
      .filter((docId) => /^[-_a-zA-Z0-9]{25,}$/.test(docId));

    if (docIds.length === 0) {
      return null;
    }

    return { id, name, type, color, enabled, docIds };
  }

  if (type === "combined") {
    const issueKeys = parseListInput((rule.issueKeys ?? []).join(","))
      .map((key) => key.toUpperCase())
      .filter((key) => /^[A-Z][A-Z0-9_]*-\d+$/.test(key));

    const docIds = parseListInput((rule.docIds ?? []).join(","))
      .filter((docId) => /^[-_a-zA-Z0-9]{25,}$/.test(docId));

    const patterns = parseListInput((rule.patterns ?? []).join("\n"));

    for (const pattern of patterns) {
      try {
        new RegExp(pattern, "i");
      } catch {
        return null;
      }
    }

    if (issueKeys.length === 0 && docIds.length === 0 && patterns.length === 0) {
      return null;
    }

    return { id, name, type, color, enabled, issueKeys, docIds, patterns };
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

  if (rule.type === "google-doc-ids") {
    return {
      name: rule.name,
      color: rule.color,
      patterns: rule.docIds.map((docId) => new RegExp(buildGoogleDocPattern(docId), "i")),
    };
  }

  if (rule.type === "combined") {
    return {
      name: rule.name,
      color: rule.color,
      patterns: [
        ...rule.issueKeys.map((issueKey) => new RegExp(buildJiraPattern(issueKey), "i")),
        ...rule.docIds.map((docId) => new RegExp(buildGoogleDocPattern(docId), "i")),
        ...(rule.patterns ?? []).map((pattern) => new RegExp(pattern, "i")),
      ],
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

  if (rule.type === "google-doc-ids") {
    return `Google Doc: ${rule.docIds.join(", ")}`;
  }

  if (rule.type === "combined") {
    const parts = [];
    if (rule.issueKeys.length > 0) parts.push(`Jira課題: ${rule.issueKeys.join(", ")}`);
    if (rule.docIds.length > 0) parts.push(`Google Doc: ${rule.docIds.join(", ")}`);
    if ((rule.patterns ?? []).length > 0) parts.push(rule.patterns.join(", "));
    return parts.join(" / ");
  }

  return rule.patterns.join(", ");
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

export {
  STORAGE_KEYS,
  ALLOWED_COLORS,
  CUSTOM_RULES_EXPORT_VERSION,
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
};
