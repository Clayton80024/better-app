// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  workspaces: {
    allow: {
      view: "isMember",
      create: "auth.id != null",
      update: "isMember",
      delete: "isOwner",
    },
    bind: {
      isMember: "auth.id != null && (auth.id in data.ref('owner.id') || auth.id in data.ref('members.id'))",
      isOwner: "auth.id != null && auth.id in data.ref('owner.id')",
    },
  },
  todos: {
    allow: {
      view: "isOwnerOrWorkspaceMember",
      create: "isOwnerAndWorkspaceMember",
      update: "isOwnerOrWorkspaceMember",
      delete: "isOwnerOrWorkspaceMember",
    },
    bind: {
      isOwnerOrWorkspaceMember: "auth.id != null && (auth.id in data.ref('owner.id') || auth.id in data.ref('workspace.members.id'))",
      isOwnerAndWorkspaceMember: "auth.id != null && auth.id in data.ref('owner.id') && auth.id in data.ref('workspace.members.id')",
    },
  },
  $users: {
    allow: {
      view: "auth.id != null",
      create: "false",
      delete: "false",
      update: "auth.id == data.id",
    },
  },
  cases: {
    allow: {
      view: "isWorkspaceMember",
      create: "isWorkspaceMember",
      update: "isWorkspaceMember",
      delete: "isWorkspaceMember",
    },
    bind: {
      isWorkspaceMember: "auth.id != null && (auth.id in data.ref('workspace.owner.id') || auth.id in data.ref('workspace.members.id'))",
    },
  },
  caseNotes: {
    allow: {
      view: "isCaseWorkspaceMember",
      create: "isCaseWorkspaceMember",
      update: "isCaseWorkspaceMember",
      delete: "isCaseWorkspaceMember",
    },
    bind: {
      isCaseWorkspaceMember: "auth.id != null && (auth.id in data.ref('case.workspace.owner.id') || auth.id in data.ref('case.workspace.members.id'))",
    },
  },
  caseDocuments: {
    allow: {
      view: "isCaseWorkspaceMember",
      create: "isCaseWorkspaceMember",
      update: "isCaseWorkspaceMember",
      delete: "isCaseWorkspaceMember",
    },
    bind: {
      isCaseWorkspaceMember: "auth.id != null && (auth.id in data.ref('case.workspace.owner.id') || auth.id in data.ref('case.workspace.members.id'))",
    },
  },
  tasks: {
    allow: {
      view: "isWorkspaceMember",
      create: "isWorkspaceMemberAndAuthor",
      update: "isWorkspaceMember",
      delete: "isWorkspaceMember",
    },
    bind: {
      isWorkspaceMember: "auth.id != null && (auth.id in data.ref('workspace.owner.id') || auth.id in data.ref('workspace.members.id'))",
      isWorkspaceMemberAndAuthor: "auth.id != null && auth.id in data.ref('author.id') && (auth.id in data.ref('workspace.owner.id') || auth.id in data.ref('workspace.members.id'))",
    },
  },
  conversations: {
    allow: {
      view: "isParticipant",
      create: "auth.id != null",
      update: "isParticipant",
      delete: "false",
    },
    bind: {
      isParticipant: "auth.id in data.ref('participants.id')",
    },
  },
  messages: {
    allow: {
      view: "auth.id in data.ref('conversation.participants.id')",
      create: "auth.id != null && auth.id in data.ref('conversation.participants.id') && auth.id in data.ref('sender.id')",
      update: "false",
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
