import { createServer, type Server as HttpServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MOCK_PORT = 19284;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, "../../dist/index.js");
const TEST_API_KEY = "pk_integration_test_key";

// ---------------------------------------------------------------------------
// Mock ClickUp API server
// ---------------------------------------------------------------------------

function createMockClickUp(): HttpServer {
  return createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    const url = req.url ?? "";
    const method = req.method ?? "GET";

    // GET /user
    if (method === "GET" && url === "/api/v2/user") {
      res.end(
        JSON.stringify({
          user: {
            id: 42,
            username: "testuser",
            email: "test@example.com",
            color: "#000",
            timezone: "UTC",
            profilePicture: null,
          },
        }),
      );
      return;
    }

    // GET /team (workspaces)
    if (method === "GET" && url === "/api/v2/team") {
      res.end(
        JSON.stringify({
          teams: [
            {
              id: "workspace-1",
              name: "Test Workspace",
              color: "#ff0000",
              members: [{ user: { id: 42 } }],
            },
          ],
        }),
      );
      return;
    }

    // GET /team/:id/space
    if (method === "GET" && url.match(/^\/api\/v2\/team\/[^/]+\/space$/)) {
      res.end(
        JSON.stringify({
          spaces: [
            { id: "space-1", name: "Engineering", private: false, archived: false },
          ],
        }),
      );
      return;
    }

    // GET /space/:id/folder
    if (method === "GET" && url.match(/^\/api\/v2\/space\/[^/]+\/folder$/)) {
      res.end(
        JSON.stringify({
          folders: [
            { id: "folder-1", name: "Backend", task_count: 10, lists: [{ id: "list-1" }] },
          ],
        }),
      );
      return;
    }

    // GET /folder/:id/list
    if (method === "GET" && url.match(/^\/api\/v2\/folder\/[^/]+\/list$/)) {
      res.end(
        JSON.stringify({
          lists: [
            { id: "list-1", name: "Sprint 1", task_count: 5, archived: false },
          ],
        }),
      );
      return;
    }

    // GET /list/:id (not /list/:id/task or /list/:id/field)
    if (method === "GET" && url.match(/^\/api\/v2\/list\/[^/]+$/) && !url.includes("/task") && !url.includes("/field")) {
      res.end(
        JSON.stringify({
          id: "list-1",
          name: "Sprint 1",
          task_count: 5,
          archived: false,
          statuses: [
            { status: "open", type: "open" },
            { status: "closed", type: "closed" },
          ],
          space: { id: "space-1" },
          folder: { id: "folder-1" },
        }),
      );
      return;
    }

    // GET /list/:id/field
    if (method === "GET" && url.match(/^\/api\/v2\/list\/[^/]+\/field$/)) {
      res.end(
        JSON.stringify({
          fields: [{ id: "cf-1", name: "Priority Score", type: "number" }],
        }),
      );
      return;
    }

    // GET /list/:id/task
    if (method === "GET" && url.match(/^\/api\/v2\/list\/[^/]+\/task/)) {
      res.end(
        JSON.stringify({
          tasks: [
            {
              id: "task-1",
              name: "Test Task",
              status: { status: "open", type: "open" },
              priority: { id: "3", priority: "normal" },
              assignees: [],
              tags: [],
              due_date: null,
              url: "https://app.clickup.com/t/task-1",
              date_created: "1735600000000",
              date_updated: "1735600000000",
            },
          ],
        }),
      );
      return;
    }

    // POST /list/:id/task
    if (method === "POST" && url.match(/^\/api\/v2\/list\/[^/]+\/task$/)) {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body);
      res.end(
        JSON.stringify({
          id: "new-task-1",
          name: parsed.name,
          status: { status: "open", type: "open" },
          priority: null,
          assignees: [],
          tags: [],
          due_date: null,
          url: "https://app.clickup.com/t/new-task-1",
          date_created: "1735600000000",
          date_updated: "1735600000000",
          creator: { id: 42, username: "testuser" },
          list: { id: "list-1", name: "Sprint 1" },
          folder: { id: "folder-1", name: "Backend" },
          space: { id: "space-1" },
          checklists: [],
          custom_fields: [],
        }),
      );
      return;
    }

    // Fallback: 404
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "Route not found" }));
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockClickUp: HttpServer;

