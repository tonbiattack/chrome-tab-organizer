// Service Worker — 現時点ではメッセージ受信のみ。将来的な機能拡張の起点として使用。
chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Organizer installed.");
});
