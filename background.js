import { removeDuplicateTabs, sortAndGroupTabs } from "./src/tab-organizer.browser.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Organizer installed.");
});

chrome.commands.onCommand.addListener(async (command) => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (command === "dedup-tabs") {
    await removeDuplicateTabs(tabs);
  } else if (command === "sort-tabs") {
    const windowId = tabs[0]?.windowId;
    if (windowId) await sortAndGroupTabs(tabs, windowId);
  }
});
