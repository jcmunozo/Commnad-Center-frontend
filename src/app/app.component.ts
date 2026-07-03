import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <router-outlet />
  `,
})
export class AppComponent {
  // Wire the global notification stream into PrimeNG's toast service.
  private readonly notifications = inject(NotificationService);
  private readonly messages = inject(MessageService);

  constructor() {
    this.notifications.register((msg) => this.messages.add(msg));
  }
}
