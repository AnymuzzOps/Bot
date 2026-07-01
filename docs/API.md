# API

Todas las rutas `/api/*` exigen un JWT válido de Supabase en el encabezado `Authorization`.

## Chat y panel

- `POST /api/chat` — body `{ "message": "..." }`
- `GET /api/conversations?limit=100`
- `DELETE /api/conversations`
- `GET /api/dashboard`
- `GET /api/search?q=texto`

## Tareas

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

Filtros: `status`, `priority`, `q`, `limit`.

## Compras

- `GET /api/shopping`
- `POST /api/shopping`
- `PATCH /api/shopping/:id`
- `DELETE /api/shopping/:id`

Filtros: `purchased`, `q`, `limit`.

## Inventario

- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id`
- `DELETE /api/inventory/:id`

Filtros: `location`, `q`, `expiring_days`, `limit`.

## Finanzas

- `GET /api/finances`
- `GET /api/finances/summary?month=YYYY-MM`
- `POST /api/finances`
- `PATCH /api/finances/:id`
- `DELETE /api/finances/:id`

Filtros: `type`, `month`, `q`, `limit`.

## Memoria y perfil

- `GET /api/memories`
- `POST /api/memories`
- `PATCH /api/memories/:id`
- `DELETE /api/memories/:id`
- `GET /api/profile`
- `PATCH /api/profile`

## Respaldo

- `GET /api/export`
- `POST /api/import` — body `{ "mode": "merge|replace", "data": { ... } }`
