import { classifyHttpError } from "./errors.js";

// ---------------------------------------------------------------------------
// Query string helpers
// ---------------------------------------------------------------------------

function buildQueryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// Task filter types
// ---------------------------------------------------------------------------

export interface TaskFilters {
  archived?: boolean;
  page?: number;
  order_by?: string;
  reverse?: boolean;
  subtasks?: boolean;
  statuses?: string[];
  include_closed?: boolean;
  assignees?: number[];
  tags?: string[];
  due_date_gt?: number;
  due_date_lt?: number;
  date_created_gt?: number;
  date_created_lt?: number;
  date_updated_gt?: number;
  date_updated_lt?: number;
}

export interface SearchFilters extends TaskFilters {
  space_ids?: string[];
  folder_ids?: string[];
  list_ids?: string[];
}

export interface CreateTaskData {
  name: string;
  description?: string;
  markdown_description?: string;
  assignees?: number[];
  tags?: string[];
  status?: string;
  priority?: number | null;
  due_date?: number;
  due_date_time?: boolean;
  start_date?: number;
  start_date_time?: boolean;
  time_estimate?: number;
  points?: number;
  parent?: string;
  links_to?: string;
  notify_all?: boolean;
  custom_fields?: Array<{ id: string; value: unknown }>;
}

export interface UpdateTaskData {
  name?: string;
  description?: string;
  markdown_description?: string;
  assignees?: { add?: number[]; rem?: number[] };
  status?: string;
  priority?: number | null;
  due_date?: number;
  due_date_time?: boolean;
  start_date?: number;
  start_date_time?: boolean;
  time_estimate?: number;
  points?: number;
  parent?: string;
  archived?: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ClickUpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.clickup.com/api/v2") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw classifyHttpError(response.status, text);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // -----------------------------------------------------------------------
  // User
  // -----------------------------------------------------------------------

  async getUser(): Promise<{ user: Record<string, unknown> }> {
    return this.request("GET", "/user");
  }

  // -----------------------------------------------------------------------
  // Workspaces (Teams in API v2 terminology)
  // -----------------------------------------------------------------------

  async listWorkspaces(): Promise<{ teams: Array<Record<string, unknown>> }> {
    return this.request("GET", "/team");
  }

  // -----------------------------------------------------------------------
  // Spaces
  // -----------------------------------------------------------------------

  async listSpaces(teamId: string): Promise<{ spaces: Array<Record<string, unknown>> }> {
    return this.request("GET", `/team/${teamId}/space`);
  }

  // -----------------------------------------------------------------------
  // Folders
  // -----------------------------------------------------------------------

  async listFolders(spaceId: string): Promise<{ folders: Array<Record<string, unknown>> }> {
    return this.request("GET", `/space/${spaceId}/folder`);
  }

  // -----------------------------------------------------------------------
  // Lists
  // -----------------------------------------------------------------------

  async listListsInFolder(folderId: string): Promise<{ lists: Array<Record<string, unknown>> }> {
    return this.request("GET", `/folder/${folderId}/list`);
  }

  async listFolderlessLists(spaceId: string): Promise<{ lists: Array<Record<string, unknown>> }> {
    return this.request("GET", `/space/${spaceId}/list`);
  }

  async getList(listId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/list/${listId}`);
  }

  // -----------------------------------------------------------------------
  // Custom Fields
  // -----------------------------------------------------------------------

  async getListCustomFields(listId: string): Promise<{ fields: Array<Record<string, unknown>> }> {
    return this.request("GET", `/list/${listId}/field`);
  }

  // -----------------------------------------------------------------------
  // Tasks
  // -----------------------------------------------------------------------

  async getTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/task/${taskId}`);
  }

  async listTasks(
    listId: string,
    filters: TaskFilters = {},
  ): Promise<{ tasks: Array<Record<string, unknown>> }> {
    const qs = buildQueryString({ ...filters });
    return this.request("GET", `/list/${listId}/task${qs}`);
  }

  async searchTasks(
    teamId: string,
    filters: SearchFilters = {},
  ): Promise<{ tasks: Array<Record<string, unknown>> }> {
    const qs = buildQueryString({ ...filters });
    return this.request("GET", `/team/${teamId}/task${qs}`);
  }

  async createTask(
    listId: string,
    data: CreateTaskData,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/list/${listId}/task`, data);
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/task/${taskId}`, data);
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.request("DELETE", `/task/${taskId}`);
  }

  // -----------------------------------------------------------------------
  // Comments
  // -----------------------------------------------------------------------

  async getTaskComments(taskId: string): Promise<{ comments: Array<Record<string, unknown>> }> {
    return this.request("GET", `/task/${taskId}/comment`);
  }

  async createTaskComment(
    taskId: string,
    commentText: string,
    notifyAll = false,
    assignee?: number,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", `/task/${taskId}/comment`, {
      comment_text: commentText,
      notify_all: notifyAll,
      ...(assignee != null ? { assignee } : {}),
    });
  }

  // -----------------------------------------------------------------------
  // Checklists
  // -----------------------------------------------------------------------

  async createChecklist(
    taskId: string,
    name: string,
  ): Promise<{ checklist: Record<string, unknown> }> {
    return this.request("POST", `/task/${taskId}/checklist`, { name });
  }

  async createChecklistItem(
    checklistId: string,
    name: string,
    assignee?: number,
  ): Promise<{ checklist: Record<string, unknown> }> {
    return this.request("POST", `/checklist/${checklistId}/checklist_item`, {
      name,
      ...(assignee != null ? { assignee } : {}),
    });
  }

  async updateChecklistItem(
    checklistId: string,
    checklistItemId: string,
    data: { name?: string; resolved?: boolean; assignee?: number | null; parent?: string | null },
  ): Promise<{ checklist: Record<string, unknown> }> {
    return this.request(
      "PUT",
      `/checklist/${checklistId}/checklist_item/${checklistItemId}`,
      data,
    );
  }
}
