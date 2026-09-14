# Badge — Role

**Category:** Atom
**Phase 4 source:** Header dropdown panel, Ticket Detail (owner border), Agent Kanban (owner border)

---

## Overview

A role indicator for users. Used in two contexts:
1. **Owner role border** on Ticket Detail and Agent Kanban — a 2-3px colored left-border on the owner avatar / name group, signaling which role the owner holds.
2. **Role pill** in the My Profile dropdown panel and (theoretically) elsewhere — a 22px tall pill, like the status badge but with role colors.

## Variants

Three role values. Role colors are used as both **borders** (left-border on owner rows) and **pills** (inside the dropdown).

| Role | Border / text | Pill background | Hex (border+text / bg) |
|---|---|---|---|
| **Employee** | medium grey | (no pill in MVP — border only) | `#adb5bd` |
| **Support Agent** | bright blue | light blue | `#4263eb` / `#edf2ff` |
| **Admin** | warm brown | (no pill in MVP — border only) | `#7a5c00` |

### Border-only mode (Ticket Detail owner avatar, Agent Kanban owner avatar)

- **Border:** 2-3px wide, role color
- **Background:** white (avatar bg)
- **Padding:** 2px (so the border sits outside the avatar)

### Pill mode (Header dropdown)

- **Shape:** 22px tall, `radius-pill` (11px)
- **Padding:** 0 8px
- **Text:** role color, `font-size-micro` (11px), `font-weight-semibold`

## States

Role badges are display-only; they have no interactive states. (The role dropdown in the Users tab is a different component — see [select](select.md).)

## Tokens Used

- `color-role-employee` (`#adb5bd`)
- `color-role-support-agent` (`#4263eb`), `color-role-support-agent-bg` (`#edf2ff`)
- `color-role-admin` (`#7a5c00`)
- `font-size-micro`, `font-weight-semibold`
- `radius-pill`

## Used In

- **Header dropdown** (`header-profile-logout.md`): the role pill inside the dropdown panel (below the user's display name).
- **Ticket Detail** (`ticket-detail.md`): the owner avatar / name group has a 2-3px role-color left border.
- **Agent Kanban** (`agent-kanban.md`): the owner avatar on each card has a 2-3px role-color left border.

## Usage Guidelines

**When to use:**
- To signal the role of the owner of a ticket (so Support Agents can see at a glance which colleagues are working on what).
- To display the current user's role in their own profile (My Profile dropdown).

**When NOT to use:**
- To show active/inactive status (use the green/grey circle indicator on Users tab).
- For ticket status (use [badge-status](badge-status.md)).

## Accessibility

- **Color is not the only signal:** when used as a pill, the role name is in text. When used as a left border, the role name is in the user's display name (e.g., "Sam Patel" — implicit role from avatar border + name).
- **Color contrast:** Support Agent pill (`#4263eb` on `#edf2ff`) = 5.7:1 (AAA). Admin border (`#7a5c00`) on white = 7.1:1 (AAA). Employee border (`#adb5bd`) on white = 3.0:1 (just meets AA for graphical elements).
- **Future enhancement:** if role is communicated visually without a text label, pair with an aria-label or icon to meet WCAG 1.4.1.
