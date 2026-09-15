import { Component } from '@angular/core';

/**
 * Agent Kanban Dashboard (Queue) placeholder.
 * Source spec: design-process/D-UX-Design/agent-kanban.md
 * Real implementation: HD-012 (4-column board + drag-and-drop + filters).
 *
 * Support Agents only — Admin does not see this page (HD-013).
 */
@Component({
  selector: 'app-agent-kanban-page',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div>
        <h1>Queue</h1>
        <p class="placeholder-subtitle">
          Placeholder — full implementation lands in HD-012.
          <br />Route: <code>/queue</code> (Support Agents only)
        </p>
      </div>
    </section>
  `,
})
export class AgentKanbanPageComponent {}
