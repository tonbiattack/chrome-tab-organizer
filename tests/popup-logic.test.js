const { matchGroup, ungroupAllTabs, GROUP_RULES } = require("../src/tab-organizer");

describe("popup logic", () => {
  let popupLogic;

  beforeAll(async () => {
    popupLogic = await import("../src/popup-logic.mjs");
  });

  describe("resolvePopupSettings", () => {
    test("保存済み設定を復元し、不正な標準ルール名は除外する", () => {
      const settings = {
        allWindows: true,
        collapseGroups: true,
        enabledRules: ["GitHub", "Unknown"],
        customRules: [
          {
            id: "rule-1",
            name: "親課題A",
            type: "jira-keys",
            color: "red",
            enabled: true,
            issueKeys: ["PROJ-101", "bad-key"],
          },
        ],
      };

      const resolved = popupLogic.resolvePopupSettings(settings, GROUP_RULES);

      expect(resolved.allWindows).toBe(true);
      expect(resolved.collapseGroups).toBe(true);
      expect([...resolved.enabledRuleNames]).toEqual(["GitHub"]);
      expect(resolved.customRules).toEqual([
        {
          id: "rule-1",
          name: "親課題A",
          type: "jira-keys",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
        },
      ]);
    });

    test("標準ルールがすべて無効ならデフォルトで全ルール有効に戻す", () => {
      const resolved = popupLogic.resolvePopupSettings({
        allWindows: false,
        collapseGroups: false,
        enabledRules: [],
        customRules: [],
      }, GROUP_RULES);

      expect([...resolved.enabledRuleNames]).toEqual(GROUP_RULES.map((rule) => rule.name));
    });
  });

  describe("getActiveRules", () => {
    test("カスタムルールを標準ルールより先に評価する", () => {
      const customRules = [
        {
          id: "rule-1",
          name: "親課題A",
          type: "jira-keys",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
        },
      ];
      const enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));

      const activeRules = popupLogic.getActiveRules(GROUP_RULES, enabledRuleNames, customRules);
      const matchedRule = matchGroup("https://company.atlassian.net/browse/PROJ-101", activeRules);

      expect(activeRules[0].name).toBe("親課題A");
      expect(matchedRule.name).toBe("親課題A");
    });
  });

  describe("extractJiraIssueKeys", () => {
    test("browse URL と selectedIssue から Jira 課題キーを抽出する", () => {
      const issueKeys = popupLogic.extractJiraIssueKeys(
        "https://company.atlassian.net/jira/software/c/projects/PROJ/boards/1?selectedIssue=PROJ-102#/board?foo=1"
      );
      const browseKeys = popupLogic.extractJiraIssueKeys(
        "https://company.atlassian.net/browse/PROJ-101"
      );

      expect(browseKeys).toEqual(["PROJ-101"]);
      expect(issueKeys).toEqual(["PROJ-102"]);
    });

    test("重複キーは 1 回だけ返す", () => {
      const issueKeys = popupLogic.extractJiraIssueKeys(
        "https://company.atlassian.net/browse/PROJ-101?selectedIssue=PROJ-101"
      );

      expect(issueKeys).toEqual(["PROJ-101"]);
    });
  });

  describe("mergeIssueKeys", () => {
    test("既存入力と新規キーをマージして重複を除く", () => {
      const merged = popupLogic.mergeIssueKeys("PROJ-101, proj-102", ["PROJ-102", "PROJ-103"]);
      expect(merged).toBe("PROJ-101, PROJ-102, PROJ-103");
    });
  });

  describe("ungroupAllTabs", () => {
    beforeEach(() => {
      global.chrome = {
        windows: {
          WINDOW_ID_CURRENT: -2,
        },
        tabs: {
          query: jest.fn(async () => [
            { id: 1, groupId: 10 },
            { id: 2, groupId: 20 },
            { id: 3, groupId: 30 },
          ]),
          ungroup: jest.fn(async () => {}),
        },
        tabGroups: {
          query: jest.fn(async () => [
            { id: 10, title: "親課題A", windowId: 1 },
            { id: 20, title: "GitHub", windowId: 1 },
            { id: 30, title: "作業中", windowId: 1 },
          ]),
        },
      };
    });

    test("標準ルールとカスタムルールに一致する管理対象だけを解除する", async () => {
      const managedRules = popupLogic.getManagedRules(GROUP_RULES, [
        {
          id: "rule-1",
          name: "親課題A",
          type: "jira-keys",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
        },
      ]);

      const { ungrouped } = await ungroupAllTabs(false, managedRules);

      expect(ungrouped).toBe(2);
      expect(global.chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
      expect(global.chrome.tabs.ungroup).toHaveBeenNthCalledWith(1, [1]);
      expect(global.chrome.tabs.ungroup).toHaveBeenNthCalledWith(2, [2]);
    });
  });
});
