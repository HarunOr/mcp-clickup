import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ClickUpClient } from "../../src/client.js";
import { createHandlers } from "../../src/tools/handlers.js";

const BASE_URL = "https://api.test.clickup.com/api/v2";
const API_KEY = "pk_test_1234567890";
const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function makeClient() {
  return new ClickUpClient(API_KEY, BASE_URL);
}

function makeHandlers() {
  return createHandlers(makeClient());
}

function parseContent(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "abc123",
    custom_id: null,
    name: "Fix login bug",
    description: "Users can't log in",
    text_content: "Users can't log in",
    status: { status: "open", type: "open" },
    priority: { id: "2", priority: "high" },
    assignees: [
      { id: 123, username: "alice", email: "alice@example.com" },
    ],
    tags: [{ name: "bug" }],
    due_date: "1735689600000",
    start_date: null,
    time_estimate: null,
    points: null,
    parent: null,
    url: "https://app.clickup.com/t/abc123",
    date_created: "1735600000000",
    date_updated: "1735603600000",
    creator: { id: 100, username: "bob" },
    list: { id: "list-1", name: "Sprint 1" },
    folder: { id: "folder-1", name: "Development" },
    space: { id: "space-1" },
    checklists: [
      {
        id: "cl-1",
        name: "QA Steps",
        resolved: 1,
        unresolved: 2,
        items: [
          { id: "item-1", name: "Test login", resolved: true, assignee: null },
          { id: "item-2", name: "Test logout", resolved: false, assignee: { id: 123 } },
          { id: "item-3", name: "Test 2FA", resolved: false, assignee: null },
        ],
      },
    ],
    custom_fields: [
      { id: "cf-1", name: "Story Points", type: "number", value: 5 },
      { id: "cf-2", name: "Sprint", type: "drop_down", value: null },
    ],
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: "comment-1",
    comment_text: "Looks good to me",
    user: { id: 100, username: "alice" },
    date: "1735600000000",
    resolved: false,
    ...overrides,
  };
}

// ===========================================================================
// Navigation tools
// ===========================================================================

describe("getUser", () => {
  it("returns user info from API", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/user`, () =>
        HttpResponse.json({
          user: {
            id: 42,
            username: "hrun",
            email: "hrun@scrapeer.com",
            color: "#ff0000",
            timezone: "Europe/Amsterdam",
            profilePicture: "https://example.com/pic.png",
          },
        }),
      ),
    );

    const result = await makeHandlers().getUser();
    const data = parseContent(result) as Record<string, unknown>;

    expect(data.id).toBe(42);
    expect(data.username).toBe("hrun");
    expect(data.email).toBe("hrun@scrapeer.com");
    expect(data.timezone).toBe("Europe/Amsterdam");
  });
});

describe("listWorkspaces", () => {
  it("returns workspace list with member count", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/team`, () =>
        HttpResponse.json({
          teams: [
            {
              id: "team-1",
              name: "Scrapeer",
              color: "#00ff00",
              members: [{ user: { id: 1 } }, { user: { id: 2 } }],
            },
            { id: "team-2", name: "Side Project", color: null, members: [] },
          ],
        }),
      ),
    );

    const result = await makeHandlers().listWorkspaces();
    const data = parseContent(result) as { workspaces: Array<Record<string, unknown>> };

    expect(data.workspaces).toHaveLength(2);
    expect(data.workspaces[0].id).toBe("team-1");
    expect(data.workspaces[0].name).toBe("Scrapeer");
    expect(data.workspaces[0].member_count).toBe(2);
    expect(data.workspaces[1].member_count).toBe(0);
  });
});

describe("listSpaces", () => {
  it("returns spaces with key fields", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/team/:teamId/space`, () =>
        HttpResponse.json({
          spaces: [
            { id: "s-1", name: "Engineering", private: false, archived: false },
            { id: "s-2", name: "Design", private: true, archived: false },
          ],
        }),
      ),
    );

    const result = await makeHandlers().listSpaces({ workspace_id: "team-1" });
    const data = parseContent(result) as { spaces: Array<Record<string, unknown>> };

    expect(data.spaces).toHaveLength(2);
    expect(data.spaces[0].name).toBe("Engineering");
    expect(data.spaces[1].private).toBe(true);
  });
});

describe("listFolders", () => {
  it("returns folders with task and list counts", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/space/:spaceId/folder`, () =>
        HttpResponse.json({
          folders: [
            {
              id: "f-1",
              name: "Backend",
              task_count: 42,
              lists: [{ id: "l-1" }, { id: "l-2" }],
            },
          ],
        }),
      ),
    );

    const result = await makeHandlers().listFolders({ space_id: "s-1" });
    const data = parseContent(result) as { folders: Array<Record<string, unknown>> };

    expect(data.folders[0].task_count).toBe(42);
    expect(data.folders[0].list_count).toBe(2);
  });
});

