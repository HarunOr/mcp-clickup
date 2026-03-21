import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ClickUpClient } from "../../src/client.js";
import { AuthenticationError, RateLimitedError, NotFoundError } from "../../src/errors.js";

const BASE_URL = "https://api.test.clickup.com/api/v2";
const API_KEY = "pk_test_1234567890";
const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

function makeClient() {
  return new ClickUpClient(API_KEY, BASE_URL);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("authentication", () => {
  it("sends API key directly in Authorization header (no Bearer prefix)", async () => {
    let capturedAuth = "";

    mockServer.use(
      http.get(`${BASE_URL}/user`, ({ request }) => {
        capturedAuth = request.headers.get("authorization") ?? "";
        return HttpResponse.json({ user: { id: 1, username: "test" } });
      }),
    );

    await makeClient().getUser();
    // ClickUp personal tokens use bare key, NOT "Bearer pk_..."
    expect(capturedAuth).toBe(API_KEY);
    expect(capturedAuth).not.toContain("Bearer");
  });
});

// ---------------------------------------------------------------------------
// Query string building — array params must use [] suffix
// ---------------------------------------------------------------------------

describe("query string building", () => {
  it("builds array params with [] suffix for listTasks", async () => {
    let capturedUrl = "";

    mockServer.use(
      http.get(`${BASE_URL}/list/:listId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    await makeClient().listTasks("list-1", {
      statuses: ["open", "in progress"],
      assignees: [123, 456],
      tags: ["bug"],
      include_closed: true,
      page: 0,
    });

    // Array params must have [] suffix
    expect(capturedUrl).toContain("statuses[]=open");
    expect(capturedUrl).toContain("statuses[]=in%20progress");
    expect(capturedUrl).toContain("assignees[]=123");
    expect(capturedUrl).toContain("assignees[]=456");
    expect(capturedUrl).toContain("tags[]=bug");
    // Scalar params should NOT have [] suffix
    expect(capturedUrl).toContain("include_closed=true");
    expect(capturedUrl).toContain("page=0");
  });

  it("builds searchTasks query with space/folder/list filters", async () => {
    let capturedUrl = "";

    mockServer.use(
      http.get(`${BASE_URL}/team/:teamId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    await makeClient().searchTasks("team-1", {
      space_ids: ["space-a", "space-b"],
      statuses: ["done"],
      include_closed: true,
    });

    expect(capturedUrl).toContain("space_ids[]=space-a");
    expect(capturedUrl).toContain("space_ids[]=space-b");
    expect(capturedUrl).toContain("statuses[]=done");
    expect(capturedUrl).toContain("include_closed=true");
  });

  it("omits undefined/null params from query string", async () => {
    let capturedUrl = "";

    mockServer.use(
      http.get(`${BASE_URL}/list/:listId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    await makeClient().listTasks("list-1", {
      page: 0,
      statuses: undefined,
      assignees: undefined,
    });

    expect(capturedUrl).toContain("page=0");
    expect(capturedUrl).not.toContain("statuses");
    expect(capturedUrl).not.toContain("assignees");
  });

  it("sends no query string when filters are empty", async () => {
    let capturedUrl = "";

    mockServer.use(
      http.get(`${BASE_URL}/list/:listId/task`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ tasks: [] });
      }),
    );

    await makeClient().listTasks("list-1");
    expect(capturedUrl).not.toContain("?");
  });
});

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------

describe("request body", () => {
  it("createTask sends correct JSON body", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.post(`${BASE_URL}/list/:listId/task`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "task-1", name: "Test" });
      }),
    );

    await makeClient().createTask("list-1", {
      name: "Fix bug",
      priority: 2,
      assignees: [123],
      tags: ["urgent"],
      markdown_description: "## Steps\n1. Reproduce\n2. Fix",
    });

    expect(capturedBody.name).toBe("Fix bug");
    expect(capturedBody.priority).toBe(2);
    expect(capturedBody.assignees).toEqual([123]);
    expect(capturedBody.tags).toEqual(["urgent"]);
    expect(capturedBody.markdown_description).toContain("## Steps");
  });

  it("updateTask sends only provided fields", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.put(`${BASE_URL}/task/:taskId`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "task-1", name: "Updated" });
      }),
    );

    await makeClient().updateTask("task-1", { status: "done" });

    expect(capturedBody.status).toBe("done");
    expect(capturedBody).not.toHaveProperty("name");
    expect(capturedBody).not.toHaveProperty("priority");
  });

  it("createTaskComment sends comment_text and notify_all", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.post(`${BASE_URL}/task/:taskId/comment`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "comment-1" });
      }),
    );

    await makeClient().createTaskComment("task-1", "Looks good!", true, 123);

    expect(capturedBody.comment_text).toBe("Looks good!");
    expect(capturedBody.notify_all).toBe(true);
    expect(capturedBody.assignee).toBe(123);
  });

  it("createTaskComment omits assignee when not provided", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockServer.use(
      http.post(`${BASE_URL}/task/:taskId/comment`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "comment-1" });
      }),
    );

    await makeClient().createTaskComment("task-1", "Hello");

    expect(capturedBody).not.toHaveProperty("assignee");
  });
});

// ---------------------------------------------------------------------------
// Error classification from HTTP responses
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws AuthenticationError on 401", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/user`, () =>
        HttpResponse.json({ err: "Token invalid" }, { status: 401 }),
      ),
    );
    await expect(makeClient().getUser()).rejects.toThrow(AuthenticationError);
  });

  it("throws NotFoundError on 404", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/task/:id`, () =>
        HttpResponse.json({ err: "Task not found" }, { status: 404 }),
      ),
    );
    await expect(makeClient().getTask("nonexistent")).rejects.toThrow(NotFoundError);
  });

  it("throws RateLimitedError on 429", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/user`, () =>
        HttpResponse.json({ err: "Rate limit exceeded" }, { status: 429 }),
      ),
    );
    await expect(makeClient().getUser()).rejects.toThrow(RateLimitedError);
  });

  it("handles 204 No Content for delete operations", async () => {
    mockServer.use(
      http.delete(`${BASE_URL}/task/:id`, () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );
    // Should not throw
    await expect(makeClient().deleteTask("task-1")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// URL path construction
// ---------------------------------------------------------------------------

describe("URL paths", () => {
  it("listListsInFolder hits /folder/{id}/list", async () => {
    let capturedUrl = "";
    mockServer.use(
      http.get(`${BASE_URL}/folder/:folderId/list`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ lists: [] });
      }),
    );

    await makeClient().listListsInFolder("folder-42");
    expect(capturedUrl).toContain("/folder/folder-42/list");
  });

  it("listFolderlessLists hits /space/{id}/list", async () => {
    let capturedUrl = "";
    mockServer.use(
      http.get(`${BASE_URL}/space/:spaceId/list`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ lists: [] });
      }),
    );

    await makeClient().listFolderlessLists("space-7");
    expect(capturedUrl).toContain("/space/space-7/list");
  });

  it("updateChecklistItem hits correct nested path", async () => {
    let capturedUrl = "";
    mockServer.use(
      http.put(
        `${BASE_URL}/checklist/:checklistId/checklist_item/:itemId`,
        ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ checklist: {} });
        },
      ),
    );

    await makeClient().updateChecklistItem("cl-1", "item-2", { resolved: true });
    expect(capturedUrl).toContain("/checklist/cl-1/checklist_item/item-2");
  });
});
