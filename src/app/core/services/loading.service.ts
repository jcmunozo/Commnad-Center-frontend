import { computed, Injectable, signal } from '@angular/core';

/** Tracks in-flight request count; exposes a boolean signal for spinners. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly count = signal(0);
  readonly isLoading = computed(() => this.count() > 0);

  start() { this.count.update((n) => n + 1); }
  stop() { this.count.update((n) => Math.max(0, n - 1)); }
}
