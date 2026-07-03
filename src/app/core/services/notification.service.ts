import { Injectable } from '@angular/core';

export interface ToastMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary: string;
  detail?: string;
}

/**
 * Decoupled notification bus. Components/interceptors push messages; the root
 * component registers a sink (PrimeNG MessageService) — avoids a hard dependency
 * on PrimeNG from the interceptor layer.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private sink: ((msg: ToastMessage) => void) | null = null;
  private buffer: ToastMessage[] = [];

  register(sink: (msg: ToastMessage) => void) {
    this.sink = sink;
    this.buffer.forEach(sink);
    this.buffer = [];
  }

  push(msg: ToastMessage) {
    if (this.sink) this.sink(msg);
    else this.buffer.push(msg);
  }

  success(summary: string, detail?: string) { this.push({ severity: 'success', summary, detail }); }
  error(summary: string, detail?: string) { this.push({ severity: 'error', summary, detail }); }
  info(summary: string, detail?: string) { this.push({ severity: 'info', summary, detail }); }
}