describe("listLists", () => {
  it("returns lists from a folder when folder_id provided", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/folder/:folderId/list`, () =>
        HttpResponse.json({
          lists: [{ id: "l-1", name: "Sprint 1", task_count: 10, archived: false }],
        }),
      ),
    );

    const result = await makeHandlers().listLists({ folder_id: "f-1" });
    const data = parseContent(result) as { lists: Array<Record<string, unknown>> };

    expect(data.lists).toHaveLength(1);
    expect(data.lists[0].name).toBe("Sprint 1");
  });

  it("returns folderless lists when space_id provided", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/space/:spaceId/list`, () =>
        HttpResponse.json({
          lists: [{ id: "l-2", name: "Backlog", task_count: 50, archived: false }],
        }),
      ),
    );

    const result = await makeHandlers().listLists({ space_id: "s-1" });
    const data = parseContent(result) as { lists: Array<Record<string, unknown>> };

    expect(data.lists[0].name).toBe("Backlog");
  });

  it("errors when neither folder_id nor space_id is provided", async () => {
    const result = await makeHandlers().listLists({});
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(result.content[0].text).toContain("folder_id");
  });

  it("errors when both folder_id and space_id are provided", async () => {
    const result = await makeHandlers().listLists({
      folder_id: "f-1",
      space_id: "s-1",
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(result.content[0].text).toContain("not both");
  });
});

describe("getList", () => {
  it("returns list details with statuses and custom fields", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/list/:listId`, () =>
        HttpResponse.json({
          id: "l-1",
          name: "Sprint 1",
          task_count: 15,
          archived: false,
          statuses: [
            { status: "to do", type: "open" },
            { status: "in progress", type: "custom" },
            { status: "done", type: "closed" },
          ],
          space: { id: "s-1" },
          folder: { id: "f-1" },
        }),
      ),
      http.get(`${BASE_URL}/list/:listId/field`, () =>
        HttpResponse.json({
          fields: [
            { id: "cf-1", name: "Story Points", type: "number" },
            { id: "cf-2", name: "Sprint", type: "drop_down" },
          ],
        }),
      ),
    );

    const result = await makeHandlers().getList({ list_id: "l-1" });
    const data = parseContent(result) as Record<string, unknown>;

    expect(data.name).toBe("Sprint 1");
    expect(data.statuses).toHaveLength(3);
    expect(data.custom_fields).toHaveLength(2);
    expect((data.custom_fields as Array<Record<string, unknown>>)[0].name).toBe("Story Points");
  });
});

// ===========================================================================
// Task tools
// ===========================================================================

describe("getTask", () => {
  it("returns full task details with correct field mapping", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:taskId`, () =>
        HttpResponse.json(makeTask()),
      ),
    );

    const result = await makeHandlers().getTask({ task_id: "abc123" });
    const data = parseContent(result) as Record<string, unknown>;

    expect(data.id).toBe("abc123");
    expect(data.name).toBe("Fix login bug");
    expect((data.status as Record<string, unknown>).status).toBe("open");
    expect((data.priority as Record<string, unknown>).label).toBe("high");
    expect(data.tags).toEqual(["bug"]);
    expect((data.assignees as Array<Record<string, unknown>>)[0].username).toBe("alice");
    expect(data.url).toBe("https://app.clickup.com/t/abc123");
  });

  it("includes checklists with items", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:taskId`, () =>
        HttpResponse.json(makeTask()),
      ),
    );

    const result = await makeHandlers().getTask({ task_id: "abc123" });
    const data = parseContent(result) as Record<string, unknown>;
    const checklists = data.checklists as Array<Record<string, unknown>>;

    expect(checklists).toHaveLength(1);
    expect(checklists[0].name).toBe("QA Steps");
    expect(checklists[0].resolved).toBe(1);
    expect(checklists[0].unresolved).toBe(2);
    expect((checklists[0].items as unknown[]).length).toBe(3);
  });

  it("filters out null-value custom fields", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:taskId`, () =>
        HttpResponse.json(makeTask()),
      ),
    );

    const result = await makeHandlers().getTask({ task_id: "abc123" });
    const data = parseContent(result) as Record<string, unknown>;
    const fields = data.custom_fields as Array<Record<string, unknown>>;

    // Only "Story Points" (value=5) should appear; "Sprint" (value=null) is filtered
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("Story Points");
    expect(fields[0].value).toBe(5);
  });

  it("returns MCP error on 404", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:taskId`, () =>
        HttpResponse.json({ err: "Task not found" }, { status: 404 }),
      ),
    );

    const result = await makeHandlers().getTask({ task_id: "nonexistent" });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});

describe("listTasks", () => {
  it("returns brief task summaries", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/list/:listId/task`, () =>
        HttpResponse.json({
          tasks: [
            makeTask({ id: "t-1", name: "Task A" }),
            makeTask({ id: "t-2", name: "Task B", priority: null }),
          ],
        }),
      ),
    );

    const result = await makeHandlers().listTasks({ list_id: "l-1" });
    const data = parseContent(result) as { tasks: Array<Record<string, unknown>> };

    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0].id).toBe("t-1");
    expect(data.tasks[0].name).toBe("Task A");
    // Brief format should NOT include full description, checklists, custom fields
    expect(data.tasks[0]).not.toHaveProperty("description");
    expect(data.tasks[0]).not.toHaveProperty("checklists");
    expect(data.tasks[0]).not.toHaveProperty("custom_fields");
  });

  it("passes filter params to the API", async () => {
    let capturedUrl = "";
    mockServer.use(
      http.get(`${BASE_URL}/list/:listId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    await makeHandlers().listTasks({
      list_id: "l-1",
      statuses: ["in progress"],
      include_closed: true,
      page: 2,
    });

    expect(capturedUrl).toContain("statuses[]=in%20progress");
    expect(capturedUrl).toContain("include_closed=true");
    expect(capturedUrl).toContain("page=2");
  });
});

describe("searchTasks", () => {
  it("searches across workspace", async () => {
    let capturedUrl = "";
    mockServer.use(
      http.get(`${BASE_URL}/team/:teamId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          tasks: [makeTask({ id: "found-1" })],
        });
      }),
    );

    const result = await makeHandlers().searchTasks({
      workspace_id: "team-1",
      statuses: ["open"],
      space_ids: ["s-1"],
    });

    const data = parseContent(result) as { tasks: Array<Record<string, unknown>> };
    expect(data.tasks[0].id).toBe("found-1");
    expect(capturedUrl).toContain("space_ids[]=s-1");
  });
});

