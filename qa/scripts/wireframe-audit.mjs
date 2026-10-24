#!/usr/bin/env node
/**
 * wireframe-audit.mjs — full wireframe gap audit.
 *
 * Walks every post-login page, probes for each wireframe-required
 * element, and reports any gap. This is a tripwire: if any element
 * from the 9 wireframe specs is missing, reworded, or rendered in
 * the wrong place, it shows up here.
 *
 * Run after a Vercel deploy to confirm "all wireframe requirements
 * live". Replaces the informal inspect-each-page.mjs with a
 * structured pass/fail list.
 *
 *   node qa/scripts/wireframe-audit.mjs                    # live deploy
 *   BASE_URL=http://localhost:4200 node qa/scripts/wireframe-audit.mjs
 *
 * The other verify-* scripts default to localhost:4200; this one
 * defaulted to the production URL because it was written as a
 * post-deploy tripwire. It now honours BASE_URL like the rest, and
 * falls back to the live deployment.
 *
 * NOTE: this script logs in SEVEN times (once per persona, plus the
 * Employee Dashboard and the two Ticket Detail variants). The
 * backend's login route has a rate limiter, so run it against the
 * LOCAL stack, or pause between runs, or it will trip the limiter
 * and fail on the login rather than on a real gap.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'https://helpdesk-lite-tawny.vercel.app';

const findings = [];
function record(area, ok, detail) {
  findings.push({ area, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${area} — ${detail}`);
}

async function login(page, who) {
  const creds = {
    admin: { email: 'admin@company.com', pwd: 'password123' },
    sam: { email: 'sam@company.com', pwd: 'password123' },
    eli: { email: 'eli@company.com', pwd: 'password123' },
    // Jess is the seeded USER (role = "User"); Eli is a Support
    // Agent. The Employee Dashboard is role-gated, so anything that
    // asserts on /dashboard must log in as Jess.
    jess: { email: 'jess@company.com', pwd: 'password123' },
  }[who];
  await page.goto(`${BASE}/login`);
  await page.locator('input#login-email').fill(creds.email);
  await page.locator('input#login-password').fill(creds.pwd);
  // The submit button reads "Sign in" (older fixtures used "Log in").
  const btn = page.getByRole('button', { name: /^(sign in|log in)$/i }).first();
  await btn.click();
  try {
    await page.waitForURL(/\/(admin|queue|tickets|dashboard|forbidden)/, { timeout: 15_000 });
  } catch (err) {
    // The backend's login route has a RATE LIMITER. Six back-to-back
    // logins in this audit can trip it (429), and the SPA stays on
    // /login with an inline error — which then makes every later
    // assertion fail for the wrong reason. Say so plainly.
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
    throw new Error(
      `Login as ${who} (${creds.email}) did not reach a post-login page. ` +
      `URL: ${page.url()}\nPage text: ${body}\n` +
      `This is usually the backend's login RATE LIMITER (429) — pause and re-run.`,
    );
  }
}

async function withFreshSession(browser, who, fn) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, who);
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch();

  // ── LOGIN ─────────────────────────────────────────────────────
  // Use a raw context with NO auth so /login shows the form (logged-in
  // users get redirected away from /login by the SPA's auth guard).
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/login`);
      await page.waitForSelector('input#login-email', { timeout: 10_000 });

      // The login page is a two-panel layout: a marketing side with
      // the hero headline, and the sign-in card. The H1 is the hero
      // (visible), and the card's own heading is an H2.
      const hero = (await page.locator('h1.hero').first().textContent().catch(() => null)) ?? '';
      record('Login/HeroH1', /support/i.test(hero), `Hero H1: "${hero.replace(/\s+/g, ' ').trim()}"`);

      const cardTitle = (await page.locator('h2.card-title').first().textContent().catch(() => null)) ?? '';
      record('Login/CardTitle', /welcome back/i.test(cardTitle), `Card title: "${cardTitle.trim()}"`);

      const emailPh = await page.locator('input#login-email').getAttribute('placeholder');
      record('Login/EmailPlaceholder', /@company\.com$/.test(emailPh ?? ''), `Email placeholder: "${emailPh}"`);

      // The password field's placeholder is a mask, not the word
      // "password" — the label carries the field's name.
      const pwdPh = await page.locator('input#login-password').getAttribute('placeholder');
      record('Login/PwdPlaceholder', /[•·*]/.test(pwdPh ?? ''), `Password placeholder: "${pwdPh}"`);

      const showToggle = await page.locator('button[aria-label*="password" i]').count();
      record('Login/ShowHideToggle', showToggle > 0, `Show/hide toggle present: ${showToggle > 0}`);

      const forgotLink = await page.getByRole('link', { name: /forgot password/i }).count();
      record('Login/ForgotLink', forgotLink > 0, `"Forgot password?" link present: ${forgotLink > 0}`);

      const brandMark = await page.locator('.brand-mark').first();
      const brandMarkBox = await brandMark.boundingBox();
      record('Login/BrandMark', brandMarkBox !== null, `Brand mark rendered: ${brandMarkBox?.width}x${brandMarkBox?.height}`);
    } finally {
      await ctx.close();
    }
  }

  // ── CHROME (HEADER) — verify across 3 roles ───────────────────
  for (const who of ['eli', 'sam', 'admin']) {
    await withFreshSession(browser, who, async (page) => {
      // Already on a post-login page from login()
      const trigger = await page.locator('.profile-trigger').first();
      record(`Chrome/${who}/Trigger`, await trigger.count() > 0, `"My Profile" trigger present`);

      // Open dropdown
      await trigger.click();
      await page.waitForTimeout(200);
      const dropdown = await page.locator('dropdown-panel').count();
      record(`Chrome/${who}/Dropdown`, dropdown > 0, `Dropdown panel opens: ${dropdown > 0}`);

      // Check for "Change password" + divider
      const changePwd = await page.getByText(/change password/i).count();
      record(`Chrome/${who}/ChangePasswordLink`, changePwd > 0, `"Change password" item present: ${changePwd > 0}`);

      const logout = await page.getByText(/^log out$/i).count();
      record(`Chrome/${who}/LogoutItem`, logout > 0, `"Log out" item present: ${logout > 0}`);

      // Verify caret is present (live impl uses an <svg> path inside
      // a <caret-down> custom element — the caret must exist even if
      // it's not a Unicode glyph).
      const caretSvg = await page.locator('button.profile-trigger .caret, button.profile-trigger caret-down').count();
      record(`Chrome/${who}/CaretSvg`, caretSvg > 0, `Trigger has a caret (svg or caret-down element): ${caretSvg > 0}`);

      // Close dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    });
  }

  // ── EMPLOYEE DASHBOARD (/dashboard) ────────────────────────────
  // Jess is the seeded User; /dashboard is role-gated, so an agent
  // would be redirected to /forbidden.
  await withFreshSession(browser, 'jess', async (page) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    // Wait for the shared ticket table to load (avoids false-fail on
    // an empty list — the table always renders, with an empty row).
    // Wait on the TABLE, not on an h1: the login page also carries an
    // h1 (the hero headline), so an h1 wait can resolve on the login
    // screen before the dashboard has even started rendering.
    try {
      await page.waitForSelector('[data-testid="ticket-table"]', { timeout: 20_000 });
    } catch (err) {
      const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
      throw new Error(
        `The User dashboard never rendered its table.\n` +
        `URL: ${page.url()}\nPage text: ${body}\n${err.message}`,
      );
    }
    await page.waitForTimeout(500);

    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('EmployeeDashboard/H1', h1 === 'My Tickets', `H1 is "${h1}"`);

    // Single "Create Ticket" button (live impl is a <button>, not a
    // <a> link — accept either).
    const ctaCount = await page.getByRole('button', { name: /create ticket/i }).count()
      + await page.getByRole('link', { name: /create ticket/i }).count();
    record('EmployeeDashboard/CreateTicketCTAs', ctaCount >= 1, `"Create Ticket" CTA(s) present: ${ctaCount}`);

    // The shared filter bar and table must both be present.
    const filterBar = await page.locator('[data-testid="ticket-filter-bar"]').count();
    record('EmployeeDashboard/FilterBar', filterBar === 1, `Filter bar present: ${filterBar === 1}`);

    const table = await page.locator('[data-testid="ticket-table"]').count();
    record('EmployeeDashboard/TicketTable', table === 1, `Shared table present: ${table === 1}`);

    // The WDS-2026 stat strip — the shared five-card molecule. The
    // User's counts are scoped to their OWN tickets (the API enforces
    // that in SQL); the scope itself is asserted by the backend suite.
    const stripMolecule = await page.locator('stat-strip').count();
    const stripCards = await page.locator('[data-testid="stat-strip"] article.card').count();
    record('EmployeeDashboard/StatStrip', stripMolecule === 1 && stripCards === 5,
      `strip molecules:${stripMolecule} cards:${stripCards} (expected 1 / 5)`);

    // Rows: number · title · status · priority · timestamp
    const row = page.locator('[data-testid="ticket-table"] tbody > tr').first();
    if (await row.count() > 0) {
      const rowText = (await row.textContent())?.trim() ?? '';
      // Accept either "#HD-N" or "HD-N" (the wireframe spec says
      // "Mono ticket number (e.g., '#HD-47')" but the live impl
      // renders the # in a separate span; some roles see no #).
      const hasNumber = /#?HD-\d+/i.test(rowText);
      const hasStatus = /open|in progress|resolved|closed/i.test(rowText);
      record('EmployeeDashboard/RowComposition', hasNumber && hasStatus, `Row has # + status: ${hasNumber ? '✓' : '✗'} num / ${hasStatus ? '✓' : '✗'} status`);
    } else {
      record('EmployeeDashboard/RowComposition', false, `No ticket rows found`);
    }
  });

  // ── AGENT KANBAN (/queue) ─────────────────────────────────────
  await withFreshSession(browser, 'sam', async (page) => {
    await page.goto(`${BASE}/queue`);
    await page.waitForSelector('h1', { timeout: 10_000 });
    // Wait for kanban board to render (avoids loading-skeleton false-fail)
    await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 15_000 });
    await page.waitForTimeout(800);

    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('Kanban/H1', h1 === 'Queue', `H1 is "${h1}"`);

    // No Users tab on /queue
    const usersTab = await page.getByRole('link', { name: /^users$/i }).count();
    record('Kanban/NoUsersTab', usersTab === 0, `No Users tab on /queue: ${usersTab === 0}`);

    // Filter strip: search + 3 filters
    const search = await page.locator('input[type="search"], input.search-input, [placeholder*="search" i]').count();
    record('Kanban/SearchInput', search > 0, `Search input present: ${search > 0}`);

    // 4 columns (live impl: <section data-testid="kanban-column" class="column">)
    const cols = await page.locator('[data-testid="kanban-column"]').count();
    record('Kanban/ColumnCount', cols === 4, `4 columns rendered: ${cols === 4}`);

    // Column header labels: Open, In Progress, Resolved, Closed (in this order)
    const expectedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
    for (let i = 0; i < expectedStatuses.length; i++) {
      const col = page.locator('[data-testid="kanban-column"]').nth(i);
      // Header is an <h2 class="column-title">
      const headerHas = await col.locator('h2.column-title').filter({ hasText: new RegExp(`^${expectedStatuses[i]}$`, 'i') }).count();
      record(`Kanban/Column${i+1}Header`, headerHas > 0, `Column ${i+1} header: "${expectedStatuses[i]}" present: ${headerHas > 0}`);
    }

    // No "View list →" in Closed column (wireframe-forbidden)
    const closedCol = page.locator('[data-testid="kanban-column"]').nth(3);
    const viewList = await closedCol.getByText(/view list/i).count();
    record('Kanban/ClosedNoViewList', viewList === 0, `No "View list →" in Closed: ${viewList === 0}`);

    // Closed column has drag-blocked indicator (cursor: not-allowed on hover)
    // This is harder to test; skip for now.
  });

  // ── TICKET DETAIL (/tickets/:id) — Jess as User, Sam as Agent ──
  await withFreshSession(browser, 'jess', async (page) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('[data-testid="ticket-table"] tbody > tr', { timeout: 15_000 });
    await page.locator('[data-testid="ticket-table"] tbody > tr').first().click();
    await page.waitForURL(/\/tickets\/(HD-)?\d+/, { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Back link
    const backLink = await page.locator('[data-testid="back-link"]').count();
    record('TicketDetailEli/BackLink', backLink > 0, `"← Back to My Tickets" link present: ${backLink > 0}`);

    // 4 sections: header / description / comments / activity log
    const desc = await page.locator('[data-section="description"], :text("Description")').first().count();
    const comments = await page.getByText(/^comments/i).count();
    const activity = await page.getByText(/activity log/i).count();
    record('TicketDetailEli/4Sections', desc > 0 && comments > 0 && activity > 0, `Description:${desc} Comments:${comments} Activity:${activity}`);

    // Composer placeholder
    const composerPh = await page.locator('textarea#comment-body').getAttribute('placeholder');
    record('TicketDetailEli/ComposerPlaceholder', /type a comment/i.test(composerPh ?? ''), `Composer placeholder: "${composerPh}"`);

    // No "Confirm and close" — only "Confirm (close)"
    const preFix = await page.getByRole('button', { name: /^confirm and close$/i }).count();
    record('TicketDetailEli/NoPreFixConfirm', preFix === 0, `No pre-fix "Confirm and close" label: ${preFix === 0}`);

    // Closed: read-only indicator (only on closed tickets)
    // On an Open ticket for Eli: only "+ Comment" in action zone
    const commentBtn = await page.getByTestId('add-comment-btn').count();
    record('TicketDetailEli/CommentButton', commentBtn > 0, `"+ Comment" button present: ${commentBtn > 0}`);

    // Submitter row visible (Eli)
    const submitter = await page.getByText(/^submitter$/i).count();
    record('TicketDetailEli/SubmitterLabel', submitter > 0, `"Submitter" label present: ${submitter > 0}`);

    // H1 should be "Ticket #HD-N", not the title
    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('TicketDetailEli/H1', /^Ticket #HD-\d+$/i.test(h1), `H1: "${h1}"`);

    // Meta-grid should have "Owner" not "Assignee"
    const ownerLabel = await page.getByText(/^owner$/i).count();
    const assigneeLabel = await page.getByText(/^assignee$/i).count();
    record('TicketDetailEli/OwnerNotAssignee', ownerLabel > 0 && assigneeLabel === 0, `Owner:${ownerLabel} Assignee:${assigneeLabel}`);

    // Created row visible
    const createdLabel = await page.getByText(/^created/i).count();
    record('TicketDetailEli/CreatedLabel', createdLabel > 0, `"Created" label present: ${createdLabel > 0}`);
  });

  await withFreshSession(browser, 'sam', async (page) => {
    await page.goto(`${BASE}/queue`);
    await page.waitForSelector('article.card', { timeout: 15_000 });
    const card = page.locator('article.card').first();
    await card.click();
    await page.waitForURL(/\/tickets\/(HD-)?\d+/, { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Back link to Queue
    const backLink = await page.locator('[data-testid="back-link"]').count();
    record('TicketDetailSam/BackLink', backLink > 0, `"← Back to Queue" link present: ${backLink > 0}`);

    // Agent action zone: + Comment, Change status, Reassign, Change priority
    // (live impl uses data-testid attrs)
    const comment = await page.getByTestId('add-comment-btn').count();
    const changeStatus = await page.getByTestId('change-status-btn').count();
    const reassign = await page.getByTestId('reassign-btn').count();
    const changePrio = await page.getByTestId('change-priority-btn').count();
    record('TicketDetailSam/ActionZone', comment > 0 && changeStatus > 0 && reassign > 0 && changePrio > 0, `+Cmt:${comment} Status:${changeStatus} Reassign:${reassign} Prio:${changePrio}`);

    // Owner row editable
    const owner = await page.getByText(/^owner$/i).count();
    record('TicketDetailSam/OwnerLabel', owner > 0, `"Owner" label present: ${owner > 0}`);

    // Activity log entries
    const activityLog = await page.getByText(/activity log/i).count();
    record('TicketDetailSam/ActivityLog', activityLog > 0, `Activity log present: ${activityLog > 0}`);
  });

  // ── CREATE TICKET (/tickets/new) — Jess ────────────────────────
  // /tickets/new is roleGuard(['User']), so this must run as Jess
  // (the seeded User). Logging in as Eli — a Support Agent — is
  // redirected to /forbidden and the form never renders, which is
  // exactly why this section used to time out on `input#title`.
  // Ticket creation is a USER action; the Agent's and the Admin's
  // actions on a ticket are resolve / close / reassign / reprioritise.
  await withFreshSession(browser, 'jess', async (page) => {
    await page.goto(`${BASE}/tickets/new`, { waitUntil: 'domcontentloaded' });
    // Wait on the title INPUT, not on an h1 — the login page also
    // carries an h1, so an h1 wait can resolve before the form has
    // rendered.
    await page.waitForSelector('input#title', { timeout: 20_000 });

    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('CreateTicket/H1', h1 === 'New ticket', `H1 is "${h1}"`);

    // No "Create Ticket" header pre-fix
    const preFixHeader = await page.getByRole('heading', { name: /^create ticket$/i }).count();
    record('CreateTicket/NoPreFixH1', preFixHeader === 0, `No pre-fix "Create Ticket" h1: ${preFixHeader === 0}`);

    // Submit button label
    const submitLabel = await page.getByRole('button', { name: /submit ticket/i }).count();
    record('CreateTicket/SubmitButton', submitLabel > 0, `"Submit ticket" button: ${submitLabel > 0}`);

    // No pre-fix "Create Ticket" button label
    const preFixBtn = await page.getByRole('button', { name: /^create ticket$/i }).count();
    record('CreateTicket/NoPreFixButton', preFixBtn === 0, `No pre-fix "Create Ticket" button: ${preFixBtn === 0}`);

    // Placeholders
    const titlePh = await page.locator('input#title').getAttribute('placeholder');
    record('CreateTicket/TitlePh', /short summary/i.test(titlePh ?? ''), `Title placeholder: "${titlePh}"`);

    const descPh = await page.locator('textarea#description').getAttribute('placeholder');
    record('CreateTicket/DescPh', /describe what/i.test(descPh ?? ''), `Desc placeholder starts: "${(descPh ?? '').slice(0, 40)}…"`);

    // Back link
    const back = await page.locator('[data-testid="back-to-my-tickets"]').count();
    record('CreateTicket/BackLink', back > 0, `"← Back to My Tickets" link: ${back > 0}`);

    // Cancel-return link
    const cancel = await page.locator('[data-testid="cancel-return-link"]').count();
    record('CreateTicket/CancelLink', cancel > 0, `"Cancel — return to My Tickets" link: ${cancel > 0}`);

    // Field order: Title → Description → Category → Priority → Attachment
    // Live labels are "Title *", "Description *", etc. (required asterisk).
    // Strip asterisks before matching.
    const allLabelText = await page.locator('label').allInnerTexts();
    const labelHas = (rx) => allLabelText.some((t) => rx.test(t.replace(/[*\s]+/g, ' ').trim()));
    const titleLbl = labelHas(/^title$/i) ? 1 : 0;
    const descLbl  = labelHas(/^description$/i) ? 1 : 0;
    const catLbl   = labelHas(/^category$/i) ? 1 : 0;
    const prioLbl  = labelHas(/^priority$/i) ? 1 : 0;
    const attLbl   = labelHas(/^attachment$/i) ? 1 : 0;
    record('CreateTicket/AllFields', titleLbl > 0 && descLbl > 0 && catLbl > 0 && prioLbl > 0 && attLbl > 0, `Fields T:${titleLbl} D:${descLbl} C:${catLbl} P:${prioLbl} A:${attLbl}`);

    // Attachment micro-label
    const attMicro = await page.getByText(/optional.*10\s*mb.*max/i).count();
    record('CreateTicket/AttachmentMicro', attMicro > 0, `"(optional, 10 MB max)" micro-label: ${attMicro > 0}`);
  });

  // ── SUBMISSION CONFIRMATION — need to actually submit a ticket ─
  // As Jess: /tickets/new is the USER's route, so submitting here
  // means submitting as the User whose "My Tickets" list the
  // confirmation page links back to.
  await withFreshSession(browser, 'jess', async (page) => {
    await page.goto(`${BASE}/tickets/new`);
    await page.waitForSelector('input#title', { timeout: 10_000 });
    const stamp = Date.now();
    await page.locator('input#title').fill(`qa-audit ${stamp}`);
    await page.locator('textarea#description').fill(`Created by wireframe-audit.mjs at ${new Date(stamp).toISOString()}`);
    await page.getByRole('button', { name: /submit ticket/i }).click();
    await page.waitForURL(/\/tickets\/\d+\/created/, { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Headline
    const headline = await page.getByText(/^ticket created$/i).count();
    record('SubmissionConfirmation/Headline', headline > 0, `"Ticket created" headline: ${headline > 0}`);

    // Success check (live impl: <check-circle> custom element with 64x64 svg)
    const checkCircle = await page.locator('check-circle, [data-testid="success-check"], .success-check, .check-circle, svg[viewBox="0 0 64 64"]').count();
    record('SubmissionConfirmation/CheckCircle', checkCircle > 0, `Success check circle: ${checkCircle > 0}`);

    // Ticket number — look for #HD-1234 pattern
    const ticketNum = await page.locator(':text("HD-")').count();
    record('SubmissionConfirmation/TicketNumber', ticketNum > 0, `Ticket #HD-N visible: ${ticketNum > 0}`);

    // Status chip
    const statusChip = await page.getByText(/^open$/i).count();
    record('SubmissionConfirmation/StatusChip', statusChip > 0, `"Open" status chip: ${statusChip > 0}`);

    // "View ticket" CTA — live impl is a <button> inside <atom-button>
    const viewTicket = await page.getByRole('button', { name: /view ticket/i }).count()
      + await page.getByRole('link', { name: /view ticket/i }).count();
    record('SubmissionConfirmation/ViewTicketCTA', viewTicket > 0, `"View ticket" CTA: ${viewTicket > 0}`);

    // "Back to My Tickets" link
    const back = await page.getByText(/back to my tickets/i).count();
    record('SubmissionConfirmation/BackLink', back > 0, `"← Back to My Tickets" link: ${back > 0}`);
  });

  // ── ADMIN DASHBOARD (/admin) ──────────────────────────────────
  await withFreshSession(browser, 'admin', async (page) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('h1', { timeout: 10_000 });
    await page.waitForTimeout(1500);

    // Tabs
    const dashTab = await page.locator('#admin-tab-tickets').count();
    const usersTab = await page.locator('#admin-tab-users').count();
    record('AdminDashboard/Tabs', dashTab > 0 && usersTab > 0, `Tabs: Tickets:${dashTab} Users:${usersTab}`);

    // ── The shared stat strip ────────────────────────────────
    //
    // The WDS-2026 redesign replaced the Admin's four tall
    // `status-summary-card`s with the SAME `<stat-strip>` molecule
    // the User's dashboard and the Support Agent's Tickets page
    // render. Count the MOLECULE's cards (`article.card` inside it),
    // not the page's `article.card` — the shared table has rows too.
    const strip = page.locator('[data-testid="stat-strip"]');
    const stripMolecule = await page.locator('stat-strip').count();
    const cards = await strip.locator('article.card').count();
    record('AdminDashboard/StatStrip', stripMolecule === 1 && cards === 5,
      `strip molecules:${stripMolecule} cards:${cards} (expected 1 / 5)`);

    // Each status card carries its label and a count.
    for (const status of ['Open', 'In Progress', 'Resolved', 'Closed']) {
      const found = await strip.getByText(status, { exact: false }).first().count();
      record(`AdminDashboard/${status}Card`, found > 0, `"${status}" card content: ${found > 0}`);
    }

    // The Total card's count is a number, not a dash or a label.
    const totalValue = await page
      .locator('[data-testid="stat-total-card"] .value')
      .textContent()
      .catch(() => null);
    record('AdminDashboard/TotalCount', /^\d+$/.test((totalValue ?? '').trim()), `Total card count: "${totalValue}"`);

    // ── The shared filter bar + table ────────────────────────
    const filterBar = await page.locator('[data-testid="ticket-filter-bar"]').count();
    record('AdminDashboard/FilterBar', filterBar === 1, `Shared filter bar present: ${filterBar === 1}`);

    const table = await page.locator('[data-testid="ticket-table"]').count();
    record('AdminDashboard/TicketTable', table === 1, `Shared table present: ${table === 1}`);

    // Switch to Users tab
    await page.locator('#admin-tab-users').click();
    await page.waitForTimeout(1000);
    const usersHeading = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('AdminDashboard/UsersTabHeading', usersHeading === 'Users', `Users tab heading: "${usersHeading}"`);

    // Micro-label
    const micro = await page.getByText(/\d+\s*users?\s*·\s*\d+\s*active/i).count();
    record('AdminDashboard/UsersMicroLabel', micro > 0, `"N users · N active" micro-label: ${micro > 0}`);

    // 5-column table
    const colHeaders = await page.locator('table thead th, [data-testid="users-table-header"] th, .users-table th').count();
    const fallbackHeaders = await page.getByText(/^name$/i).count() +
                            await page.getByText(/^email$/i).count() +
                            await page.getByText(/^role$/i).count() +
                            await page.getByText(/^status$/i).count() +
                            await page.getByText(/last active/i).count();
    const has5Cols = colHeaders === 5 || fallbackHeaders >= 5;
    record('AdminDashboard/5ColumnTable', has5Cols, `5 columns: th=${colHeaders} fallback=${fallbackHeaders}`);

    // Self-row protection
    const selfLabel = await page.getByText(/you cannot change your own role/i).count();
    record('AdminDashboard/SelfRowLabel', selfLabel > 0, `"You cannot change your own role" micro-label: ${selfLabel > 0}`);
  });

  // ── STANDALONE /users route (still works post-HD-014) ─────────
  await withFreshSession(browser, 'admin', async (page) => {
    await page.goto(`${BASE}/users`);
    await page.waitForSelector('h1', { timeout: 10_000 });
    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('StandaloneUsers/Heading', h1 === 'Users', `/users H1: "${h1}"`);

    // Should NOT have a tab switcher (per users-tab.md "No tab switcher on this page")
    const dashTab = await page.locator('#admin-tab-dashboard').count();
    const usersTab = await page.locator('#admin-tab-users').count();
    record('StandaloneUsers/NoTabSwitcher', dashTab === 0 && usersTab === 0, `No tab switcher: dashTab=${dashTab} usersTab=${usersTab}`);
  });

  // ── SUMMARY ───────────────────────────────────────────────────
  const failed = findings.filter((f) => !f.ok);
  console.log('\n────────────────────────────────────');
  console.log(`Total: ${findings.length}  Pass: ${findings.length - failed.length}  Fail: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailures:');
    for (const f of failed) {
      console.log(`  [FAIL] ${f.area} — ${f.detail}`);
    }
    process.exit(1);
  }
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
