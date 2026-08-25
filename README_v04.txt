IMPORTB2B CONTROL FINANCIERO — v0.4

CAMBIOS PRINCIPALES
- Transferencias divididas por Nahuel / Esteban.
- Efectivo dividido por Nahuel / Esteban.
- USDT dividido por Nahuel / Esteban + equivalente ARS.
- Los tres saldos del dashboard son clickeables y muestran desglose.
- Todo movimiento manual exige titular según el medio.
- Liquidaciones exigen titular de la cuenta o efectivo receptor.
- Cobros de clientes exigen titular de la cuenta o efectivo receptor.
- Nueva Transferencia Interna para mover fondos sin alterar ingresos/egresos del mes.

REEMPLAZAR EN GITHUB
1. index.html -> raíz del repositorio
2. app.js -> assets/js/app.js
3. styles.css -> assets/css/styles.css

NO CAMBIAR
- assets/js/config.js
- netlify/functions/usdt-rate.mjs
- netlify.toml

SUPABASE
La base ya fue actualizada desde ChatGPT. No ejecutar SQL manualmente.

NOTA SOBRE MOVIMIENTOS ANTIGUOS
Los movimientos creados antes de v0.4 pueden figurar como SIN ASIGNAR. Entrá a Movimientos -> EDITAR y elegí Nahuel o Esteban.


ACTUALIZACIÓN v0.4 COMPLETA
- Movimientos manuales: EDITAR + ELIMINAR.
- Eliminar quita el movimiento de caja, pero queda registrado en Auditoría.
- Los movimientos automáticos no se pueden eliminar desde Movimientos.
- Categoría CAPITAL INICIAL.
- Categoría AJUSTE DE CAJA / RECUENTO.
- Capital inicial y ajustes afectan el saldo disponible, pero se excluyen de ingresos/egresos operativos del mes.
- Para AJUSTE DE CAJA / RECUENTO: usar INGRESO para sobrante y EGRESO para faltante.
