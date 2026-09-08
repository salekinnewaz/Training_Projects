# HelpDesk Lite --- Product Requirements Document

**Version:** 1.0\
**Status:** MVP Definition\
**Product Type:** Internal web-based ticket management system\
**Target Team Size:** 5--20 people

------------------------------------------------------------------------

## 1. Product Overview

HelpDesk Lite is a simple internal ticket management application for
small teams.

Instead of employees sending support requests through Slack, email, or
direct messages where requests can be lost or ownership can become
unclear, HelpDesk Lite provides one centralized place to:

-   Create support requests
-   Track ticket status
-   Assign ownership
-   Communicate through comments
-   Resolve issues
-   Maintain the history of each request

The product prioritizes simplicity, clarity, and fast ticket handling
over advanced enterprise features.

------------------------------------------------------------------------

## 2. Problem Statement

Small teams often handle support requests through multiple communication
channels such as Slack, email, direct messages, and informal
conversations.

This creates several problems:

-   Requests can be forgotten.
-   Nobody knows who owns an issue.
-   Users do not know the current status.
-   Support agents have difficulty finding pending work.
-   Previous conversations and resolutions are difficult to track.
-   Duplicate requests may be created.

### Problem to Solve

Provide a single, simple place where employees can submit, track, and
communicate about support requests while support agents can clearly see,
own, and resolve those requests.

------------------------------------------------------------------------

## 3. Product Goal

The primary goal is:

> Make support requests visible, organized, and easy to resolve for a
> small team.

The system should support this simple flow:

``` text
I have a problem
       ↓
Create Ticket
       ↓
Agent takes ownership
       ↓
Agent communicates
       ↓
Issue resolved
       ↓
User confirms
       ↓
Ticket closed
```

The workflow should require minimal friction and avoid unnecessary
steps.

------------------------------------------------------------------------

## 4. Target Users

### 4.1 Employee / User

Employees use the application to submit and track support requests.

They need to:

-   Create tickets quickly
-   See their tickets
-   Know who is handling their issue
-   Know the current status
-   Communicate with the support agent
-   Reopen a resolved issue if it was not fixed

### 4.2 Support Agent

Support agents are responsible for handling tickets.

They need to:

-   See available tickets
-   Take ownership
-   Update ticket status
-   Change priority
-   Assign tickets
-   Communicate with users
-   Resolve tickets

### 4.3 Administrator

The MVP should have only minimal administrative functionality.

Administrators can:

-   View users
-   Manage basic user roles
-   Activate or deactivate user accounts

Administration must not complicate the normal ticket workflow.

------------------------------------------------------------------------

## 5. MVP Scope

### Included

#### Authentication

-   Registration
-   Login
-   Logout
-   Password reset
-   Role-based access

#### Ticket Management

-   Create ticket
-   View ticket
-   Edit ticket while Open
-   Assign ticket
-   Change priority
-   Change status
-   Resolve ticket
-   Close ticket
-   Reopen a Resolved ticket

#### Comments

-   Add comments
-   View conversation history

#### Ticket Discovery

-   Ticket list
-   Search
-   Filtering
-   User dashboard
-   Agent dashboard

#### Basic User Management

-   View users
-   Manage roles
-   Activate/deactivate users

------------------------------------------------------------------------

## 6. Explicitly Out of Scope

The following features must NOT be implemented in the MVP:

-   AI features
-   File attachments
-   Email notifications
-   SLA management
-   Advanced analytics
-   Advanced reporting
-   Internal/private comments
-   Multiple assignees
-   Automatic ticket assignment
-   Complex team management
-   Customer satisfaction surveys
-   Knowledge base

These may be considered for future versions.

------------------------------------------------------------------------

