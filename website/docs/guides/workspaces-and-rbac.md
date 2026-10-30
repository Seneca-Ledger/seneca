---
title: Workspaces and RBAC
description: Multi-tenant setup and permissions
---

Stoic Budget is multi-tenant by design. Every statement, transaction, and report belongs to a workspace.

## Core concepts

- **Workspace**: Isolated data domain for a company or business unit
- **Workspace members**: Users with a workspace role
- **Permissions**: Controllers declare them with `@WorkspaceAuth(Permission.X)`, which applies the JWT,
  workspace-context and permissions guards together

## How a permission is granted

A request passes when either layer allows it:

1. **Global user role** — `admin`, `user` or `viewer`, each with a set of permissions (or custom
   permissions set on the user). A global `admin` passes every check and can open the `/admin`
   dashboard.
2. **Workspace role** — `owner`, `admin`, `member` or `viewer`:
   - Owners and admins manage workspace settings and integrations (webhooks included), view the
     audit log, and create, edit and delete budgets, wallets, investments, metals, balance-sheet
     lines, payables, categories, branches and subscriptions.
   - Uploading, editing and deleting statements and transactions is allowed for workspace members
     unless their `canEditStatements` flag is `false`; owners and admins always have it.

Per-member flags — `canEditStatements`, `canEditCustomTables`, `canEditCategories`,
`canEditDataEntry` and `canShareFiles` — are set when inviting or editing a member. Admins cannot
change other admins or the owner, and an owner's role changes only through an ownership transfer.

## Workspace setup

1. Create a workspace during onboarding.
2. Invite members from **Settings → Workspace**. Invitation emails need SMTP; without it the
   invitation link is returned in the API response. Invitees accept at `/invite`.
3. Assign roles and member permissions.

## Audit log

The audit log tracks key mutations, including imports, deletions, and permission changes. Workspace
owners and admins can view it. Rolling back an event requires the global `admin` role and works only
for events that support undo.

Next: [Integrations](integrations)
