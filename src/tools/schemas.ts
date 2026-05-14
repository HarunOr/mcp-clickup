import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const paginationPage = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe("Page number (starts at 0). Each page returns up to 100 items.");

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export const getUserInput = z.object({});

export const listWorkspacesInput = z.object({});

export const listSpacesInput = z.object({
  workspace_id: z
    .string()
    .describe("The workspace (team) ID. Get this from clickup_list_workspaces."),
});

export const listFoldersInput = z.object({
  space_id: z
    .string()
    .describe("The space ID. Get this from clickup_list_spaces."),
});

export const listListsInput = z.object({
  folder_id: z
    .string()
    .optional()
    .describe("Get lists inside this folder. Mutually exclusive with space_id."),
  space_id: z
    .string()
    .optional()
    .describe("Get folderless lists in this space. Mutually exclusive with folder_id."),
});

export const getListInput = z.object({
  list_id: z
    .string()
    .describe("The list ID."),
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const getTaskInput = z.object({
  task_id: z
    .string()
    .describe("The task ID (e.g. '8ckjp5' — without the '#' prefix shown in ClickUp UI)."),
  include_comments: z
    .boolean()
    .optional()
    .describe(
      "Whether to fetch and inline the task's comments alongside the task details. Default true. Set false for very long comment threads when you only need task fields.",
    ),
});

export const listTasksInput = z.object({
  list_id: z
    .string()
    .describe("The list ID to fetch tasks from."),
  page: paginationPage,
  statuses: z
    .array(z.string())
    .optional()
    .describe("Filter by status names (e.g. ['open', 'in progress'])."),
  assignees: z
    .array(z.number())
    .optional()
    .describe("Filter by assignee user IDs."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Filter by tag names."),
  include_closed: z
    .boolean()
    .optional()
    .describe("Include closed tasks. Default false — closed tasks are hidden unless you set this."),
  subtasks: z
    .boolean()
    .optional()
    .describe("Include subtasks in results."),
  order_by: z
    .enum(["id", "created", "updated", "due_date"])
    .optional()
    .describe("Sort field."),
  reverse: z
    .boolean()
    .optional()
    .describe("Reverse sort order."),
  due_date_gt: z
    .number()
    .optional()
    .describe("Filter: due date after this Unix timestamp (milliseconds)."),
  due_date_lt: z
    .number()
    .optional()
    .describe("Filter: due date before this Unix timestamp (milliseconds)."),
});

export const searchTasksInput = z.object({
  workspace_id: z
    .string()
    .describe("Workspace ID to search in."),
  page: paginationPage,
  statuses: z
    .array(z.string())
    .optional()
    .describe("Filter by status names."),
  assignees: z
    .array(z.number())
    .optional()
    .describe("Filter by assignee user IDs."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Filter by tag names."),
  space_ids: z
    .array(z.string())
    .optional()
    .describe("Limit search to these space IDs."),
  folder_ids: z
    .array(z.string())
    .optional()
    .describe("Limit search to these folder IDs."),
  list_ids: z
    .array(z.string())
    .optional()
    .describe("Limit search to these list IDs."),
  include_closed: z
    .boolean()
    .optional()
    .describe("Include closed tasks."),
  subtasks: z
    .boolean()
    .optional()
    .describe("Include subtasks."),
  order_by: z
    .enum(["id", "created", "updated", "due_date"])
    .optional()
    .describe("Sort field."),
  due_date_gt: z
    .number()
    .optional()
    .describe("Due date after (Unix ms)."),
  due_date_lt: z
    .number()
    .optional()
    .describe("Due date before (Unix ms)."),
});

export const createTaskInput = z.object({
  list_id: z
    .string()
    .describe("The list ID to create the task in."),
  name: z
    .string()
    .describe("Task name."),
  description: z
    .string()
    .optional()
    .describe("Plain text description. Mutually exclusive with markdown_description."),
  markdown_description: z
    .string()
    .optional()
    .describe("Markdown description. Mutually exclusive with description."),
  assignees: z
    .array(z.number())
    .optional()
    .describe("User IDs to assign."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tag names to apply."),
  status: z
    .string()
    .optional()
    .describe("Status name (must exist on the list). Use clickup_get_list to see available statuses."),
  priority: z
    .number()
    .int()
    .min(1)
    .max(4)
    .nullable()
    .optional()
    .describe("1=Urgent, 2=High, 3=Normal, 4=Low. null=no priority."),
  due_date: z
    .number()
    .optional()
    .describe("Due date as Unix timestamp in milliseconds."),
  due_date_time: z
    .boolean()
    .optional()
    .describe("Whether due_date includes a time component."),
  start_date: z
    .number()
    .optional()
    .describe("Start date as Unix timestamp in milliseconds."),
  time_estimate: z
    .number()
    .optional()
    .describe("Time estimate in milliseconds."),
  parent: z
    .string()
    .optional()
    .describe("Parent task ID to create this as a subtask."),
  notify_all: z
    .boolean()
    .optional()
    .describe("Notify all assignees."),
});

export const updateTaskInput = z.object({
  task_id: z
    .string()
    .describe("The task ID to update."),
  name: z
    .string()
    .optional()
    .describe("New task name."),
  description: z
    .string()
    .optional()
    .describe("New plain text description."),
  markdown_description: z
    .string()
    .optional()
    .describe("New markdown description."),
  status: z
    .string()
    .optional()
    .describe("New status name."),
  priority: z
    .number()
    .int()
    .min(1)
    .max(4)
    .nullable()
    .optional()
    .describe("1=Urgent, 2=High, 3=Normal, 4=Low. null=no priority."),
  due_date: z
    .number()
    .optional()
    .describe("New due date (Unix ms)."),
  due_date_time: z
    .boolean()
    .optional()
    .describe("Whether due_date includes time."),
  start_date: z
    .number()
    .optional()
    .describe("New start date (Unix ms)."),
  time_estimate: z
    .number()
    .optional()
    .describe("New time estimate (ms)."),
  parent: z
    .string()
    .optional()
    .describe("Move to a different parent (subtask re-parenting)."),
  archived: z
    .boolean()
    .optional()
    .describe("Archive or unarchive the task."),
  add_assignees: z
    .array(z.number())
    .optional()
    .describe("User IDs to add as assignees."),
  remove_assignees: z
    .array(z.number())
    .optional()
    .describe("User IDs to remove from assignees."),
});

export const deleteTaskInput = z.object({
  task_id: z
    .string()
    .describe("The task ID to delete. This is permanent."),
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const getTaskCommentsInput = z.object({
  task_id: z
    .string()
    .describe("The task ID."),
});

export const createTaskCommentInput = z.object({
  task_id: z
    .string()
    .describe("The task ID to comment on."),
  comment_text: z
    .string()
    .describe("The comment text."),
  notify_all: z
    .boolean()
    .optional()
    .describe("Notify all assignees about this comment."),
  assignee: z
    .number()
    .optional()
    .describe("User ID to assign the comment to (creates an assigned comment)."),
});

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export const createChecklistInput = z.object({
  task_id: z
    .string()
    .describe("The task ID to add a checklist to."),
  name: z
    .string()
    .describe("Checklist name."),
});

export const createChecklistItemInput = z.object({
  checklist_id: z
    .string()
    .describe("The checklist ID (from clickup_create_checklist or from a task's checklists array)."),
  name: z
    .string()
    .describe("Checklist item text."),
  assignee: z
    .number()
    .optional()
    .describe("User ID to assign this item to."),
});

export const updateChecklistItemInput = z.object({
  checklist_id: z
    .string()
    .describe("The checklist ID."),
  checklist_item_id: z
    .string()
    .describe("The checklist item ID."),
  name: z
    .string()
    .optional()
    .describe("New item text."),
  resolved: z
    .boolean()
    .optional()
    .describe("Set to true to mark complete, false to mark incomplete."),
  assignee: z
    .number()
    .nullable()
    .optional()
    .describe("User ID to assign (null to unassign)."),
});
