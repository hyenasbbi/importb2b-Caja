IMPORTB2B CONTROL FINANCIERO — v0.5.2 GESTIÓN DE FONDOS

CAMBIO PRINCIPAL
Se elimina el bloque visual grande “CAMBIAR ARS A USDT” del dashboard.

Ahora existe una única función:
MOVER / CONVERTIR FONDOS

Dentro podés elegir:

1. MOVER FONDOS
- ARS transferencia -> ARS transferencia
- ARS efectivo -> ARS transferencia
- ARS entre Nahuel / Esteban
- USDT Nahuel -> USDT Esteban
- No modifica ingresos / egresos operativos

2. ARS -> USDT
- Seleccionás si los ARS salen de Transferencia o Efectivo
- Seleccionás titular ARS
- Cargás cantidad de pesos
- Usa cotización COMPRA Binance P2P
- Calcula USDT
- Seleccionás titular USDT
- Resta automáticamente ARS
- Suma automáticamente USDT
- Queda registrado en Movimientos y Auditoría
- No modifica el resultado operativo mensual

SUPABASE
No requiere cambios adicionales. La función de conversión ya está activa.

REEMPLAZAR EN GITHUB
- index.html
- assets/js/app.js
- assets/css/styles.css

MANTENER
- assets/js/config.js
- funciones Netlify/Supabase existentes