describe("createTask", () => {
  it("creates task and returns full details", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.post(`${BASE_URL}/list/:listId/task`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeTask({ id: "new-task", name: capturedBody.name as string }),
        );
      }),
    );

    const result = await makeHandlers().createTask({
      list_id: "l-1",
      name: "New feature",
      priority: 3,
      tags: ["feature"],
      markdown_description: "## Spec\nDo the thing",
    });

    const data = parseContent(result) as Record<string, unknown>;
    expect(data.id).toBe("new-task");
    expect(capturedBody.name).toBe("New feature");
    expect(capturedBody.priority).toBe(3);
    expect(capturedBody.tags).toEqual(["feature"]);
    expect(capturedBody.markdown_description).toContain("## Spec");
    // list_id should NOT be in the body — it's in the URL
    expect(capturedBody).not.toHaveProperty("list_id");
  });
});

describe("updateTask", () => {
  it("maps add_assignees/remove_assignees to ClickUp format", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.put(`${BASE_URL}/task/:taskId`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeTask());
      }),
    );

    await makeHandlers().updateTask({
      task_id: "abc123",
      status: "in progress",
      add_assignees: [456],
      remove_assignees: [123],
    });

    expect(capturedBody.status).toBe("in progress");
    // Must be { add: [...], rem: [...] } — NOT arrays directly
    expect(capturedBody.assignees).toEqual({ add: [456], rem: [123] });
    // These internal fields should NOT leak to the API
    expect(capturedBody).not.toHaveProperty("add_assignees");
    expect(capturedBody).not.toHaveProperty("remove_assignees");
    expect(capturedBody).not.toHaveProperty("task_id");
  });

  it("omits assignees when neither add nor remove is provided", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.put(`${BASE_URL}/task/:taskId`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeTask());
      }),
    );

    await makeHandlers().updateTask({
      task_id: "abc123",
      name: "Renamed",
    });

    expect(capturedBody.name).toBe("Renamed");
    expect(capturedBody).not.toHaveProperty("assignees");
  });
});

