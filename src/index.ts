#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClickUpClient } from "./client.js";
import { toolDefinitions } from "./tools/definitions.js";
import { createHandlers } from "./tools/handlers.js";

const API_KEY = process.env.CLICKUP_API_KEY;
const BASE_URL =
  process.env.CLICKUP_API_BASE_URL ?? "https://api.clickup.com/api/v2";

if (!API_KEY) {
  process.stderr.write(
    "Error: CLICKUP_API_KEY environment variable is required.\n" +
      "Generate one in ClickUp: Settings > Apps > API Token\n\n" +
      "Usage:\n" +
      "  CLICKUP_API_KEY=pk_... npx mcp-clickup\n",
  );
  process.exit(1);
}

const client = new ClickUpClient(API_KEY, BASE_URL);
const handlers = createHandlers(client);

// Map tool names (snake_case) to handler keys (camelCase)
const TOOL_TO_HANDLER: Record<string, keyof typeof handlers> = {
  clickup_get_user: "getUser",
  clickup_list_workspaces: "listWorkspaces",
  clickup_list_spaces: "listSpaces",
  clickup_list_folders: "listFolders",
  clickup_list_lists: "listLists",
  clickup_get_list: "getList",
  clickup_get_task: "getTask",
  clickup_list_tasks: "listTasks",
  clickup_search_tasks: "searchTasks",
  clickup_create_task: "createTask",
  clickup_update_task: "updateTask",
  clickup_delete_task: "deleteTask",
  clickup_get_task_comments: "getTaskComments",
  clickup_create_task_comment: "createTaskComment",
  clickup_create_checklist: "createChecklist",
  clickup_create_checklist_item: "createChecklistItem",
  clickup_update_checklist_item: "updateChecklistItem",
};

const server = new McpServer({
  name: "clickup",
  version: "0.1.0",
});

// Register all tools
for (const def of toolDefinitions) {
  const handlerKey = TOOL_TO_HANDLER[def.name];
  if (!handlerKey) {
    process.stderr.write(`No handler for tool: ${def.name}\n`);
    continue;
  }

  const handler = handlers[handlerKey];

  server.tool(
    def.name,
    def.description,
    def.inputSchema.shape,
    def.annotations,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => handler(args),
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
