# HelpDesk Lite

## Project Overview

HelpDesk Lite is a simple web-based ticket management system for handling employee support requests.

Users can create support tickets and track their issues. Support agents can view, manage, and resolve tickets. Administrators can monitor users, agents, and overall ticket activity.

The goal is to build a small, easy-to-use support system with a clear ticket lifecycle.

## User Roles

### User

* Create support tickets
* View their own tickets
* View ticket details
* Add comments to their tickets
* Reopen resolved or closed tickets

### Support Agent

* View all tickets
* Assign tickets to themselves
* Change ticket status
* Change ticket priority
* Add comments
* Resolve tickets

### Admin

* View all tickets
* View users and agents
* View a simple dashboard
* Manage users

## Ticket Fields

Each ticket contains:

* Ticket ID
* Title
* Description
* Category
* Priority
* Status
* Created By
* Assigned Agent
* Created Date
* Updated Date

## Categories

* IT
* HR
* Finance
* General

## Priorities

* Low
* Medium
* High

## Statuses

* Open
* In Progress
* Waiting for User
* Resolved
* Closed

## Core Workflow

1. A user creates a ticket.
2. The ticket starts with Open status.
3. A support agent takes or assigns the ticket.
4. The agent works on the issue and changes the status to In Progress.
5. The agent can communicate with the user through comments.
6. Once the issue is solved, the agent marks the ticket as Resolved.
7. The user can confirm the solution and the ticket becomes Closed.
8. If the problem is not solved, the user can reopen the ticket.

## MVP Screens

1. Login
2. User Dashboard
3. Create Ticket
4. Ticket Details
5. Agent Dashboard
6. Admin Dashboard

## MVP Database

The initial application should use only three main entities:

* Users
* Tickets
* Comments

## MVP Goal

Build a functional and clean ticket management system with authentication, role-based access, ticket creation, ticket management, comments, and a simple dashboard.

The first version should prioritize simplicity and a working end-to-end ticket workflow over advanced features.
