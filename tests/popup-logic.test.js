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
            color: "red",
            enabled: true,
            issueKeys: ["PROJ-101", "bad-key"],
            docIds: [],
            patterns: [],
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
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
        },
      ]);
    });

    test("旧type付きカスタムルールも複合ルールとして復元する", () => {
      const resolved = popupLogic.resolvePopupSettings({
        allWindows: false,
        collapseGroups: false,
        customRules: [
          {
            id: "rule-1",
            name: "親課題A",
            type: "jira-keys",
            color: "red",
            enabled: true,
            issueKeys: ["PROJ-101"],
          },
        ],
      }, GROUP_RULES);

      expect(resolved.customRules).toEqual([
        {
          id: "rule-1",
          name: "親課題A",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
        },
      ]);
    });

    test("enabledRules が未設定ならデフォルトで全ルール有効にする", () => {
      const resolved = popupLogic.resolvePopupSettings({
        allWindows: false,
        collapseGroups: false,
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
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
        },
      ];
      const enabledRuleNames = new Set(GROUP_RULES.map((rule) => rule.name));

      const activeRules = popupLogic.getActiveRules(GROUP_RULES, enabledRuleNames, customRules);
      const matchedRule = matchGroup("https://company.atlassian.net/browse/PROJ-101", activeRules);

      expect(activeRules[0].name).toBe("親課題A");
      expect(matchedRule.name).toBe("親課題A");
    });
  });

  describe("extract helpers", () => {
    test("browse URL と selectedIssue から Jira 課題キーを抽出する", () => {
      const issueKeys = popupLogic.extractJiraIssueKeys(
        "https://company.atlassian.net/jira/software/c/projects/PROJ/boards/1?selectedIssue=PROJ-102#/board?foo=1"
      );
      const browseKeys = popupLogic.extractJiraIssueKeys("https://company.atlassian.net/browse/PROJ-101");

      expect(browseKeys).toEqual(["PROJ-101"]);
      expect(issueKeys).toEqual(["PROJ-102"]);
    });

    test("Google ドキュメント URL から ID を抽出する", () => {
      const ids = popupLogic.extractGoogleDocIds(
        "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit"
      );
      expect(ids).toEqual(["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"]);
    });

    test("既存入力と新規値を重複なくマージする", () => {
      expect(popupLogic.mergeIssueKeys("PROJ-101, proj-102", ["PROJ-102", "PROJ-103"]))
        .toBe("PROJ-101, PROJ-102, PROJ-103");

      const id1 = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
      const id2 = "2CyiNWt1YSB6nGNLlwCeCakhnVVrqumuct85PhWF3vnt";
      expect(popupLogic.mergeDocIds(id1, [id1, id2])).toBe(`${id1}, ${id2}`);
    });
  });

  describe("sanitizeCustomRule", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";

    test("複合ルールとして正規化する", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101", "bad-key"],
        docIds: [docId],
        patterns: ["figma\\.com"],
      };

      expect(popupLogic.sanitizeCustomRule(rule)).toEqual({
        id: "rule-1",
        name: "スプリント1",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: ["figma\\.com"],
      });
    });

    test("旧type付きURLパターンルールも正規化する", () => {
      const rule = {
        id: "rule-1",
        name: "Figma",
        type: "url-pattern",
        color: "pink",
        enabled: true,
        patterns: ["figma\\.com"],
      };

      expect(popupLogic.sanitizeCustomRule(rule)).toEqual({
        id: "rule-1",
        name: "Figma",
        color: "pink",
        enabled: true,
        issueKeys: [],
        docIds: [],
        patterns: ["figma\\.com"],
      });
    });

    test("条件が1つもなければ null を返す", () => {
      expect(popupLogic.sanitizeCustomRule({
        id: "rule-1",
        name: "空",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [],
        patterns: [],
      })).toBeNull();
    });

    test("無効な正規表現を含むと null を返す", () => {
      expect(popupLogic.sanitizeCustomRule({
        id: "rule-1",
        name: "invalid",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [],
        patterns: ["["],
      })).toBeNull();
    });
  });

  describe("compileCustomRule", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";

    test("Jira課題キー、Google Doc ID、URLパターンをまとめてコンパイルする", () => {
      const compiled = popupLogic.compileCustomRule({
        id: "rule-1",
        name: "スプリント1",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: ["figma\\.com"],
      });

      expect(compiled.name).toBe("スプリント1");
      expect(compiled.patterns).toHaveLength(3);
      expect(compiled.patterns[0].test("https://company.atlassian.net/browse/PROJ-101")).toBe(true);
      expect(compiled.patterns[1].test(`https://docs.google.com/document/d/${docId}/edit`)).toBe(true);
      expect(compiled.patterns[2].test("https://www.figma.com/file/abc")).toBe(true);
    });
  });

  describe("createPatternPreview", () => {
    test("含まれる条件だけを表示する", () => {
      expect(popupLogic.createPatternPreview({
        issueKeys: ["PROJ-101"],
        docIds: ["doc-id"],
        patterns: ["figma\\.com"],
      })).toBe("Jira課題: PROJ-101 / Google Doc: doc-id / figma\\.com");
    });
  });

  describe("custom rule import/export", () => {
    test("カスタムルールをエクスポート用 JSON に変換する", () => {
      const jsonText = popupLogic.serializeCustomRules([
        {
          id: "rule-1",
          name: "親課題A",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
        },
      ]);

      const parsed = JSON.parse(jsonText);
      expect(parsed.version).toBe(1);
      expect(parsed.customRules[0].issueKeys).toEqual(["PROJ-101"]);
    });

    test("旧形式の JSON からもカスタムルールを復元する", () => {
      const imported = popupLogic.parseImportedCustomRules(JSON.stringify({
        version: 1,
        customRules: [
          {
            id: "rule-1",
            name: "親課題A",
            type: "jira-keys",
            color: "red",
            enabled: true,
            issueKeys: ["PROJ-101"],
          },
        ],
      }));

      expect(imported).toEqual([
        {
          id: "rule-1",
          name: "親課題A",
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
        },
      ]);
    });
  });

  describe("resolveCommandShortcuts", () => {
    test("chrome.commands の割り当てを popup 表示用に解決する", () => {
      const shortcuts = popupLogic.resolveCommandShortcuts([
        { name: "remove-duplicates", shortcut: "Ctrl+Shift+D" },
        { name: "group-by-domain", shortcut: "Ctrl+Shift+G" },
        { name: "ungroup-all-managed", shortcut: "Ctrl+Shift+U" },
      ]);

      expect(shortcuts).toEqual({
        "remove-duplicates": "Ctrl+Shift+D",
        "group-by-domain": "Ctrl+Shift+G",
        "ungroup-all-managed": "Ctrl+Shift+U",
      });
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
          color: "red",
          enabled: true,
          issueKeys: ["PROJ-101"],
          docIds: [],
          patterns: [],
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
