# Seguridad

## Secretos

Nunca agregues `GROQ_API_KEY`, `.dev.vars`, archivos `.env` ni claves administrativas al repositorio.

En Cloudflare configura los secretos con:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

La clave pública de Supabase puede estar en el frontend porque las políticas RLS controlan el acceso. No uses `service_role` en el navegador.

## Controles implementados

- Validación del JWT en cada petición privada.
- RLS activa en todas las tablas expuestas.
- Políticas por `auth.uid()` para seleccionar, crear, modificar y eliminar.
- CORS restringido a orígenes configurados.
- Validación de cuerpos con Zod.
- Límites de longitud y cantidad en entradas y listados.
- Tool calling con lista cerrada de operaciones permitidas.
- Clave Groq disponible únicamente en el Worker.

## Recomendaciones de producción

- Configura exactamente el origen de GitHub Pages en `ALLOWED_ORIGINS`.
- Activa confirmación de correo en Supabase Auth.
- Revisa los logs y límites de consumo de Groq y Cloudflare.
- Considera Cloudflare Rate Limiting o Turnstile si la aplicación será pública.
- Para datos financieros reales, usa la aplicación como registro personal y no como sistema contable certificado.