## 7. Roles and Permissions

  Capability                                 User   Support Agent   Admin
  --------------------------- ------------------- --------------- -------
  Register/login                              Yes             Yes     Yes
  Create ticket                               Yes             Yes     Yes
  View own tickets                            Yes             Yes     Yes
  View all tickets                             No             Yes     Yes
  Comment                                     Yes             Yes     Yes
  Assign ticket                                No             Yes     Yes
  Change priority                              No             Yes     Yes
  Change status                                No             Yes     Yes
  Resolve ticket                               No             Yes     Yes
  Close resolved ticket         User confirmation              No      No
  Reopen resolved ticket                      Yes              No     Yes
  Manage users                                 No              No     Yes
  Manage roles                                 No              No     Yes
  Activate/deactivate users                    No              No     Yes

A person may have more than one role if required, but the normal
application workflow should remain simple.

------------------------------------------------------------------------

## 8. Ticket Model

Each ticket contains:

  Field         Required    Description
  ------------- ----------- -----------------------------
  ID            Automatic   Unique ticket identifier
  Title         Yes         Short issue title
  Description   Yes         Detailed issue description
  Category      No          IT, HR, Finance, General
  Priority      Yes         Low, Medium, High
  Status        Automatic   Current ticket state
  Created By    Automatic   User who created the ticket
  Assigned To   No          Responsible support agent
  Created At    Automatic   Creation timestamp
  Updated At    Automatic   Last modification timestamp

------------------------------------------------------------------------

## 9. Categories

Initial categories:

-   IT
-   HR
-   Finance
-   General

Category is optional during ticket creation.

Categories primarily support organization and filtering. Users should
not be forced to understand categorization before submitting an issue.

------------------------------------------------------------------------

## 10. Priority

The MVP has three priority levels:

-   Low
-   Medium
-   High

Users can select a priority when creating a ticket.

Support agents can change the priority later.

Priority should be clearly visible in ticket lists, dashboards, and
ticket details.

------------------------------------------------------------------------

## 11. Ticket Status Workflow

The MVP uses four statuses:

``` text
OPEN
  ↓
IN PROGRESS
  ↓
RESOLVED
  ↓
CLOSED
```

### Reopen Flow

If an agent marks a ticket as Resolved, the user can reopen it if the
problem still exists.

``` text
              ┌──────────────────┐
              │                  │
              ▼                  │
OPEN → IN PROGRESS → RESOLVED    │
                    │            │
                    ▼            │
                  CLOSED         │
                                 │
                    User reopens │
                                 │
                                 └──→ OPEN
```

### Important Reopen Rule

A ticket can only be reopened while it is **Resolved**.

Once it becomes **Closed**, it cannot be reopened. If the problem
returns after closure, the user must create a new ticket.

This boundary must be enforced by both the UI and backend
authorization/business logic.

------------------------------------------------------------------------

## 12. Ticket Assignment

The MVP uses simple ownership.

Each ticket has zero or one assigned support agent.

An agent can:

-   Take ownership of an unassigned ticket
-   Assign a ticket to another agent
-   Unassign a ticket

Multiple agents cannot own the same ticket simultaneously.

The assignment model exists to answer one simple question:

> Who is responsible for this ticket?

Automatic assignment is out of scope.

------------------------------------------------------------------------

## 13. Comments

Comments provide the communication and resolution history for a ticket.

Example:

``` text
User:
My VPN is not connecting.

Agent:
Can you restart the VPN application?

User:
I restarted it but the problem remains.

Agent:
I will investigate the issue.
```

Comments remain associated with the ticket throughout its lifecycle.

The MVP does not support private/internal comments.

------------------------------------------------------------------------

## 14. User Experience

### 14.1 User Dashboard

The user dashboard should focus on the user's own tickets.

Example:

``` text
My Tickets

Open             3
In Progress      2
Resolved         1

----------------------------------
ID      Title             Status
----------------------------------
#1001   VPN Issue         Open
#1002   Email Problem     In Progress
#1003   Laptop Issue      Resolved
```

Primary action:

**+ Create Ticket**

### 14.2 Create Ticket

The form should be intentionally small.

