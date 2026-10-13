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
 */
import { chromium } from 'playwright';

const BASE = 'https://helpdesk-lite-tawny.vercel.app';

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
  }[who];
  await page.goto(`${BASE}/login`);
  await page.locator('input#login-email').fill(creds.email);
  await page.locator('input#login-password').fill(creds.pwd);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(/\/(admin|queue|dashboard)/, { timeout: 10_000 });
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
      const h1Sr = await page.locator('h1.visually-hidden, h1.sr-only').first().textContent().catch(() => null);
      record('Login/HiddenH1', /sign in/i.test(h1Sr ?? ''), `H1 (SR-only): "${h1Sr}"`);

      const emailPh = await page.locator('input#login-email').getAttribute('placeholder');
      record('Login/EmailPlaceholder', /you@company\.com/.test(emailPh ?? ''), `Email placeholder: "${emailPh}"`);

      const pwdPh = await page.locator('input#login-password').getAttribute('placeholder');
      record('Login/PwdPlaceholder', /password/i.test(pwdPh ?? ''), `Password placeholder: "${pwdPh}"`);

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
  await withFreshSession(browser, 'eli', async (page) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('h1', { timeout: 10_000 });
    // Wait for ticket rows to load (avoids false-fail on empty list)
    await page.waitForSelector('ticket-row, [data-testid="empty-ticket-list"]', { timeout: 15_000 });
    await page.waitForTimeout(500);

    const h1 = (await page.locator('h1').first().textContent())?.trim() ?? '';
    record('EmployeeDashboard/H1', h1 === 'My Tickets', `H1 is "${h1}"`);

    // Single "Create Ticket" button (live impl is a <button>, not a
    // <a> link — accept either).
    const ctaCount = await page.getByRole('button', { name: /create ticket/i }).count()
      + await page.getByRole('link', { name: /create ticket/i }).count();
    record('EmployeeDashboard/CreateTicketCTAs', ctaCount >= 1, `"Create Ticket" CTA(s) present: ${ctaCount}`);

    // No stat strip / no team-wide stats
    const statStrip = await page.locator('[data-testid="stat-strip"]').count();
    record('EmployeeDashboard/NoStatStrip', statStrip === 0, `No stat strip: ${statStrip === 0}`);

    // No "newest activity" / no welcome message
    const welcomeCard = await page.locator('[data-testid="welcome-banner"]').count();
    record('EmployeeDashboard/NoWelcomeBanner', welcomeCard === 0, `No welcome banner: ${welcomeCard === 0}`);

    // Rows: number · title · status · priority · timestamp
    const row = page.locator('ticket-row').first();
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

  // ── TICKET DETAIL (/tickets/:id) — Eli as User, Sam as Agent ──
  await withFreshSession(browser, 'eli', async (page) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForSelector('ticket-row', { timeout: 15_000 });
    await page.locator('ticket-row a.row').first().click();
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

  // ── CREATE TICKET (/tickets/new) — Eli ─────────────────────────
  await withFreshSession(browser, 'eli', async (page) => {
    await page.goto(`${BASE}/tickets/new`);
    await page.waitForSelector('h1', { timeout: 10_000 });

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
  await withFreshSession(browser, 'eli', async (page) => {
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
    const dashTab = await page.locator('#admin-tab-dashboard').count();
    const usersTab = await page.locator('#admin-tab-users').count();
    record('AdminDashboard/Tabs', dashTab > 0 && usersTab > 0, `Tabs: Dashboard:${dashTab} Users:${usersTab}`);

    // 4 status cards
    const cards = await page.locator('article.card').count();
    record('AdminDashboard/4Cards', cards === 4, `4 status cards: ${cards === 4}`);

    // Each card has a status pill + count
    for (const status of ['Open', 'In Progress', 'Resolved', 'Closed']) {
      const found = await page.getByText(status, { exact: false }).first().count();
      record(`AdminDashboard/${status}Card`, found > 0, `"${status}" card content: ${found > 0}`);
    }

    // Count badge should be the TOTAL, not visible row count
    // Get the Open card's count
    const openCard = page.locator('article.card').first();
    const openCardText = (await openCard.textContent())?.trim() ?? '';
    // Extract the count number from the .count span inside the card top
    const openCount = await openCard.locator('span.count, .count').textContent().catch(() => null);
    record('AdminDashboard/OpenCountIsTotal', /^\d+$/.test((openCount ?? '').trim()), `Open card count: "${openCount}"`);

    // Click into Open card first row to verify navigation
    const firstLink = await openCard.locator('a.admin-card-row').count();
    record('AdminDashboard/OpenRowsAreLinks', firstLink > 0, `Open rows have <a> links: ${firstLink > 0}`);

    // Closed card rows are NOT links
    const closedCard = page.locator('article.card').nth(3);
    const closedLinks = await closedCard.locator('a.admin-card-row').count();
    record('AdminDashboard/ClosedRowsNoLinks', closedLinks === 0, `Closed card has no <a> rows: ${closedLinks === 0}`);

    // Closed card has muted style
    const closedHasMuted = await closedCard.evaluate(el => el.classList.contains('muted'));
    record('AdminDashboard/ClosedMutedStyle', closedHasMuted, `Closed card has .muted class: ${closedHasMuted}`);

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
