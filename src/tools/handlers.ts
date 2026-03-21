import type { ClickUpClient } from "../client.js";
import { ClickUpError } from "../errors.js";
import { formatToolResponse, formatErrorResponse } from "../utils.js";
import type { z } from "zod";
import type {
  listSpacesInput,
  listFoldersInput,
  listListsInput,
  getListInput,
  getTaskInput,
  listTasksInput,
  searchTasksInput,
  createTaskInput,
  updateTaskInput,
  deleteTaskInput,
  getTaskCommentsInput,
  createTaskCommentInput,
  createChecklistInput,
  createChecklistItemInput,
  updateChecklistItemInput,
} from "./schemas.js";

// ---------------------------------------------------------------------------
// Error handling wrapper
// ---------------------------------------------------------------------------

type ToolResult =
  | ReturnType<typeof formatToolResponse>
  | ReturnType<typeof formatErrorResponse>;

async function withErrorHandling(
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ClickUpError) {
      return formatErrorResponse(err.message);
    }
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return formatErrorResponse(message);
  }
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

export function createHandlers(client: ClickUpClient) {
  // -----------------------------------------------------------------------
  // clickup_get_user
  // -----------------------------------------------------------------------
  async function getUser(): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const response = await client.getUser();
      const u = response.user;
      return formatToolResponse({
        id: u.id,
        username: u.username,
        email: u.email,
        color: u.color,
        timezone: u.timezone,
        profile_picture: u.profilePicture,
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_list_workspaces
  // -----------------------------------------------------------------------
  async function listWorkspaces(): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const response = await client.listWorkspaces();
      return formatToolResponse({
        workspaces: response.teams.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          member_count: Array.isArray(t.members)
            ? (t.members as unknown[]).length
            : undefined,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_list_spaces
  // -----------------------------------------------------------------------
  async function listSpaces(
    args: z.infer<typeof listSpacesInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const response = await client.listSpaces(args.workspace_id);
      return formatToolResponse({
        spaces: response.spaces.map((s) => ({
          id: s.id,
          name: s.name,
          private: s.private,
          archived: s.archived,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_list_folders
  // -----------------------------------------------------------------------
  async function listFolders(
    args: z.infer<typeof listFoldersInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const response = await client.listFolders(args.space_id);
      return formatToolResponse({
        folders: response.folders.map((f) => ({
          id: f.id,
          name: f.name,
          task_count: f.task_count,
          list_count: Array.isArray(f.lists)
            ? (f.lists as unknown[]).length
            : undefined,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_list_lists
  // -----------------------------------------------------------------------
  async function listLists(
    args: z.infer<typeof listListsInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      if (!args.folder_id && !args.space_id) {
        return formatErrorResponse(
          "Provide either folder_id or space_id (one is required).",
        );
      }
      if (args.folder_id && args.space_id) {
        return formatErrorResponse(
          "Provide either folder_id or space_id, not both.",
        );
      }

      const response = args.folder_id
        ? await client.listListsInFolder(args.folder_id)
        : await client.listFolderlessLists(args.space_id!);

      return formatToolResponse({
        lists: response.lists.map((l) => ({
          id: l.id,
          name: l.name,
          task_count: l.task_count,
          status: l.status,
          archived: l.archived,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_get_list
  // -----------------------------------------------------------------------
  async function getList(
    args: z.infer<typeof getListInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const [list, fieldsResponse] = await Promise.all([
        client.getList(args.list_id),
        client.getListCustomFields(args.list_id),
      ]);

      return formatToolResponse({
        id: list.id,
        name: list.name,
        task_count: list.task_count,
        archived: list.archived,
        statuses: list.statuses,
        space: list.space,
        folder: list.folder,
        custom_fields: fieldsResponse.fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_get_task
  // -----------------------------------------------------------------------
  async function getTask(
    args: z.infer<typeof getTaskInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const task = await client.getTask(args.task_id);
      return formatToolResponse(summarizeTask(task));
    });
  }

  // -----------------------------------------------------------------------
  // clickup_list_tasks
  // -----------------------------------------------------------------------
  async function listTasks(
    args: z.infer<typeof listTasksInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const { list_id, ...filters } = args;
      const response = await client.listTasks(list_id, filters);
      return formatToolResponse({
        tasks: response.tasks.map(summarizeTaskBrief),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_search_tasks
  // -----------------------------------------------------------------------
  async function searchTasks(
    args: z.infer<typeof searchTasksInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const { workspace_id, ...filters } = args;
      const response = await client.searchTasks(workspace_id, filters);
      return formatToolResponse({
        tasks: response.tasks.map(summarizeTaskBrief),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_create_task
  // -----------------------------------------------------------------------
  async function createTask(
    args: z.infer<typeof createTaskInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const { list_id, ...data } = args;
      const task = await client.createTask(list_id, data);
      return formatToolResponse(summarizeTask(task));
    });
  }

  // -----------------------------------------------------------------------
  // clickup_update_task
  // -----------------------------------------------------------------------
  async function updateTask(
    args: z.infer<typeof updateTaskInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const { task_id, add_assignees, remove_assignees, ...rest } = args;

      // Build the update payload
      const data: Record<string, unknown> = { ...rest };

      // ClickUp expects assignees as { add: [], rem: [] }
      if (add_assignees || remove_assignees) {
        data.assignees = {
          ...(add_assignees ? { add: add_assignees } : {}),
          ...(remove_assignees ? { rem: remove_assignees } : {}),
        };
      }

      const task = await client.updateTask(task_id, data);
      return formatToolResponse(summarizeTask(task));
    });
  }

  // -----------------------------------------------------------------------
  // clickup_delete_task
  // -----------------------------------------------------------------------
  async function deleteTask(
    args: z.infer<typeof deleteTaskInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      await client.deleteTask(args.task_id);
      return formatToolResponse({
        deleted: true,
        task_id: args.task_id,
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_get_task_comments
  // -----------------------------------------------------------------------
  async function getTaskComments(
    args: z.infer<typeof getTaskCommentsInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const response = await client.getTaskComments(args.task_id);
      return formatToolResponse({
        comments: response.comments.map((c) => ({
          id: c.id,
          text: c.comment_text,
          user: c.user
            ? {
                id: (c.user as Record<string, unknown>).id,
                username: (c.user as Record<string, unknown>).username,
              }
            : null,
          date: c.date,
          resolved: c.resolved,
        })),
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_create_task_comment
  // -----------------------------------------------------------------------
  async function createTaskComment(
    args: z.infer<typeof createTaskCommentInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const result = await client.createTaskComment(
        args.task_id,
        args.comment_text,
        args.notify_all ?? false,
        args.assignee,
      );
      return formatToolResponse({
        id: result.id,
        task_id: args.task_id,
        created: true,
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_create_checklist
  // -----------------------------------------------------------------------
  async function createChecklist(
    args: z.infer<typeof createChecklistInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const result = await client.createChecklist(args.task_id, args.name);
      const cl = result.checklist;
      return formatToolResponse({
        checklist_id: cl.id,
        name: cl.name,
        task_id: cl.task_id,
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_create_checklist_item
  // -----------------------------------------------------------------------
  async function createChecklistItem(
    args: z.infer<typeof createChecklistItemInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const result = await client.createChecklistItem(
        args.checklist_id,
        args.name,
        args.assignee,
      );
      const items = (result.checklist.items as Array<Record<string, unknown>>) ?? [];
      const newItem = items[items.length - 1];
      return formatToolResponse({
        checklist_id: args.checklist_id,
        item_id: newItem?.id,
        name: newItem?.name ?? args.name,
      });
    });
  }

  // -----------------------------------------------------------------------
  // clickup_update_checklist_item
  // -----------------------------------------------------------------------
  async function updateChecklistItem(
    args: z.infer<typeof updateChecklistItemInput>,
  ): Promise<ToolResult> {
    return withErrorHandling(async () => {
      const { checklist_id, checklist_item_id, ...data } = args;
      await client.updateChecklistItem(checklist_id, checklist_item_id, data);
      return formatToolResponse({
        checklist_id,
        checklist_item_id,
        updated: true,
      });
    });
  }

  return {
    getUser,
    listWorkspaces,
    listSpaces,
    listFolders,
    listLists,
    getList,
    getTask,
    listTasks,
    searchTasks,
    createTask,
    updateTask,
    deleteTask,
    getTaskComments,
    createTaskComment,
    createChecklist,
    createChecklistItem,
    updateChecklistItem,
  };
}

// ---------------------------------------------------------------------------
// Task serialization helpers
// ---------------------------------------------------------------------------

/** Full task detail (for get_task, create_task, update_task) */
function summarizeTask(task: Record<string, unknown>) {
  const priority = task.priority as Record<string, unknown> | null;
  const status = task.status as Record<string, unknown> | null;
  const assignees = task.assignees as Array<Record<string, unknown>> | undefined;
  const tags = task.tags as Array<Record<string, unknown>> | undefined;
  const checklists = task.checklists as Array<Record<string, unknown>> | undefined;
  const customFields = task.custom_fields as Array<Record<string, unknown>> | undefined;

  return {
    id: task.id,
    custom_id: task.custom_id ?? null,
    name: task.name,
    description: task.description ?? task.text_content,
    status: status ? { status: status.status, type: status.type } : null,
    priority: priority
      ? { id: priority.id, label: priority.priority }
      : null,
    assignees: assignees?.map((a) => ({
      id: a.id,
      username: a.username,
      email: a.email,
    })),
    tags: tags?.map((t) => t.name),
    due_date: task.due_date,
    start_date: task.start_date,
    time_estimate: task.time_estimate,
    points: task.points,
    parent: task.parent,
    url: task.url,
    date_created: task.date_created,
    date_updated: task.date_updated,
    creator: task.creator
      ? {
          id: (task.creator as Record<string, unknown>).id,
          username: (task.creator as Record<string, unknown>).username,
        }
      : null,
    list: task.list
      ? {
          id: (task.list as Record<string, unknown>).id,
          name: (task.list as Record<string, unknown>).name,
        }
      : null,
    folder: task.folder
      ? {
          id: (task.folder as Record<string, unknown>).id,
          name: (task.folder as Record<string, unknown>).name,
        }
      : null,
    space: task.space ? { id: (task.space as Record<string, unknown>).id } : null,
    checklists: checklists?.map((cl) => ({
      id: cl.id,
      name: cl.name,
      resolved: cl.resolved,
      unresolved: cl.unresolved,
      items: (cl.items as Array<Record<string, unknown>> | undefined)?.map(
        (item) => ({
          id: item.id,
          name: item.name,
          resolved: item.resolved,
          assignee: item.assignee
            ? { id: (item.assignee as Record<string, unknown>).id }
            : null,
        }),
      ),
    })),
    custom_fields: customFields
      ?.filter((f) => f.value !== undefined && f.value !== null)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        value: f.value,
      })),
  };
}

/** Brief task summary (for list_tasks, search_tasks) */
function summarizeTaskBrief(task: Record<string, unknown>) {
  const priority = task.priority as Record<string, unknown> | null;
  const status = task.status as Record<string, unknown> | null;
  const assignees = task.assignees as Array<Record<string, unknown>> | undefined;
  const tags = task.tags as Array<Record<string, unknown>> | undefined;

  return {
    id: task.id,
    name: task.name,
    status: status ? status.status : null,
    priority: priority ? priority.priority : null,
    assignees: assignees?.map((a) => ({
      id: a.id,
      username: a.username,
    })),
    tags: tags?.map((t) => t.name),
    due_date: task.due_date,
    url: task.url,
    date_created: task.date_created,
    date_updated: task.date_updated,
  };
}
