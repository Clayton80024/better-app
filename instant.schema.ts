import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
      nickname: i.string().optional(),
      avatarSeed: i.string().optional(),
      username: i.string().unique().indexed().optional(),
    }),
    workspaces: i.entity({
      name: i.string(),
      createdAt: i.number().indexed(),
    }),
    cases: i.entity({
      clientName: i.string(),
      caseType: i.string(),
      status: i.string().optional(),
      createdAt: i.number().indexed(),
    }),
    caseNotes: i.entity({
      text: i.string(),
      createdAt: i.number().indexed(),
    }),
    uscisForms: i.entity({
      formCode: i.string(),
      name: i.string(),
      createdAt: i.number().indexed(),
    }),
    caseDocuments: i.entity({
      name: i.string(),
      mimeType: i.string(),
      size: i.number(),
      storageKey: i.string(),
      url: i.string(),
      classification: i.string(),
      extractedData: i.string().optional(),
      status: i.string(),
      reviewStatus: i.string().optional(),
      createdAt: i.number().indexed(),
      processedAt: i.number().optional(),
      deletedAt: i.number().optional().indexed(),
    }),
    todos: i.entity({
      text: i.string(),
      done: i.boolean(),
      createdAt: i.number(),
    }),
    tasks: i.entity({
      text: i.string(),
      createdAt: i.number().indexed(),
    }),
    conversations: i.entity({
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    messages: i.entity({
      text: i.string(),
      createdAt: i.number(),
    }),
  },
  links: {
    workspaceOwner: {
      forward: { on: "workspaces", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "ownedWorkspaces" },
    },
    workspaceMembers: {
      forward: { on: "workspaces", has: "many", label: "members" },
      reverse: { on: "$users", has: "many", label: "workspaces" },
    },
    caseWorkspace: {
      forward: { on: "cases", has: "one", label: "workspace" },
      reverse: { on: "workspaces", has: "many", label: "cases" },
    },
    caseNoteCase: {
      forward: { on: "caseNotes", has: "one", label: "case" },
      reverse: { on: "cases", has: "many", label: "notes" },
    },
    caseDocumentCase: {
      forward: { on: "caseDocuments", has: "one", label: "case" },
      reverse: { on: "cases", has: "many", label: "documents" },
    },
    todoWorkspace: {
      forward: { on: "todos", has: "one", label: "workspace" },
      reverse: { on: "workspaces", has: "many", label: "todos" },
    },
    todoOwner: {
      forward: { on: "todos", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "todos" },
    },
    taskWorkspace: {
      forward: { on: "tasks", has: "one", label: "workspace" },
      reverse: { on: "workspaces", has: "many", label: "tasks" },
    },
    taskAuthor: {
      forward: { on: "tasks", has: "one", label: "author" },
      reverse: { on: "$users", has: "many", label: "authoredTasks" },
    },
    conversationWorkspace: {
      forward: { on: "conversations", has: "one", label: "workspace" },
      reverse: { on: "workspaces", has: "many", label: "conversations" },
    },
    taskInterestedUsers: {
      forward: { on: "tasks", has: "many", label: "interestedUsers" },
      reverse: { on: "$users", has: "many", label: "interestedTasks" },
    },
    taskCase: {
      forward: { on: "tasks", has: "one", label: "case" },
      reverse: { on: "cases", has: "many", label: "tasks" },
    },
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    conversationParticipants: {
      forward: { on: "conversations", has: "many", label: "participants" },
      reverse: { on: "$users", has: "many", label: "conversations" },
    },
    messageConversation: {
      forward: { on: "messages", has: "one", label: "conversation" },
      reverse: { on: "conversations", has: "many", label: "messages" },
    },
    messageSender: {
      forward: { on: "messages", has: "one", label: "sender" },
      reverse: { on: "$users", has: "many", label: "sentMessages" },
    },
  },
  rooms: {
    chat: {
      presence: i.entity({
        name: i.string().optional(),
        typing: i.boolean().optional(),
        userId: i.string().optional(),
      }),
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
