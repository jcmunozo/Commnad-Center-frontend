import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="padding:3rem;text-align:center">
      <h1>403</h1>
      <p>No tienes permiso para acceder a esta sección.</p>
      <a routerLink="/dashboard">Volver al tablero</a>
    </div>
  `,
})
export class ForbiddenComponent {}
