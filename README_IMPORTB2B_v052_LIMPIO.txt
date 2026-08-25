IMPORTB2B CONTROL FINANCIERO — v0.5.2 LIMPIO

ESTRUCTURA CORRECTA
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── netlify.toml
├── assets/
│   ├── brand/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
└── netlify/
    └── functions/
        └── usdt-rate.mjs

IMPORTANTE
- NO debe existir /app.js en la raíz.
- NO debe existir /styles.css en la raíz.
- index.html carga ./assets/js/app.js y ./assets/css/styles.css.
- Este ZIP NO incluye assets/js/config.js. Conservá el config.js actual de GitHub.

PARA ACTUALIZAR GITHUB
1. Reemplazá index.html.
2. Reemplazá assets/js/app.js.
3. Reemplazá assets/css/styles.css.
4. Conservá assets/js/config.js.
5. Borrá /app.js y /styles.css de la raíz si todavía existen.
6. Commit a main y esperar deploy de Netlify.

FUNCIONES v0.5.2
- Caja por Nahuel / Esteban.
- Transferencias / Efectivo / USDT.
- Gestión unificada MOVER / CONVERTIR FONDOS.
- ARS -> USDT usando Binance P2P compra.
- Movimientos internos sin alterar resultado operativo.
- Liquidaciones.
- Deudores.
- Auditoría.
- Notificaciones.
- PWA / logo / favicon.
