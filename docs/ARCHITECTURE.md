# Arquitectura

## Flujo principal

1. El usuario inicia sesión directamente con Supabase Auth desde el frontend.
2. Supabase entrega una sesión JWT al navegador.
3. El frontend llama al Cloudflare Worker enviando `Authorization: Bearer <JWT>`.
4. El Worker valida el token mediante `supabase.auth.getUser(token)`.
5. Las consultas a Supabase se realizan con la clave pública y el JWT del usuario, por lo que Row Level Security limita cada operación a sus propias filas.
6. Solo el Worker conoce `GROQ_API_KEY` y llama a Groq.
7. El endpoint `/api/chat` entrega a Groq contexto resumido, memoria y herramientas locales.
8. Cuando Groq solicita una herramienta, el Worker ejecuta la operación real en Supabase y devuelve el resultado al modelo para elaborar la respuesta final.

## Componentes

- `frontend/`: React + Vite, desplegable como archivos estáticos en GitHub Pages.
- `worker/`: API TypeScript con Hono, desplegable en Cloudflare Workers.
- `supabase/schema.sql`: tablas, índices, triggers, permisos y políticas RLS.
- `.github/workflows/deploy-pages.yml`: construcción y despliegue automático del frontend.

## Decisiones de diseño

- Navegación por hash para funcionar en repositorios de GitHub Pages sin reescrituras del servidor.
- Ningún CRUD se realiza directamente desde componentes del frontend; se utiliza la API propia.
- La clave `service_role` no es necesaria. Esto reduce el impacto de una fuga del entorno del Worker y deja que RLS siga siendo la barrera principal.
- La memoria usa una clave única por usuario para poder actualizar preferencias sin duplicarlas.
- Las acciones naturales del chat se implementan mediante tool calling y no mediante extracción por expresiones regulares.
