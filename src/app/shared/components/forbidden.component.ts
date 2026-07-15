import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="padding:3rem;text-align:center">
      <h1>403</h1>
      <p>You do not have permission to access this section.</p>
      <a routerLink="/dashboard">Back to dashboard</a>
    </div>
  `,
})
export class ForbiddenComponent {}
