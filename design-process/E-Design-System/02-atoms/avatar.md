# Avatar

**Category:** Atom
**Phase 4 source:** Ticket Detail (owner + submitter), Agent Kanban (card owner), Users tab (table rows), Header dropdown

---

## Overview

A circular avatar showing the user's initials on a grey background. Used wherever a person's identity is shown: ticket detail, kanban cards, user tables, profile dropdown.

## Variants

### Standard avatar

- **Diameter:** 24px (Agent Kanban cards), 32px (Ticket Detail, Users tab, Header dropdown), 16px (inline micro contexts — none in MVP)
- **Background:** `color-border-strong` (`#adb5bd`)
- **Text:** `color-on-primary` (`#ffffff`), `font-weight-semibold`, `font-size` proportional to diameter (10px for 24px, 12px for 32px)
- **Radius:** 50% (full circle)

### Role-border avatar (Ticket Detail, Agent Kanban)

- Same as Standard, with a 2-3px wide border on the left of the avatar (or surrounding the avatar — implementation choice).
- **Border color:** role color (see [badge-role](badge-role.md)).

### Inactive user avatar (Users tab)

- Same as Standard, but rendered at 50% opacity to signal deactivation. The Active toggle in the same row controls this state.
- **Opacity:** 0.5 when user is inactive.

## States

| State | Display |
|---|---|
| Default | grey circle with white initials |
| Inactive (Users tab) | grey circle at 50% opacity |
| Role-bordered (Ticket Detail, Agent Kanban) | grey circle with 2-3px role-color left border |

## Tokens Used

- `color-border-strong` (`#adb5bd`) for avatar background
- `color-on-primary` (`#ffffff`) for initials
- `color-role-employee`, `color-role-support-agent`, `color-role-admin` for role-border variants
- `font-weight-semibold`

## Used In

- **Ticket Detail** (`ticket-detail.md`): owner (right of "Owner:" label, 32px with role border), submitter (right of "Submitter:" label, 32px).
- **Agent Kanban** (`agent-kanban.md`): per card owner (24px with role border, in the meta row).
- **Users tab** (`users-tab.md`): per row in the Name column (32px, no role border — role is in the dropdown).
- **Header dropdown** (`header-profile-logout.md`): top of the dropdown panel (32px, no role border — role is in the pill below the name).

## Usage Guidelines

**When to use:**
- To identify a person at-a-glance.
- Wherever the user's name is shown, but visual identification helps (lists, rows, cards).

**When NOT to use:**
- When the user is unknown or anonymous (out of MVP — auth requires login).
- For decorative imagery (use illustration or icon).

## Accessibility

- **Initials only:** no profile pictures in MVP (out of scope per `header-profile-logout.md` §Open Questions).
- **alt text:** `alt="<display name>"` for the SVG/PNG representation.
- **Role border:** the border color communicates role, but the user's display name (always paired with the avatar) carries the textual identity.
- **Decorative contexts:** when avatar is purely decorative (paired with a name that already identifies the user), `alt=""` is acceptable.