``` text
Create Ticket

Title
[________________________]

Description
[                        ]
[                        ]

Category
[ IT ▼ ]

Priority
[ Medium ▼ ]

[ Create Ticket ]
```

Required fields:

-   Title
-   Description
-   Priority

Optional field:

-   Category

### 14.3 Agent Dashboard

The agent dashboard should focus on work that needs attention.

Example:

``` text
Tickets

Open           12
In Progress     8
Resolved       24

Search [________________]

Filter:
Status | Priority | Category | Assignee

-----------------------------------------
ID     Title           Priority   Status
-----------------------------------------
1001   VPN Issue       High       Open
1002   Email Issue     Medium     In Progress
1003   Laptop Issue    Low        Open
```

The agent should quickly be able to answer:

1.  What needs attention?
2.  Who owns it?
3.  How urgent is it?
4.  What is its current status?

### 14.4 Ticket Details

The ticket details page should contain everything needed to understand
and handle the ticket.

``` text
#1001 — VPN Issue

Status:     In Progress
Priority:   High
Category:   IT
Created by: John
Assigned:   Sarah

--------------------------------

Description

I cannot connect to the company VPN.

--------------------------------

Comments

Sarah:
Please restart the VPN application.

John:
I tried restarting but it still doesn't work.

--------------------------------

[ Write a comment... ]

[ Send ]
```

Agent controls should provide easy access to:

-   Status
-   Priority
-   Assignee
-   Resolve action

------------------------------------------------------------------------

## 15. Search and Filtering

Support agents can search tickets by:

-   Ticket ID
-   Title
-   Description

Agents can filter tickets by:

-   Status
-   Priority
-   Category
-   Assignee

Users can only search and filter within their own tickets.

Search and filtering should be simple and fast.

------------------------------------------------------------------------

## 16. Authentication and Authorization

The MVP uses email and password authentication.

The system must support:

-   Registration
-   Login
-   Logout
-   Password reset
-   Role-based authorization

Authentication must be implemented securely.

Authorization must be enforced server-side; hiding UI controls alone is
not sufficient.

Users must not be able to access tickets or administrative functionality
that their role does not permit.

------------------------------------------------------------------------

## 17. Recommended Screens

The MVP should contain these primary screens:

1.  Login
2.  Registration
3.  Password Reset
4.  User Dashboard
5.  Agent Dashboard
6.  Create Ticket
7.  Ticket Details
8.  User Management
9.  Basic Profile/Account screen

Avoid creating separate screens when a simple section or modal can
handle the operation.

------------------------------------------------------------------------

## 18. UX Principles

The application should follow these principles:

### Simple

Users should be able to create a ticket quickly.

### Clear

Status, priority, and ownership should be immediately visible.

### Familiar

Use a clean SaaS-style interface with a simple list/table experience and
optional Kanban-style status visualization for agents.

### Low Friction

Avoid unnecessary forms, fields, confirmation dialogs, and navigation.

### Role Focused

Users should see their requests. Agents should see their work. Admins
should see user management.

------------------------------------------------------------------------

## 19. Functional Requirements

### FR-01 --- Authentication

The system must allow users to register and authenticate using email and
password.

### FR-02 --- Authorization

The system must enforce role-based access to protected functionality.

### FR-03 --- Create Ticket

A user must be able to create a ticket using title, description,
priority, and optional category.

### FR-04 --- View Tickets

Users must be able to view their own tickets. Agents and admins must be
able to view tickets according to their permissions.

### FR-05 --- Edit Ticket

Users may edit their ticket while its status is Open.

### FR-06 --- Ticket Assignment

Agents must be able to take ownership of unassigned tickets and assign
tickets to other agents.

### FR-07 --- Ticket Priority

Agents must be able to update ticket priority.

### FR-08 --- Ticket Status

Agents must be able to update ticket status according to the defined
lifecycle.

### FR-09 --- Comments

Users and agents must be able to add comments to tickets they are
authorized to access.

### FR-10 --- Resolve Ticket

An agent must be able to mark an active ticket as Resolved.

