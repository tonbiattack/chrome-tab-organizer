import { GROUP_RULES, removeDuplicateTabs, sortAndGroupTabs } from "./src/tab-organizer.browser.js";
import {
  STORAGE_KEYS,
  getDefaultSettings,
  resolvePopupSettings,
  getActiveRules,
} from "./src/popup-logic.mjs";

async function loadSettings() {
  const settings = await chrome.storage.local.get(getDefaultSettings(GROUP_RULES));
  return resolvePopupSettings(settings, GROUP_RULES);
}

function groupTabsByWindow(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    if (!map.has(tab.windowId)) map.set(tab.windowId, []);
    map.get(tab.windowId).push(tab);
  }
  return map;
}

chrome.commands.onCommand.addListener(async (command) => {
  const { allWindows, collapseGroups, enabledRuleNames, customRules } = await loadSettings();
  const tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });

  if (command === "remove-duplicates") {
    await removeDuplicateTabs(tabs);
  } else if (command === "group-by-domain") {
    const activeRules = getActiveRules(GROUP_RULES, enabledRuleNames, customRules);
    const windowsMap = groupTabsByWindow(tabs);
    for (const [windowId, windowTabs] of windowsMap) {
      await sortAndGroupTabs(windowTabs, windowId, activeRules, { collapsed: collapseGroups });
    }
  }
});
