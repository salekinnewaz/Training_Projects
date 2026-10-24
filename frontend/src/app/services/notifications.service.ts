/**
 * NotificationsService — HD-019.
 *
 * Polling-based feed backing the chrome bell. Wires the
 * `GET /api/notifications`, `POST /api/notifications/:id/read`,
 * `POST /api/notifications/read-all` endpoints to Angular signals
 * so the chrome bell and the dropdown panel can both subscribe.
 *
 * Polling cadence: 30s. The bell only re-fetches when the dropdown
 * is closed; opening the dropdown triggers an immediate refresh so
 * freshly-arrived notifications appear instantly. Closing clears the
 * optimistic "viewed" state, NOT the unread count — the dot stays
 * red until the user explicitly reads or dismisses each item.
 *
 * Provided as `providedIn: 'root'` so the service is shared across
 * the chrome and the dropdown; the bell's red dot state and the
 * dropdown's list are driven by the same signal so they can't drift.
 */

import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { apiErrorFrom } from './api-error';

/** Wire shape of a single notification row, mirrors the backend
 * `serializeNotification` output. Additive — new fields can ship
 * without bumping this interface (extra keys are ignored). */
export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  ticketId: number | null;
  actor: { id: number; displayName: string } | null;
  unread: boolean;
  createdAt: string;
  readAt: string | null;
}

interface ListResponse {
  items: NotificationItem[];
  unreadCount: number;
}

const POLL_INTERVAL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  /**
   * HttpClient is resolved lazily (rather than eagerly via
   * `inject(HttpClient)`) because `header-chrome` injects this
   * service, and every page spec that renders the chrome would
   * otherwise have to provide HttpClient even though the bell is
   * inert in that test. Deferring the lookup to the first network
   * call keeps service *construction* dependency-free; a spec that
   * never triggers a fetch never resolves HttpClient at all.
   */
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private httpClient(): HttpClient | null {
    // `providedIn: 'root'` means the service is constructed even in
    // page specs that render the chrome without wiring HttpClient.
    // `injector.get(HttpClient, null)` returns null instead of
    // throwing, letting every caller degrade to "no bell data"
    // rather than blowing up (or, worse, scheduling a real XHR
    // inside a `fakeAsync` zone, which zone.js rejects outright).
    return this.injector.get(HttpClient, null);
  }

  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _panelOpen = signal(false);

  /** Read-only signals for components. */
  readonly items = this._items.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly panelOpen = this._panelOpen.asReadonly();

  /** True whenever there is at least one unread row. The bell's
   * red dot and `notificationLabel()` resolve to this. */
  readonly hasUnread = computed(() => this._unreadCount() > 0);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Polling is intentionally NOT started in the constructor —
    // service construction happens during TestBed setup in unit
    // tests, and an HTTP round-trip on every spec boot would slow
    // the suite down dramatically (and break specs that don't
    // provide an HttpClient). The chrome component is the only
    // real consumer; it lazily calls startPolling() the moment it
    // sees a non-null user (notifications only matter post-login).
    //
    // We still register the destroy hook in case the service is
    // ever constructed and then torn down without an explicit start.
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  /** Begin polling every POLL_INTERVAL_MS. The first refresh fires
   * immediately on the leading edge so the bell's red dot lands on
   * page load rather than after a 30s delay. */
  startPolling(): void {
    if (this.pollHandle !== null) return;
    // Fire-and-forget refresh — errors are surfaced via signal so the
    // UI can show them without breaking the polling loop.
    void this.refresh();
    this.pollHandle = setInterval(() => {
      // Pause polling while the panel is open so manual mark-read
      // calls don't race the dropdown refetch.
      if (!this._panelOpen()) {
        void this.refresh();
      }
    }, POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  /** Fetch the current feed + unread count. Replaces both signals in
   * one update so subscribers see a consistent snapshot. */
  async refresh(): Promise<void> {
    const http = this.httpClient();
    if (!http) {
      // No HttpClient in the DI graph — a page spec rendered the chrome
      // without one. The bell keeps its last state rather than
      // scheduling a real XHR that zone.js (in `fakeAsync`) would
      // refuse or that would just hang in a normal spec.
      return;
    }
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await firstValueFrom(
        http.get<ListResponse>(
          `${environment.apiBaseUrl}/notifications`,
          { withCredentials: true },
        ),
      );
      this._items.set(res.items);
      this._unreadCount.set(res.unreadCount);
    } catch (err) {
      // 401 lands here on session expiry. The auth interceptor will
      // surface that elsewhere; for the bell we just stash a generic
      // string so the dropdown can show a soft "couldn't load" copy.
      this._error.set('Notifications unavailable.');
      void apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Toggle the dropdown panel. Opening forces a fresh fetch so the
   * list is up-to-date; closing doesn't clear state. */
  async togglePanel(): Promise<void> {
    this._panelOpen.update((open) => !open);
    if (this._panelOpen()) {
      await this.refresh();
    }
  }

  closePanel(): void {
    this._panelOpen.set(false);
  }

  /** Optimistically flip one row to read locally, then POST the
   * mark-read call. On failure the local state rolls back so the UI
   * never disagrees with the server for long. */
  async markRead(id: number): Promise<void> {
    const http = this.httpClient();
    if (!http) return;
    const prior = this._items();
    const target = prior.find((item) => item.id === id);
    if (!target || !target.unread) {
      // Already read or gone — make sure server matches regardless.
      try {
        await firstValueFrom(
          http.post<void>(
            `${environment.apiBaseUrl}/notifications/${id}/read`,
            {},
            { withCredentials: true },
          ),
        );
      } catch {
        /* swipe */
      }
      return;
    }

    // Optimistic update
    this._items.set(
      prior.map((item) =>
        item.id === id
          ? { ...item, unread: false, readAt: new Date().toISOString() }
          : item,
      ),
    );
    this._unreadCount.update((c) => Math.max(0, c - 1));

    try {
      await firstValueFrom(
        http.post<void>(
          `${environment.apiBaseUrl}/notifications/${id}/read`,
          {},
          { withCredentials: true },
        ),
      );
    } catch (err) {
      // Roll back on failure.
      this._items.set(prior);
      this._unreadCount.update((c) => c + 1);
      void apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /** Mark all unread rows read in one sweep. Called from the
   * dropdown's "Mark all as read" action. */
  async markAllRead(): Promise<void> {
    if (this._unreadCount() === 0) return;
    const http = this.httpClient();
    if (!http) return;

    const now = new Date().toISOString();
    const priorItems = this._items();
    const priorCount = this._unreadCount();

    // Optimistic update — flip every unread row + zero the counter.
    this._items.set(
      priorItems.map((item) =>
        item.unread ? { ...item, unread: false, readAt: now } : item,
      ),
    );
    this._unreadCount.set(0);

    try {
      await firstValueFrom(
        http.post<{ updated: number }>(
          `${environment.apiBaseUrl}/notifications/read-all`,
          {},
          { withCredentials: true },
        ),
      );
    } catch (err) {
      this._items.set(priorItems);
      this._unreadCount.set(priorCount);
      void apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }
}