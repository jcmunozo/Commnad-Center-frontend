# PMO Command Center — Frontend

this is an Angular 20 (standalone + signals) SPA for the PMO Command Center. Consumes the
Django REST API (see `../pmo-backend`). Full architecture in
`../docs/PROJECT_DOCUMENTATION.md` §7.

## Stack
Angular 20 · PrimeNG 20 (theming `@primeng/themes`, preset Aura) · ApexCharts (charts) ·
frappe-gantt (Gantt) · Transloco (i18n, ES base) · Jest (tests).

## Dev
```bash
npm install
npm start            # http://localhost:4200 (proxies to API at :8000 in prod build via nginx)
npm test             # jest
npm run build        # production bundle -> dist/pmo-frontend
```
Set the API URL in `src/environments/environment.ts` (dev) / `environment.prod.ts` (prod).

## Structure
```
src/app/
  core/      auth (store/service), interceptors (auth+refresh, error, loading),
             guards (auth, role), services (api-base, catalogs, notification, loading)
  shared/    components (kpi-card, status-badge, forbidden), models
  features/  auth · dashboard · projects (list/detail/form) · clients · admin/excel-import
  layouts/   main-layout (sidenav+topbar) · auth-layout
```

## Implemented in Fase 4
- Base: config, environments, interceptors (con refresh JWT automático), guards,
  AuthStore (signals), login + recuperación, main-layout.
- Proyectos: lista con `p-table` server-side (filtros/orden/paginación), detalle con
  tabs, formulario Reactive con validaciones espejo del backend.
- Dashboard PMO: KPI cards + donut ApexCharts + alertas.
- Importador Excel: upload, dry-run con reporte de errores por fila, confirmación.

## Pendiente (siguientes fases)
Feature `tasks` (incl. Gantt frappe-gantt), `resources` (workload/schedule),
`tracking` (issues/risks/updates/actions), `admin` (catálogos/usuarios), i18n switch UI.

## Docker
`docker build -t pmo-frontend .` → nginx sirve `dist/` con fallback SPA y proxy `/api`
al servicio `web` del backend.
