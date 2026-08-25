IMPORTB2B CONTROL FINANCIERO — v0.5 NOTIFICACIONES

INCLUYE TODO LO ANTERIOR
- Dashboard y estética IMPORTB2B
- Login Supabase
- Transferencias / Efectivo / USDT por Nahuel y Esteban
- Edición y eliminación de movimientos manuales con auditoría
- Capital inicial y ajustes/recuentos
- Dinero a liquidar
- Dinero a cobrar
- Transferencias internas
- Conversión ARS (transferencia o efectivo) -> USDT
- Binance P2P USDT/ARS
- Logo, favicon y manifest PWA

NUEVO v0.5
- Campana de notificaciones en el dashboard
- Resumen financiero automático cada 3 días a las 10:00 (Argentina)
- Notificación guardada dentro de la app
- Push Web real para dispositivos que lo habiliten
- Resumen: disponible, transferencias, efectivo, USDT, a liquidar y a cobrar
- Próxima fecha de recordatorio visible
- Historial de recordatorios
- Marcar recordatorios como leídos
- Service Worker para push con la app cerrada

SUPABASE
La base, la programación automática y las Edge Functions ya fueron preparadas desde ChatGPT.
No ejecutar SQL manualmente.

PRÓXIMO RECORDATORIO INICIAL
28/08/2026 10:00 hora Argentina, salvo que posteriormente cambies la configuración.

PARA ACTIVAR PUSH
1. Publicar estos archivos en GitHub / Netlify.
2. Ingresar normalmente a IMPORTB2B.
3. Abrir la campana o usar el botón ACTIVAR PUSH.
4. Aceptar el permiso del navegador.
5. En iPhone, usar Safari -> Compartir -> Agregar a pantalla de inicio y abrir la app desde ese ícono.

IMPORTANTE AL SUBIR
Reemplazar:
- index.html
- assets/js/app.js
- assets/css/styles.css
- service-worker.js
- manifest.webmanifest
- assets/brand/* si querés mantener los iconos del ZIP

CONSERVAR TU ARCHIVO ACTUAL:
- assets/js/config.js

También conservar:
- netlify/functions/usdt-rate.mjs si ya está funcionando.
