const GROUP_RULES_URL = chrome.runtime.getURL("src/group-rules.json");

const groupRulesData = await fetch(GROUP_RULES_URL)
  .then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load group rules: ${response.status}`);
    }
    return response.json();
  })
  .catch((error) => {
    console.error("group-rules.json の読み込みに失敗しました", error);
    return [];
  });

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

function getRuleNames(groupRules = GROUP_RULES) {
  return new Set(groupRules.map((rule) => rule.name));
}

function getBookmarksBarNode(tree) {
  if (!Array.isArray(tree) || tree.length === 0) {
    return null;
  }

  const root = tree[0];
  const candidates = root.children ?? [];
  return candidates.find((node) => node.id === "1") ?? candidates[0] ?? null;
}

async function removeManagedBookmarkBarGroups(ruleNames) {
  if (!chrome?.bookmarks?.getTree || !chrome?.bookmarks?.removeTree) {
    return 0;
  }

  const tree = await chrome.bookmarks.getTree();
  const bookmarksBar = getBookmarksBarNode(tree);
  if (!bookmarksBar?.children?.length) {
    return 0;
  }

  const managedFolders = bookmarksBar.children.filter((node) => {
    const isFolder = !node.url && Array.isArray(node.children);
    return isFolder && ruleNames.has(node.title);
  });

  for (const folder of managedFolders) {
    await chrome.bookmarks.removeTree(folder.id);
  }

  return managedFolders.length;
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

  // 手動グループ（ルール名と一致しないタイトルのグループ）に属するタブは操作しない
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

  for (const group of existingGroups) {
    if (ruleNames.has(group.title)) {
      const groupTabs = filteredTabs.filter((t) => t.groupId === group.id).map((t) => t.id);
      if (groupTabs.length > 0) {
        await chrome.tabs.ungroup(groupTabs);
      }
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
  let groups;
  if (allWindows) {
    groups = await chrome.tabGroups.query({});
  } else {
    const [currentWindow] = await chrome.windows.getAll({ windowTypes: ["normal"] }).then(
      (ws) => ws.filter((w) => w.focused)
    );
    groups = currentWindow
      ? await chrome.tabGroups.query({ windowId: currentWindow.id })
      : [];
  }
  const ruleNames = getRuleNames(groupRules);
  const managedGroupIds = groups
    .filter((group) => ruleNames.has(group.title))
    .map((group) => group.id);

  for (const groupId of managedGroupIds) {
    const tabIds = tabs.filter((t) => t.groupId === groupId).map((t) => t.id);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
    }
  }

  const removedBookmarkGroups = await removeManagedBookmarkBarGroups(ruleNames);
  return { ungrouped: managedGroupIds.length, removedBookmarkGroups };
}

export { GROUP_RULES, normalizeUrl, matchGroup, removeDuplicateTabs, sortAndGroupTabs, ungroupAllTabs };
