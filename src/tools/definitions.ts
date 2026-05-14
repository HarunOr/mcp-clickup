import {
  getUserInput,
  listWorkspacesInput,
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

export const toolDefinitions = [
  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  {
    name: "clickup_get_user",
    description:
      "Get the authenticated ClickUp user — ID, name, email, timezone. " +
      "USE THIS WHEN: you need to verify the API key works, find the current user's ID for assigning tasks, or check timezone. " +
      "DO NOT USE: to list workspaces (use clickup_list_workspaces).",
    inputSchema: getUserInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_list_workspaces",
    description:
      "List all ClickUp workspaces the authenticated user belongs to. Returns workspace IDs, names, and members. " +
      "USE THIS WHEN: you need a workspace ID to navigate further (spaces, tasks), or to see which workspaces are available. " +
      "This is the starting point for navigating the ClickUp hierarchy: Workspace > Space > Folder > List > Task.",
    inputSchema: listWorkspacesInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_list_spaces",
    description:
      "List spaces in a workspace. " +
      "USE THIS WHEN: you have a workspace ID and need to find a specific space. " +
      "DO NOT USE: without a workspace_id — get one from clickup_list_workspaces first.",
    inputSchema: listSpacesInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_list_folders",
    description:
      "List folders in a space. Folders contain lists. " +
      "USE THIS WHEN: you need to find a folder in a space, or navigate to the lists inside it. " +
      "NOTE: Not all lists live in folders — use clickup_list_lists with space_id to get folderless lists.",
    inputSchema: listFoldersInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_list_lists",
    description:
      "List task lists in a folder or folderless lists in a space. Provide either folder_id OR space_id (not both). " +
      "USE THIS WHEN: you need to find a list to view tasks or create a task in. " +
      "With folder_id: returns lists inside that folder. With space_id: returns lists NOT inside any folder.",
    inputSchema: listListsInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_get_list",
    description:
      "Get list details — statuses, custom fields, members. " +
      "USE THIS WHEN: you need to know valid status names before creating/updating a task, or want to see custom field definitions. " +
      "DO NOT USE: to list tasks in the list (use clickup_list_tasks).",
    inputSchema: getListInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  {
    name: "clickup_get_task",
    description:
      "Get full details of a single task — name, status, assignees, description, custom fields, checklists, AND inlined comments (newest first). " +
      "USE THIS WHEN: you know a task ID and need its details. The inlined comments mean you usually do NOT need a separate clickup_get_task_comments call. " +
      "DO NOT USE: to list multiple tasks (use clickup_list_tasks or clickup_search_tasks). " +
      "NOTE: Task IDs in ClickUp UI have a '#' prefix (e.g. #8ckjp5) — pass just '8ckjp5' to this tool. " +
      "Pass include_comments=false on tasks with very long comment threads when you only need task fields.",
    inputSchema: getTaskInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_list_tasks",
    description:
      "List tasks in a specific list, with optional filters for status, assignees, tags, and due dates. " +
      "Returns up to 100 tasks per page. " +
      "USE THIS WHEN: you want to see tasks in a known list, filter by status/assignee, or paginate through tasks. " +
      "DO NOT USE: to search across the entire workspace (use clickup_search_tasks). " +
      "IMPORTANT: Closed tasks are hidden by default — set include_closed=true to see them.",
    inputSchema: listTasksInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_search_tasks",
    description:
      "Search tasks across an entire workspace with filters. " +
      "USE THIS WHEN: you need to find tasks across multiple lists/spaces, or don't know which list a task is in. " +
      "DO NOT USE: if you already know the list — clickup_list_tasks is more efficient. " +
      "Supports filtering by space, folder, list, status, assignees, tags, and date ranges.",
    inputSchema: searchTasksInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_create_task",
    description:
      "Create a new task in a list. " +
      "USE THIS WHEN: user wants to create a task, add a to-do, or log work. " +
      "BEFORE USING: if you don't know valid statuses, call clickup_get_list first. " +
      "Supports assignees, tags, priority (1=Urgent to 4=Low), due dates, descriptions (plain or markdown), and subtasks (via parent).",
    inputSchema: createTaskInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  {
    name: "clickup_update_task",
    description:
      "Update an existing task — change name, status, priority, assignees, dates, description. " +
      "USE THIS WHEN: user wants to update a task's status, reassign, change priority, or edit details. " +
      "Only send the fields you want to change.",
    inputSchema: updateTaskInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_delete_task",
    description:
      "Permanently delete a task. This cannot be undone. " +
      "USE THIS WHEN: user explicitly asks to delete a task. " +
      "DO NOT USE: to close or archive a task — use clickup_update_task with status or archived instead.",
    inputSchema: deleteTaskInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  },

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  {
    name: "clickup_get_task_comments",
    description:
      "Get comments on a task (newest first). " +
      "USE THIS WHEN: you need to read discussion or context on a task.",
    inputSchema: getTaskCommentsInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "clickup_create_task_comment",
    description:
      "Add a comment to a task. " +
      "USE THIS WHEN: user wants to post a comment, note, or update on a task. " +
      "Set notify_all=true to notify assignees. Use assignee to create an assigned comment.",
    inputSchema: createTaskCommentInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },

  // -------------------------------------------------------------------------
  // Checklists
  // -------------------------------------------------------------------------
  {
    name: "clickup_create_checklist",
    description:
      "Add a new checklist to a task. Returns the checklist with its ID. " +
      "USE THIS WHEN: user wants to add a checklist or to-do list to a task. " +
      "After creating, use clickup_create_checklist_item to add items.",
    inputSchema: createChecklistInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  {
    name: "clickup_create_checklist_item",
    description:
      "Add an item to an existing checklist. " +
      "USE THIS WHEN: you have a checklist ID and want to add an item to it.",
    inputSchema: createChecklistItemInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  },
  {
    name: "clickup_update_checklist_item",
    description:
      "Update a checklist item — mark it resolved (complete), rename it, or reassign. " +
      "USE THIS WHEN: user wants to check off a checklist item, rename it, or change assignment. " +
      "Set resolved=true to mark complete, resolved=false to uncheck.",
    inputSchema: updateChecklistItemInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
] as const;
