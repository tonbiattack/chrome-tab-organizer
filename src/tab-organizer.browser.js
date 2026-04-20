const GROUP_RULES = [
  { name: "Confluence", color: "cyan",   patterns: [/confluence\./i, /atlassian\.net\/wiki/i] },
  { name: "Jira",       color: "blue",   patterns: [/jira\./i, /atlassian\.net/i] },
  { name: "GitHub",  color: "purple", patterns: [/github\.com/i] },
  { name: "Slack",   color: "yellow", patterns: [/app\.slack\.com/i] },
  { name: "Notion",  color: "grey",   patterns: [/notion\.so/i] },
  { name: "Google",  color: "green",  patterns: [/google\.com/i, /docs\.google\.com/i, /drive\.google\.com/i] },
  { name: "ChatGPT", color: "cyan",   patterns: [/chatgpt\.com/i, /chat\.openai\.com/i] },
  { name: "Qiita",   color: "green",  patterns: [/qiita\.com/i] },
  { name: "Zenn",    color: "blue",   patterns: [/zenn\.dev/i] },
  { name: "Amazon",  color: "orange", patterns: [/amazon\.co\.jp/i, /amazon\.com/i, /amzn\.to/i] },
  { name: "YouTube", color: "red",    patterns: [/youtube\.com/i, /youtu\.be/i] },
];

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

async function removeDuplicateTabs(tabs) {
  const seen = new Map();
  const toClose = [];

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      continue;
    }
    const normalized = normalizeUrl(tab.url);
    if (seen.has(normalized)) {
      toClose.push(tab.id);
    } else {
      seen.set(normalized, tab.id);
    }
  }

  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
  }

  return { removed: toClose.length, kept: seen.size };
}

async function sortAndGroupTabs(tabs, windowId, groupRules = GROUP_RULES, { collapsed = false } = {}) {
  const filteredTabs = tabs.filter(
    (t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://")
  );

  const groups = new Map();
  const others = [];

  for (const tab of filteredTabs) {
    const rule = matchGroup(tab.url, groupRules);
    if (rule) {
      if (!groups.has(rule.name)) {
        groups.set(rule.name, { rule, tabs: [] });
      }
      groups.get(rule.name).tabs.push(tab);
    } else {
      others.push(tab);
    }
  }

  let index = 0;

  for (const [, { tabs: groupTabs }] of groups) {
    for (const tab of groupTabs) {
      await chrome.tabs.move(tab.id, { index });
      index++;
    }
  }

  for (const tab of others) {
    await chrome.tabs.move(tab.id, { index });
    index++;
  }

  const existingGroupIds = [...new Set(filteredTabs.map((t) => t.groupId).filter((id) => id !== -1))];
  for (const groupId of existingGroupIds) {
    const groupTabs = filteredTabs.filter((t) => t.groupId === groupId).map((t) => t.id);
    if (groupTabs.length > 0) {
      await chrome.tabs.ungroup(groupTabs);
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

export { GROUP_RULES, normalizeUrl, matchGroup, removeDuplicateTabs, sortAndGroupTabs };
