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

    test("enabledRules が未設定ならデフォルトで全ルール有効にする", () => {
      const resolved = popupLogic.resolvePopupSettings({
        allWindows: false,
        collapseGroups: false,
        customRules: [],
      }, GROUP_RULES);

      expect([...resolved.enabledRuleNames]).toEqual(GROUP_RULES.map((rule) => rule.name));
    });

    test("標準ルールがすべて無効の保存状態はそのまま復元する", () => {
      const resolved = popupLogic.resolvePopupSettings({
        allWindows: false,
        collapseGroups: false,
        enabledRules: [],
        customRules: [],
      }, GROUP_RULES);

      expect([...resolved.enabledRuleNames]).toEqual([]);
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

  describe("extractGoogleDocIds", () => {
    test("ドキュメントURLからIDを抽出する", () => {
      const ids = popupLogic.extractGoogleDocIds(
        "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit"
      );
      expect(ids).toEqual(["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"]);
    });

    test("スプレッドシート・スライド・フォームURLからもIDを抽出する", () => {
      expect(popupLogic.extractGoogleDocIds(
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit"
      )).toEqual(["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"]);

      expect(popupLogic.extractGoogleDocIds(
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit"
      )).toEqual(["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"]);
    });

    test("Google DocsのURLでなければ空配列を返す", () => {
      expect(popupLogic.extractGoogleDocIds("https://github.com")).toEqual([]);
      expect(popupLogic.extractGoogleDocIds("")).toEqual([]);
    });

    test("重複IDは1回だけ返す", () => {
      const ids = popupLogic.extractGoogleDocIds(
        "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#comment?d=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
      );
      expect(ids).toEqual(["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"]);
    });
  });

  describe("buildGoogleDocPattern", () => {
    test("生成したパターンがドキュメントURLにマッチする", () => {
      const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
      const pattern = new RegExp(popupLogic.buildGoogleDocPattern(docId), "i");

      expect(pattern.test("https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit")).toBe(true);
      expect(pattern.test("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit")).toBe(true);
      expect(pattern.test("https://docs.google.com/document/d/OTHERDOCID123456789012345678901234567/edit")).toBe(false);
    });
  });

  describe("mergeDocIds", () => {
    test("既存入力と新規IDをマージして重複を除く", () => {
      const id1 = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
      const id2 = "2CyiNWt1YSB6nGNLlwCeCakhnVVrqumuct85PhWF3vnt";
      const merged = popupLogic.mergeDocIds(id1, [id1, id2]);
      expect(merged).toBe(`${id1}, ${id2}`);
    });
  });

  describe("sanitizeCustomRule (google-doc-ids)", () => {
    test("有効なgoogle-doc-idsルールをそのまま返す", () => {
      const rule = {
        id: "rule-1",
        name: "企画ドキュメント",
        type: "google-doc-ids",
        color: "green",
        enabled: true,
        docIds: ["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("短すぎるIDを除外する", () => {
      const rule = {
        id: "rule-1",
        name: "企画ドキュメント",
        type: "google-doc-ids",
        color: "green",
        enabled: true,
        docIds: ["short"],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toBeNull();
    });

    test("不正な文字を含むIDを除外する", () => {
      const rule = {
        id: "rule-1",
        name: "企画ドキュメント",
        type: "google-doc-ids",
        color: "green",
        enabled: true,
        docIds: ["1BxiMVs0XRA5nFMd KvBdBZjgmUUqptlbs74OgVE2upms"],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toBeNull();
    });
  });

  describe("compileCustomRule (google-doc-ids)", () => {
    test("google-doc-idsルールをコンパイルしてURLにマッチする", () => {
      const rule = {
        id: "rule-1",
        name: "企画ドキュメント",
        type: "google-doc-ids",
        color: "green",
        enabled: true,
        docIds: ["1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"],
      };
      const compiled = popupLogic.compileCustomRule(rule);

      expect(compiled.name).toBe("企画ドキュメント");
      expect(compiled.color).toBe("green");
      expect(compiled.patterns).toHaveLength(1);
      expect(compiled.patterns[0].test(
        "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit"
      )).toBe(true);
    });
  });

  describe("sanitizeCustomRule (combined)", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";

    test("Jira課題キーとGoogle Doc IDの両方を含む combined ルールを返す", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101", "PROJ-102"],
        docIds: [docId],
        patterns: [],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("Jira課題キーのみでも有効", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [],
        patterns: [],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("Google Doc IDのみでも有効", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [docId],
        patterns: [],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("URLパターンのみでも有効", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [],
        patterns: ["figma\\.com"],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("3種類すべてを含む combined ルールを返す", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: ["figma\\.com"],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toEqual(rule);
    });

    test("3つすべてが空なら null を返す", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [],
        patterns: [],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toBeNull();
    });

    test("両方が空なら null を返す", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [],
      };
      expect(popupLogic.sanitizeCustomRule(rule)).toBeNull();
    });

    test("不正なJira課題キーは除外される", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101", "bad-key"],
        docIds: [docId],
        patterns: [],
      };
      const result = popupLogic.sanitizeCustomRule(rule);
      expect(result.issueKeys).toEqual(["PROJ-101"]);
      expect(result.docIds).toEqual([docId]);
    });
  });

  describe("compileCustomRule (combined)", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";

    test("JiraタブとGoogle DocタブのURLに両方マッチする", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: [],
      };
      const compiled = popupLogic.compileCustomRule(rule);

      expect(compiled.name).toBe("スプリント1");
      expect(compiled.patterns).toHaveLength(2);
      expect(compiled.patterns[0].test("https://company.atlassian.net/browse/PROJ-101")).toBe(true);
      expect(compiled.patterns[1].test(
        `https://docs.google.com/document/d/${docId}/edit`
      )).toBe(true);
    });

    test("issueKeys が空でも docIds のパターンだけ生成される", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: [],
        docIds: [docId],
        patterns: [],
      };
      const compiled = popupLogic.compileCustomRule(rule);
      expect(compiled.patterns).toHaveLength(1);
      expect(compiled.patterns[0].test(
        `https://docs.google.com/spreadsheets/d/${docId}/edit`
      )).toBe(true);
    });

    test("URLパターンも含む3種類すべてがマッチする", () => {
      const rule = {
        id: "rule-1",
        name: "スプリント1",
        type: "combined",
        color: "blue",
        enabled: true,
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: ["figma\\.com"],
      };
      const compiled = popupLogic.compileCustomRule(rule);
      expect(compiled.patterns).toHaveLength(3);
      expect(compiled.patterns[0].test("https://company.atlassian.net/browse/PROJ-101")).toBe(true);
      expect(compiled.patterns[1].test(`https://docs.google.com/document/d/${docId}/edit`)).toBe(true);
      expect(compiled.patterns[2].test("https://www.figma.com/file/abc")).toBe(true);
    });
  });

  describe("createPatternPreview (combined)", () => {
    const docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";

    test("Jira課題キーとGoogle Doc IDの両方を表示する", () => {
      const rule = {
        type: "combined",
        issueKeys: ["PROJ-101"],
        docIds: [docId],
        patterns: [],
      };
      expect(popupLogic.createPatternPreview(rule)).toBe(`Jira課題: PROJ-101 / Google Doc: ${docId}`);
    });

    test("issueKeys のみの場合はJira課題だけ表示", () => {
      const rule = { type: "combined", issueKeys: ["PROJ-101"], docIds: [], patterns: [] };
      expect(popupLogic.createPatternPreview(rule)).toBe("Jira課題: PROJ-101");
    });

    test("docIds のみの場合はGoogle Docだけ表示", () => {
      const rule = { type: "combined", issueKeys: [], docIds: [docId], patterns: [] };
      expect(popupLogic.createPatternPreview(rule)).toBe(`Google Doc: ${docId}`);
    });

    test("URLパターンも含む3種類すべてを表示する", () => {
      const rule = { type: "combined", issueKeys: ["PROJ-101"], docIds: [docId], patterns: ["figma\\.com"] };
      expect(popupLogic.createPatternPreview(rule)).toBe(`Jira課題: PROJ-101 / Google Doc: ${docId} / figma\\.com`);
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