beforeAll(async () => {
  mockClickUp = createMockClickUp();
  await new Promise<void>((resolve, reject) => {
    mockClickUp.once("error", reject);
    mockClickUp.listen(MOCK_PORT, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    mockClickUp.close((err) => (err ? reject(err) : resolve()));
  });
});

let client: Client;
let transport: StdioClientTransport;

beforeEach(async () => {
  transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_ENTRY],
    env: {
      CLICKUP_API_KEY: TEST_API_KEY,
      CLICKUP_API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/api/v2`,
    },
    stderr: "pipe",
  });

  client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(transport);
});

afterEach(async () => {
  await client.close().catch(() => {});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP server integration", () => {
  it("connects and reports correct server info", async () => {
    const version = client.getServerVersion();
    expect(version).toBeDefined();
    expect(version?.name).toBe("clickup");
    expect(version?.version).toBe("0.1.0");
  });

  it("lists all 17 tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(17);

    const names = result.tools.map((t) => t.name);
    expect(names).toContain("clickup_get_user");
    expect(names).toContain("clickup_list_workspaces");
    expect(names).toContain("clickup_list_spaces");
    expect(names).toContain("clickup_list_folders");
    expect(names).toContain("clickup_list_lists");
    expect(names).toContain("clickup_get_list");
    expect(names).toContain("clickup_get_task");
    expect(names).toContain("clickup_list_tasks");
    expect(names).toContain("clickup_search_tasks");
    expect(names).toContain("clickup_create_task");
    expect(names).toContain("clickup_update_task");
    expect(names).toContain("clickup_delete_task");
    expect(names).toContain("clickup_get_task_comments");
    expect(names).toContain("clickup_create_task_comment");
    expect(names).toContain("clickup_create_checklist");
    expect(names).toContain("clickup_create_checklist_item");
    expect(names).toContain("clickup_update_checklist_item");
  });

  it("all tools have descriptions and input schemas", async () => {
    const result = await client.listTools();
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("clickup_get_user returns user data from mock API", async () => {
    const result = await client.callTool({
      name: "clickup_get_user",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsed.id).toBe(42);
    expect(parsed.username).toBe("testuser");
    expect(parsed.email).toBe("test@example.com");
  });

  it("clickup_list_workspaces returns workspaces", async () => {
    const result = await client.callTool({
      name: "clickup_list_workspaces",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsed.workspaces).toHaveLength(1);
    expect(parsed.workspaces[0].name).toBe("Test Workspace");
  });

  it("full hierarchy navigation: workspace → space → folder → list → tasks", async () => {
    // 1. List workspaces
    const wsResult = await client.callTool({
      name: "clickup_list_workspaces",
      arguments: {},
    });
    const ws = JSON.parse((wsResult.content[0] as { type: "text"; text: string }).text);
    const workspaceId = ws.workspaces[0].id;

    // 2. List spaces
    const spResult = await client.callTool({
      name: "clickup_list_spaces",
      arguments: { workspace_id: workspaceId },
    });
    const sp = JSON.parse((spResult.content[0] as { type: "text"; text: string }).text);
    expect(sp.spaces[0].name).toBe("Engineering");
    const spaceId = sp.spaces[0].id;

    // 3. List folders
    const fResult = await client.callTool({
      name: "clickup_list_folders",
      arguments: { space_id: spaceId },
    });
    const f = JSON.parse((fResult.content[0] as { type: "text"; text: string }).text);
    expect(f.folders[0].name).toBe("Backend");
    const folderId = f.folders[0].id;

    // 4. List lists
    const lResult = await client.callTool({
      name: "clickup_list_lists",
      arguments: { folder_id: folderId },
    });
    const l = JSON.parse((lResult.content[0] as { type: "text"; text: string }).text);
    expect(l.lists[0].name).toBe("Sprint 1");
    const listId = l.lists[0].id;

    // 5. List tasks
    const tResult = await client.callTool({
      name: "clickup_list_tasks",
      arguments: { list_id: listId },
    });
    const t = JSON.parse((tResult.content[0] as { type: "text"; text: string }).text);
    expect(t.tasks).toHaveLength(1);
    expect(t.tasks[0].name).toBe("Test Task");
  });

  it("clickup_create_task creates and returns task data", async () => {
    const result = await client.callTool({
      name: "clickup_create_task",
      arguments: {
        list_id: "list-1",
        name: "Integration test task",
      },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsed.id).toBe("new-task-1");
    expect(parsed.name).toBe("Integration test task");
  });

  it("clickup_get_list returns statuses and custom fields", async () => {
    const result = await client.callTool({
      name: "clickup_get_list",
      arguments: { list_id: "list-1" },
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(
      (result.content[0] as { type: "text"; text: string }).text,
    );
    expect(parsed.statuses).toHaveLength(2);
    expect(parsed.custom_fields).toHaveLength(1);
    expect(parsed.custom_fields[0].name).toBe("Priority Score");
  });
});