### FR-11 --- Close Ticket

A Resolved ticket must be closable through user confirmation.

### FR-12 --- Reopen Ticket

A user must be able to reopen a Resolved ticket if the issue remains
unresolved.

### FR-13 --- Closed Ticket Boundary

A Closed ticket cannot be reopened. A new ticket must be created for a
new occurrence.

### FR-14 --- Search

Authorized users must be able to search tickets within their permitted
scope.

### FR-15 --- Filtering

Agents must be able to filter tickets by status, priority, category, and
assignee.

### FR-16 --- Dashboard

The system must provide basic ticket counts appropriate to the user's
role.

### FR-17 --- User Management

Admins must be able to view users and manage their basic role and
active/inactive state.

### FR-18 --- Ticket Ownership

Every assigned ticket must have no more than one responsible agent.

------------------------------------------------------------------------

## 20. Business Rules

1.  Every ticket must have a creator.
2.  Every ticket must have a title and description.
3.  Every ticket must have a priority.
4.  Category is optional.
5.  A ticket can have zero or one assigned agent.
6.  Only authorized agents/admins can change assignment.
7.  Users can edit tickets only while they are Open.
8.  Only agents/admins can resolve tickets.
9.  A Resolved ticket can be reopened by the user.
10. Reopening a Resolved ticket changes its status to Open.
11. A Closed ticket cannot be reopened.
12. A new issue after closure requires a new ticket.
13. Comments belong to exactly one ticket and one author.
14. Users can only access tickets within their permitted scope.
15. Inactive users cannot authenticate or perform normal application
    actions.

------------------------------------------------------------------------

## 21. Key User Stories

### User Stories --- Employee

**US-01 --- Create Ticket**

> As an employee, I want to create a support ticket so that I can report
> an issue to the support team.

**Acceptance Criteria**

-   User can enter a title.
-   User can enter a description.
-   User can select priority.
-   User can optionally select a category.
-   Ticket is created with Open status.
-   User becomes the ticket creator.
-   Ticket receives a unique ID.

------------------------------------------------------------------------

**US-02 --- View My Tickets**

> As an employee, I want to view my tickets so that I know the status of
> my requests.

**Acceptance Criteria**

-   User can see their tickets.
-   User can see status.
-   User can see priority.
-   User can see assignee.
-   User cannot see another user's private ticket data.

------------------------------------------------------------------------

**US-03 --- Comment on Ticket**

> As an employee, I want to comment on a ticket so that I can
> communicate with the support agent.

**Acceptance Criteria**

-   User can add a comment to an accessible ticket.
-   Comment shows author and timestamp.
-   Comments appear in chronological order.

------------------------------------------------------------------------

**US-04 --- Reopen Ticket**

> As an employee, I want to reopen a resolved ticket when the issue is
> not fixed so that I do not need to create a duplicate request.

**Acceptance Criteria**

-   Reopen is available only when status is Resolved.
-   Reopening changes status to Open.
-   Existing comments remain.
-   Existing ticket history remains available.
-   Closed tickets cannot be reopened.

------------------------------------------------------------------------

### User Stories --- Support Agent

**US-05 --- View Tickets**

> As a support agent, I want to view available tickets so that I can
> identify work that needs attention.

**Acceptance Criteria**

-   Agent can view authorized tickets.
-   Tickets show status, priority, and assignee.
-   Unassigned tickets are clearly identifiable.

------------------------------------------------------------------------

**US-06 --- Take Ownership**

> As a support agent, I want to assign a ticket to myself so that
> ownership is clear.

**Acceptance Criteria**

-   Agent can take an unassigned ticket.
-   The agent becomes the assigned owner.
-   Other agents see the updated assignment.

------------------------------------------------------------------------

**US-07 --- Update Ticket**

> As a support agent, I want to update status and priority so that the
> ticket accurately reflects its current state.

**Acceptance Criteria**

-   Agent can update priority.
-   Agent can update status.
-   Changes are persisted.
-   Updated values are visible to authorized users.

