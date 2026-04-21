const { normalizeUrl, matchGroup, removeDuplicateTabs, sortAndGroupTabs, ungroupAllTabs, GROUP_RULES } = require("../src/tab-organizer");

// --- normalizeUrl ---

describe("normalizeUrl", () => {
  test("ハッシュを除去する", () => {
    expect(normalizeUrl("https://example.com/page#section1")).toBe("https://example.com/page");
  });

  test("ハッシュがなければそのまま返す", () => {
    expect(normalizeUrl("https://example.com/page")).toBe("https://example.com/page");
  });

  test("クエリパラメータはそのまま残す", () => {
    expect(normalizeUrl("https://example.com/?q=test")).toBe("https://example.com/?q=test");
  });

  test("不正なURLはそのまま返す", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

// --- matchGroup ---

describe("matchGroup", () => {
  test("Jiraのドメインを検出する", () => {
    expect(matchGroup("https://company.atlassian.net/browse/PROJ-123")).toMatchObject({ name: "Jira" });
  });

  test("GitHubのドメインを検出する", () => {
    expect(matchGroup("https://github.com/user/repo")).toMatchObject({ name: "GitHub" });
  });

  test("Slackのドメインを検出する", () => {
    expect(matchGroup("https://app.slack.com/client/T0123")).toMatchObject({ name: "Slack" });
  });

  test("Notionのドメインを検出する", () => {
    expect(matchGroup("https://www.notion.so/mypage")).toMatchObject({ name: "Notion" });
  });

  test("Googleのドメインを検出する", () => {
    expect(matchGroup("https://docs.google.com/document/d/abc")).toMatchObject({ name: "Google" });
  });

  test("Google Calendarのドメインを検出する", () => {
    expect(matchGroup("https://calendar.google.com/calendar/r")).toMatchObject({ name: "Calendar" });
  });

  test("Google CalendarはGoogleグループに含まれない", () => {
    expect(matchGroup("https://calendar.google.com/calendar/r")).not.toMatchObject({ name: "Google" });
  });

  test("Geminiのドメインを検出する", () => {
    expect(matchGroup("https://gemini.google.com/app")).toMatchObject({ name: "Gemini" });
  });

  test("ChatGPTのドメインを検出する", () => {
    expect(matchGroup("https://chatgpt.com/c/session-id")).toMatchObject({ name: "ChatGPT" });
  });

  test("Qiitaのドメインを検出する", () => {
    expect(matchGroup("https://qiita.com/user/items/abc123")).toMatchObject({ name: "Qiita" });
  });

  test("Zennのドメインを検出する", () => {
    expect(matchGroup("https://zenn.dev/user/articles/abc123")).toMatchObject({ name: "Zenn" });
  });

  test("Amazonのドメインを検出する", () => {
    expect(matchGroup("https://www.amazon.co.jp/dp/B0ABC")).toMatchObject({ name: "Amazon" });
  });

  test("YouTubeのドメインを検出する", () => {
    expect(matchGroup("https://www.youtube.com/watch?v=abc123")).toMatchObject({ name: "YouTube" });
  });

  test("youtu.beの短縮URLを検出する", () => {
    expect(matchGroup("https://youtu.be/abc123")).toMatchObject({ name: "YouTube" });
  });

  test("マッチしないURLはnullを返す", () => {
    expect(matchGroup("https://example.com/")).toBeNull();
  });

  test("jira.company.comを検出する", () => {
    expect(matchGroup("https://jira.mycompany.com/browse/TICKET-1")).toMatchObject({ name: "Jira" });
  });
});

// --- removeDuplicateTabs ---

describe("removeDuplicateTabs", () => {
  let removedIds;

  beforeEach(() => {
    removedIds = [];
    global.chrome = {
      tabs: {
        remove: jest.fn(async (ids) => {
          removedIds.push(...ids);
        }),
      },
    };
  });

  test("重複URLのタブを削除し、最初のタブだけ残す", async () => {
    const tabs = [
      { id: 1, url: "https://example.com/" },
      { id: 2, url: "https://example.com/" },
      { id: 3, url: "https://other.com/" },
    ];
    const result = await removeDuplicateTabs(tabs);
    expect(result.removed).toBe(1);
    expect(result.kept).toBe(2);
    expect(removedIds).toEqual([2]);
  });

  test("重複がなければ削除しない", async () => {
    const tabs = [
      { id: 1, url: "https://example.com/" },
      { id: 2, url: "https://other.com/" },
    ];
    const result = await removeDuplicateTabs(tabs);
    expect(result.removed).toBe(0);
    expect(result.kept).toBe(2);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  test("ハッシュ違いは同一URLとして扱う", async () => {
    const tabs = [
      { id: 1, url: "https://example.com/page#section1" },
      { id: 2, url: "https://example.com/page#section2" },
    ];
    const result = await removeDuplicateTabs(tabs);
    expect(result.removed).toBe(1);
    expect(removedIds).toEqual([2]);
  });

  test("chrome:// URLはスキップする", async () => {
    const tabs = [
      { id: 1, url: "chrome://newtab/" },
      { id: 2, url: "chrome://newtab/" },
      { id: 3, url: "https://example.com/" },
    ];
    const result = await removeDuplicateTabs(tabs);
    expect(result.removed).toBe(0);
    expect(result.kept).toBe(1);
  });

  test("3つ重複があれば2つ削除する", async () => {
    const tabs = [
      { id: 1, url: "https://example.com/" },
      { id: 2, url: "https://example.com/" },
      { id: 3, url: "https://example.com/" },
    ];
    const result = await removeDuplicateTabs(tabs);
    expect(result.removed).toBe(2);
    expect(result.kept).toBe(1);
    expect(removedIds).toEqual([2, 3]);
  });
});

// --- sortAndGroupTabs ---

describe("sortAndGroupTabs", () => {
  let moveHistory;
  let ungroupHistory;
  let groupHistory;
  let updateHistory;

  beforeEach(() => {
    moveHistory = [];
    ungroupHistory = [];
    groupHistory = [];
    updateHistory = [];

    global.chrome = {
      tabs: {
        move: jest.fn(async (tabId, options) => {
          moveHistory.push({ tabId, index: options.index });
        }),
        ungroup: jest.fn(async (tabIds) => {
          ungroupHistory.push(...tabIds);
        }),
        group: jest.fn(async ({ tabIds }) => {
          groupHistory.push(tabIds);
          return groupHistory.length;
        }),
        query: jest.fn(async () => [
          { id: 1, url: "https://github.com/repo", groupId: -1 },
          { id: 2, url: "https://company.atlassian.net/browse/X", groupId: -1 },
          { id: 3, url: "https://example.com/", groupId: -1 },
        ]),
      },
      tabGroups: {
        update: jest.fn(async (groupId, props) => {
          updateHistory.push({ groupId, ...props });
        }),
        query: jest.fn(async () => []),
      },
    };
  });

  test("グループに属するタブをグループ化する", async () => {
    const tabs = [
      { id: 1, url: "https://github.com/repo", groupId: -1 },
      { id: 2, url: "https://company.atlassian.net/browse/X", groupId: -1 },
      { id: 3, url: "https://example.com/", groupId: -1 },
    ];
    const result = await sortAndGroupTabs(tabs, 1);
    expect(result.groupCount).toBe(2);
    expect(groupHistory).toHaveLength(2);
  });

  test("ルール名と一致する既存グループのタブをungroupする", async () => {
    const tabs = [
      { id: 1, url: "https://github.com/repo", groupId: 10 },
      { id: 2, url: "https://example.com/", groupId: -1 },
    ];
    global.chrome.tabGroups.query = jest.fn(async () => [
      { id: 10, title: "GitHub", windowId: 1 },
    ]);
    await sortAndGroupTabs(tabs, 1);
    expect(ungroupHistory).toContain(1);
  });

  test("手動で作ったグループ（ルール名と一致しない）はungroupしない", async () => {
    const tabs = [
      { id: 1, url: "https://github.com/repo", groupId: 20 },
      { id: 2, url: "https://example.com/", groupId: -1 },
    ];
    global.chrome.tabGroups.query = jest.fn(async () => [
      { id: 20, title: "作業中", windowId: 1 },
    ]);
    await sortAndGroupTabs(tabs, 1);
    expect(ungroupHistory).not.toContain(1);
  });

  test("chrome:// URLはスキップする", async () => {
    const tabs = [
      { id: 1, url: "chrome://newtab/", groupId: -1 },
      { id: 2, url: "https://github.com/repo", groupId: -1 },
    ];
    await sortAndGroupTabs(tabs, 1);
    // chrome://はフィルタされてmoveされない
    const movedIds = moveHistory.map((h) => h.tabId);
    expect(movedIds).not.toContain(1);
  });

  test("グループ名とカラーが正しく設定される", async () => {
    const tabs = [
      { id: 1, url: "https://github.com/repo", groupId: -1 },
    ];
    await sortAndGroupTabs(tabs, 1);
    const githubUpdate = updateHistory.find((u) => u.title === "GitHub");
    expect(githubUpdate).toBeDefined();
    expect(githubUpdate.color).toBe("purple");
  });

  test("Chrome が許可する色だけを使う", () => {
    const allowedColors = new Set(["blue", "cyan", "green", "grey", "orange", "pink", "purple", "red", "yellow"]);
    for (const rule of GROUP_RULES) {
      expect(allowedColors.has(rule.color)).toBe(true);
    }
  });
});

// --- ungroupAllTabs ---

describe("ungroupAllTabs", () => {
  beforeEach(() => {
    global.chrome = {
      windows: {
        WINDOW_ID_CURRENT: -2,
      },
      tabs: {
        query: jest.fn(async () => [
          { id: 1, groupId: 10 },
          { id: 2, groupId: 10 },
          { id: 3, groupId: 20 },
          { id: 4, groupId: -1 },
        ]),
        ungroup: jest.fn(async () => {}),
      },
      tabGroups: {
        query: jest.fn(async () => [
          { id: 10, title: "GitHub", windowId: 1 },
          { id: 20, title: "作業中", windowId: 1 },
        ]),
      },
      bookmarks: {
        getTree: jest.fn(async () => [
          {
            id: "0",
            children: [
              {
                id: "1",
                folderType: "bookmarks-bar",
                children: [
                  { id: "100", title: "GitHub", children: [{ id: "101", url: "https://github.com/openai" }] },
                  { id: "200", title: "手動保存", children: [{ id: "201", url: "https://example.com" }] },
                ],
              },
            ],
          },
        ]),
        removeTree: jest.fn(async () => {}),
      },
    };
  });

  test("拡張が管理するグループだけを解除する", async () => {
    const { ungrouped, removedSavedGroups } = await ungroupAllTabs(false);
    expect(ungrouped).toBe(1);
    expect(removedSavedGroups).toBe(1);
    expect(global.chrome.tabs.ungroup).toHaveBeenCalledTimes(1);
    expect(global.chrome.tabs.ungroup).toHaveBeenCalledWith([1, 2]);
    expect(global.chrome.bookmarks.removeTree).toHaveBeenCalledTimes(1);
    expect(global.chrome.bookmarks.removeTree).toHaveBeenCalledWith("100");
  });

  test("管理対象グループがなければ解除しない", async () => {
    global.chrome.tabGroups.query = jest.fn(async () => [
      { id: 20, title: "作業中", windowId: 1 },
    ]);
    global.chrome.bookmarks.getTree = jest.fn(async () => [
      {
        id: "0",
        children: [
          {
            id: "1",
            folderType: "bookmarks-bar",
            children: [
              { id: "200", title: "手動保存", children: [{ id: "201", url: "https://example.com" }] },
            ],
          },
        ],
      },
    ]);
    const { ungrouped, removedSavedGroups } = await ungroupAllTabs(false);
    expect(ungrouped).toBe(0);
    expect(removedSavedGroups).toBe(0);
    expect(global.chrome.tabs.ungroup).not.toHaveBeenCalled();
    expect(global.chrome.bookmarks.removeTree).not.toHaveBeenCalled();
  });

  test("allWindows=true のとき全ウィンドウを対象にクエリする", async () => {
    await ungroupAllTabs(true);
    expect(global.chrome.tabs.query).toHaveBeenCalledWith({});
    expect(global.chrome.tabGroups.query).toHaveBeenCalledWith({});
  });

  test("allWindows=false のとき現在のウィンドウのみクエリする", async () => {
    await ungroupAllTabs(false);
    expect(global.chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    expect(global.chrome.tabGroups.query).toHaveBeenCalledWith({ windowId: -2 });
  });

  test("bookmarks API が使えない環境でも開いているグループ解除は動く", async () => {
    delete global.chrome.bookmarks;

    const { ungrouped, removedSavedGroups } = await ungroupAllTabs(false);

    expect(ungrouped).toBe(1);
    expect(removedSavedGroups).toBe(0);
    expect(global.chrome.tabs.ungroup).toHaveBeenCalledWith([1, 2]);
  });
});

// --- GROUP_RULES の整合性チェック ---

describe("GROUP_RULES", () => {
  test("各ルールにname, color, patternsが存在する", () => {
    for (const rule of GROUP_RULES) {
      expect(rule).toHaveProperty("name");
      expect(rule).toHaveProperty("color");
      expect(rule).toHaveProperty("patterns");
      expect(Array.isArray(rule.patterns)).toBe(true);
      expect(rule.patterns.length).toBeGreaterThan(0);
    }
  });

  test("ルール名が重複していない", () => {
    const names = GROUP_RULES.map((r) => r.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