describe("deleteTask", () => {
  it("returns confirmation on success", async () => {
    mockServer.use(
      http.delete(`${BASE_URL}/task/:taskId`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    const result = await makeHandlers().deleteTask({ task_id: "abc123" });
    const data = parseContent(result) as Record<string, unknown>;

    expect(data.deleted).toBe(true);
    expect(data.task_id).toBe("abc123");
  });
});

// ===========================================================================
// Comments
// ===========================================================================

describe("getTaskComments", () => {
  it("returns comments with user info", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:taskId/comment`, () =>
        HttpResponse.json({
          comments: [
            makeComment({ id: "c-1", comment_text: "First" }),
            makeComment({ id: "c-2", comment_text: "Second", user: null }),
          ],
        }),
      ),
    );

    const result = await makeHandlers().getTaskComments({ task_id: "abc123" });
    const data = parseContent(result) as { comments: Array<Record<string, unknown>> };

    expect(data.comments).toHaveLength(2);
    expect(data.comments[0].text).toBe("First");
    expect((data.comments[0].user as Record<string, unknown>).username).toBe("alice");
    expect(data.comments[1].user).toBeNull();
  });
});

describe("createTaskComment", () => {
  it("creates comment and returns confirmation", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/task/:taskId/comment`, () =>
        HttpResponse.json({ id: "new-comment" }),
      ),
    );

    const result = await makeHandlers().createTaskComment({
      task_id: "abc123",
      comment_text: "Ship it!",
      notify_all: true,
    });

    const data = parseContent(result) as Record<string, unknown>;
    expect(data.id).toBe("new-comment");
    expect(data.created).toBe(true);
  });
});

// ===========================================================================
// Checklists
// ===========================================================================

describe("createChecklist", () => {
  it("returns checklist with ID", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/task/:taskId/checklist`, () =>
        HttpResponse.json({
          checklist: { id: "cl-new", name: "Deploy Steps", task_id: "abc123" },
        }),
      ),
    );

    const result = await makeHandlers().createChecklist({
      task_id: "abc123",
      name: "Deploy Steps",
    });

    const data = parseContent(result) as Record<string, unknown>;
    expect(data.checklist_id).toBe("cl-new");
    expect(data.name).toBe("Deploy Steps");
  });
});

describe("createChecklistItem", () => {
  it("returns the newly created item", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/checklist/:checklistId/checklist_item`, () =>
        HttpResponse.json({
          checklist: {
            items: [
              { id: "existing-1", name: "Old item" },
              { id: "new-item", name: "Run migrations" },
            ],
          },
        }),
      ),
    );

    const result = await makeHandlers().createChecklistItem({
      checklist_id: "cl-1",
      name: "Run migrations",
    });

    const data = parseContent(result) as Record<string, unknown>;
    // Should return the LAST item (newly added)
    expect(data.item_id).toBe("new-item");
    expect(data.name).toBe("Run migrations");
  });
});

describe("updateChecklistItem", () => {
  it("returns confirmation on update", async () => {
    mockServer.use(
      http.put(
        `${BASE_URL}/checklist/:checklistId/checklist_item/:itemId`,
        () => HttpResponse.json({ checklist: {} }),
      ),
    );

    const result = await makeHandlers().updateChecklistItem({
      checklist_id: "cl-1",
      checklist_item_id: "item-1",
      resolved: true,
    });

    const data = parseContent(result) as Record<string, unknown>;
    expect(data.updated).toBe(true);
    expect(data.checklist_id).toBe("cl-1");
    expect(data.checklist_item_id).toBe("item-1");
  });
});

// ===========================================================================
// Cross-cutting: error handling wrapping
// ===========================================================================

describe("error handling", () => {
  it("returns isError with actionable message on 401", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/user`, () =>
        HttpResponse.json({ err: "Token invalid" }, { status: 401 }),
      ),
    );

    const result = await makeHandlers().getUser();
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(result.content[0].text).toContain("CLICKUP_API_KEY");
  });

  it("returns isError on rate limit", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/team`, () =>
        HttpResponse.json({}, { status: 429 }),
      ),
    );

    const result = await makeHandlers().listWorkspaces();
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(result.content[0].text).toContain("rate limit");
  });

  it("handles unexpected errors gracefully", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/user`, () => HttpResponse.error()),
    );

    const result = await makeHandlers().getUser();
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});