------------------------------------------------------------------------

**US-08 --- Communicate**

> As a support agent, I want to comment on a ticket so that I can
> communicate with the employee.

**Acceptance Criteria**

-   Agent can add comments.
-   Comments appear in ticket history.
-   User can see agent comments.

------------------------------------------------------------------------

**US-09 --- Resolve Ticket**

> As a support agent, I want to resolve a ticket so that the employee
> knows the issue has been addressed.

**Acceptance Criteria**

-   Agent can mark an active ticket Resolved.
-   User can see the Resolved status.
-   User can reopen it if the issue remains.

------------------------------------------------------------------------

### User Stories --- Admin

**US-10 --- Manage Users**

> As an administrator, I want to manage users and roles so that only
> authorized users can access appropriate functionality.

**Acceptance Criteria**

-   Admin can view users.
-   Admin can view roles.
-   Admin can activate/deactivate users.
-   Admin can update basic roles.
-   Non-admin users cannot access user management.

------------------------------------------------------------------------

# 22. Non-Functional Requirements

### Performance

-   Normal page interactions should feel responsive.
-   Ticket lists should load efficiently for the expected small-team
    dataset.
-   Search and filtering should not require full-page reloads where
    practical.

### Security

-   Passwords must never be stored in plain text.
-   Authentication credentials must be handled securely.
-   Server-side authorization is required.
-   Users must not access unauthorized tickets by manipulating IDs or
    API requests.
-   Input validation must be applied on the server.
-   User-generated content must be safely handled and rendered.

### Reliability

-   Ticket and comment data must be persisted reliably.
-   A failed operation should provide a clear error message.
-   The application should not silently lose submitted ticket or comment
    data.

### Maintainability

-   Keep the architecture simple.
-   Avoid unnecessary abstractions.
-   Keep business rules centralized and testable.
-   Use clear naming and consistent project structure.

### Accessibility

-   Forms should have proper labels.
-   Interactive controls should be keyboard accessible.
-   Status and priority should not rely on color alone.
-   Basic WCAG-friendly practices should be followed.

------------------------------------------------------------------------

## 23. Data Model

### User

``` text
User
----
id
name
email
passwordHash
role
isActive
createdAt
updatedAt
```

### Ticket

``` text
Ticket
------
id
title
description
category
priority
status
createdBy
assignedTo
createdAt
updatedAt
```

### Comment

``` text
Comment
-------
id
ticketId
userId
message
createdAt
```

### Relationships

``` text
User
 │
 ├── creates ──────────→ Ticket
 │
 └── writes ───────────→ Comment
                           │
                           └── belongs to → Ticket
```

------------------------------------------------------------------------

## 24. Suggested API Areas

The exact API design can be finalized during architecture, but the MVP
should provide logical REST endpoints for:

### Authentication

``` text
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/password-reset
```

### Tickets

``` text
GET    /tickets
POST   /tickets
GET    /tickets/:id
PATCH  /tickets/:id
```

### Assignment

``` text
PATCH  /tickets/:id/assignee
```

### Status / Priority

``` text
PATCH  /tickets/:id/status
PATCH  /tickets/:id/priority
```

### Comments

``` text
GET    /tickets/:id/comments
POST   /tickets/:id/comments
```

### Users

``` text
GET    /users
PATCH  /users/:id
```

These are conceptual API areas, not a mandate to implement every
endpoint exactly as written.

------------------------------------------------------------------------

## 25. Testing Requirements

The MVP should include:

### Unit Tests

Test:

-   Ticket status rules
-   Reopen rules
-   Permission rules
-   Validation
-   Priority/category handling

### Integration Tests

Test:

-   Authentication
-   Ticket creation
-   Ticket updates
-   Assignment
-   Comments
-   Authorization

### E2E Tests

At minimum, cover the complete critical workflow:

