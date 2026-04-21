import groupRulesData from "./group-rules.json" with { type: "json" };

const GROUP_RULES = groupRulesData.map((rule) => ({
  ...rule,
  patterns: rule.patterns.map((pattern) => new RegExp(pattern, "i")),
}));

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function matchGroup(url, groupRules = GROUP_RULES) {
  for (const rule of groupRules) {
    if (rule.patterns.some((p) => p.test(url))) {
      return rule;
    }
  }
  return null;
}

function getRuleNames(groupRules) {
  return new Set(groupRules.map((r) => r.name));
}

async function removeDuplicateTabs(tabs) {
  const seen = new Map();
  const toClose = [];
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) continue;
    const normalized = normalizeUrl(tab.url);
    if (seen.has(normalized)) {
      toClose.push(tab.id);
    } else {
      seen.set(normalized, tab.id);
    }
  }
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  return { removed: toClose.length };
}

async function sortAndGroupTabs(tabs, windowId, groupRules = GROUP_RULES, { collapsed = false } = {}) {
  const filteredTabs = tabs.filter(
    (t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://")
  );

  const ruleNames = getRuleNames(groupRules);
  const existingGroups = await chrome.tabGroups.query({ windowId });
  const manualGroupTabIds = new Set(
    filteredTabs
      .filter((t) => t.groupId !== -1 && existingGroups.some((g) => g.id === t.groupId && !ruleNames.has(g.title)))
      .map((t) => t.id)
  );

  const groups = new Map();
  const others = [];
  for (const tab of filteredTabs) {
    if (manualGroupTabIds.has(tab.id)) continue;
    const rule = matchGroup(tab.url, groupRules);
    if (rule) {
      if (!groups.has(rule.name)) groups.set(rule.name, { rule, tabs: [] });
      groups.get(rule.name).tabs.push(tab);
    } else {
      others.push(tab);
    }
  }

  let index = 0;
  for (const [, { tabs: groupTabs }] of groups) {
    for (const tab of groupTabs) { await chrome.tabs.move(tab.id, { index }); index++; }
  }
  for (const tab of others) { await chrome.tabs.move(tab.id, { index }); index++; }

  for (const group of existingGroups) {
    if (ruleNames.has(group.title)) {
      const tabIds = filteredTabs.filter((t) => t.groupId === group.id).map((t) => t.id);
      if (tabIds.length > 0) await chrome.tabs.ungroup(tabIds);
    }
  }

  const updatedTabs = await chrome.tabs.query({ windowId });
  const tabById = new Map(updatedTabs.map((t) => [t.id, t]));
  let groupCount = 0;
  for (const [, { rule, tabs: groupTabs }] of groups) {
    if (groupTabs.length === 0) continue;
    const tabIds = groupTabs.map((t) => t.id).filter((id) => tabById.has(id));
    if (tabIds.length === 0) continue;
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { title: rule.name, color: rule.color, collapsed });
    groupCount++;
  }
  return { groupCount };
}

async function ungroupAllTabs(allWindows, groupRules = GROUP_RULES) {
  const tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  const groups = await chrome.tabGroups.query(allWindows ? {} : { windowId: chrome.windows.WINDOW_ID_CURRENT });
  const ruleNames = getRuleNames(groupRules);
  const managedGroupIds = groups.filter((g) => ruleNames.has(g.title)).map((g) => g.id);
  for (const groupId of managedGroupIds) {
    const tabIds = tabs.filter((t) => t.groupId === groupId).map((t) => t.id);
    if (tabIds.length > 0) await chrome.tabs.ungroup(tabIds);
  }
  return { ungrouped: managedGroupIds.length };
}

async function ungroupAllTabsForce(allWindows) {
  const tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  const grouped = tabs.filter((t) => t.groupId !== -1);
  if (grouped.length > 0) {
    await chrome.tabs.ungroup(grouped.map((t) => t.id));
  }
  return { ungrouped: grouped.length };
}

export { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs, ungroupAllTabs, ungroupAllTabsForce };
