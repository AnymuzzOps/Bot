# Asistente Personal con IA

Aplicación web completa para conversar con Groq y administrar tareas, compras, inventario de alimentos, finanzas y memoria personal.

## Incluye

- React + Vite responsive, modo claro y oscuro.
- GitHub Pages con despliegue mediante GitHub Actions.
- Supabase Auth y PostgreSQL con Row Level Security.
- Cloudflare Worker con API protegida.
- Groq tool calling para ejecutar instrucciones naturales.
- Historial, memoria, búsqueda global, exportación e importación JSON.

## Estructura

```text
frontend/              aplicación React
worker/                Cloudflare Worker
supabase/schema.sql    base de datos y RLS
docs/                  arquitectura, API y seguridad
.github/workflows/     despliegue de GitHub Pages
```

## 1. Crear Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, pega `supabase/schema.sql` y ejecútalo completo.
3. En **Authentication > URL Configuration** agrega:
   - `http://localhost:5173`
   - `https://TU_USUARIO.github.io/TU_REPOSITORIO/`
4. Copia:
   - Project URL.
   - Publishable key o anon key pública.

## 2. Ejecutar localmente

Desde la raíz:

```bash
npm install
cp frontend/.env.example frontend/.env
cp worker/.dev.vars.example worker/.dev.vars
```

Edita ambos archivos con tus valores.

Terminal 1:

```bash
npm run dev:worker
```

Terminal 2:

```bash
npm run dev:frontend
```

Abre `http://localhost:5173`.

## 3. Desplegar el Worker

Edita `worker/wrangler.jsonc` y reemplaza `TU_USUARIO` en `ALLOWED_ORIGINS`. Puedes incluir varios orígenes separados por comas.

```bash
cd worker
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npm run deploy
```

Cloudflare devolverá una URL parecida a:

```text
https://asistente-personal-ia-api.TU_SUBDOMINIO.workers.dev
```

## 4. Configurar GitHub

Sube el proyecto a un repositorio y configura:

### Secrets de Actions

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Variable de Actions

- `VITE_API_URL`: URL pública del Worker, sin `/` final.

Luego entra a **Settings > Pages** y selecciona **GitHub Actions** como fuente. Cada push a `main` desplegará el frontend.

Vite calcula automáticamente la base `/<nombre-del-repositorio>/` durante GitHub Actions. Para dominio personalizado puedes definir `VITE_BASE_PATH=/` en el workflow.

## 5. Configurar Groq

El modelo predeterminado es `llama-3.3-70b-versatile`. Puedes cambiarlo en `worker/wrangler.jsonc` mediante `GROQ_MODEL`.

La clave Groq nunca se agrega al frontend. El navegador llama al Worker y el Worker llama a Groq.

## Comandos útiles

```bash
npm run build
npm run typecheck
npm run dev:frontend
npm run dev:worker
npm run deploy --workspace worker
```

## Ejemplos de chat

- “Agrega estudiar inglés mañana a las 18:00 con prioridad alta.”
- “Marca como terminada la tarea de comprar leche.”
- “Necesito 3 litros de leche.”
- “Descuenta 500 gramos de arroz del inventario.”
- “Gasté 25.000 en supermercado.”
- “¿Cuánto dinero tengo disponible este mes?”
- “Recuerda que mi objetivo es terminar mi proyecto en septiembre.”

## Nota sobre importación

El modo `replace` elimina primero los datos actuales y luego inserta el respaldo. La operación recorre varias tablas y no es una transacción única; conserva una copia exportada antes de reemplazar datos importantes.