``` text
User registers/logs in
        ↓
Creates ticket
        ↓
Agent logs in
        ↓
Agent takes ownership
        ↓
Agent comments
        ↓
Agent resolves ticket
        ↓
User sees Resolved
        ↓
User closes ticket
```

Also test:

``` text
Agent resolves ticket
        ↓
User reopens ticket
        ↓
Ticket becomes Open
        ↓
History remains intact
```

And verify:

``` text
Closed ticket
      ↓
Cannot reopen
      ↓
User must create new ticket
```

------------------------------------------------------------------------

## 26. Definition of Done

The HelpDesk Lite MVP is complete when:

### User can

-   Register/login
-   Create a ticket
-   View their tickets
-   View ticket details
-   Comment on tickets
-   See status and assignment
-   Reopen a Resolved ticket

### Support Agent can

-   Login
-   View authorized tickets
-   Search tickets
-   Filter tickets
-   Take ownership
-   Assign tickets
-   Change priority
-   Change status
-   Comment
-   Resolve tickets

### Admin can

-   Login
-   View users
-   Manage basic roles
-   Activate/deactivate users

### System can

-   Authenticate users
-   Enforce roles
-   Persist tickets
-   Persist comments
-   Maintain ticket relationships
-   Enforce ticket lifecycle rules
-   Prevent unauthorized access

### Complete workflow works

``` text
User creates ticket
       ↓
Agent sees ticket
       ↓
Agent takes ownership
       ↓
Agent communicates
       ↓
Agent resolves ticket
       ↓
User confirms
       ↓
Ticket closed
```

And:

``` text
Resolved
   ↓
User says "still not fixed"
   ↓
Reopen
   ↓
Open
```

------------------------------------------------------------------------

## 27. Success Metrics

The MVP should be evaluated primarily on usability.

### Primary success criteria

-   A user can create a ticket quickly.
-   An agent can identify unassigned tickets quickly.
-   Every active ticket has clear ownership.
-   Users can determine the current status of their tickets.
-   Ticket communication and history remain in one place.
-   The small team can use the application instead of relying on
    scattered Slack/email/DM requests.

### MVP Success Definition

> A small team of 5--20 people can use HelpDesk Lite as their primary
> place for handling internal support requests without requiring the
> excluded enterprise features.

------------------------------------------------------------------------

## 28. Future Roadmap

### Version 2

Potential additions:

-   Email notifications
-   File attachments
-   Improved dashboards
-   More advanced administration
-   Team management

### Version 3

Potential additions:

-   SLA tracking
-   Knowledge base
-   Automatic assignment
-   Advanced reporting
-   AI ticket categorization
-   AI-generated response suggestions

These features must not be added to the MVP unless the product scope is
explicitly revised.

------------------------------------------------------------------------

## 29. Product Principles

1.  **Keep it simple.**
2.  **Make ownership obvious.**
3.  **Make status obvious.**
4.  **Minimize the number of clicks required to create or handle a
    ticket.**
5.  **Keep the complete conversation with the ticket.**
6.  **Prefer simple business rules over complex workflows.**
7.  **Do not add features simply because they are common in enterprise
    helpdesk products.**
8.  **Every MVP feature must directly help users submit, understand,
    own, communicate about, or resolve a ticket.**

------------------------------------------------------------------------

## 30. Final MVP Boundary

The MVP is intentionally limited to:

``` text
                    HELP DESK LITE
                          │
          ┌───────────────┴───────────────┐
          │                               │
        USER                         SUPPORT AGENT
          │                               │
    Create Ticket                    View Tickets
    View Tickets                     Take Ownership
    Comment                           Assign
    Reopen                            Update Status
                                      Update Priority
                                      Comment
                                      Resolve
          │                               │
          └───────────────┬───────────────┘
                          │
                       TICKET
                          │
             ┌────────────┼────────────┐
             │            │            │
           Status      Priority     Assignee
             │
      Open → In Progress
             → Resolved
             → Closed
```

The product should remain small, focused, and fully functional before
any advanced features are introduced.
