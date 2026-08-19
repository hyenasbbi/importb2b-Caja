# IMPORTB2B Control Financiero — Beta v0.1

Web app privada para compartir caja entre socios.

## Incluido en esta beta

- Login por email/contraseña con Supabase Auth.
- Dashboard responsive mobile-first.
- Saldo por transferencia, efectivo y USDT.
- Total estimado en ARS.
- Ingresos, egresos y resultado mensual.
- Alta de movimientos ARS / USDT.
- Cotización USDT/ARS de Binance P2P a través de Netlify Function.
- Filtro de outliers/promocionados: descarta precios >3% alejados de la mediana.
- Referencia basada en el mejor precio válido, después de filtrar promociones/outliers; conserva los 3 mejores como muestra técnica.
- Cotización manual de respaldo.
- La cotización usada en cada movimiento USDT queda congelada.
- Historial y filtros.
- Auditoría INSERT / UPDATE / DELETE.
- RLS en Supabase para que la base no quede pública.
- Modo demo si todavía no configuraste Supabase.

## Identidad IMPORTB2B

La interfaz usa:

- fondos #151719 / #1A1C1E / #202224
- blanco #FFFFFF / #F5F5F5
- rojo de acento #ED1C24
- títulos condensados / fuertes
- bordes mínimos
- estética industrial / premium / comercial

### Logo oficial

El proyecto NO reconstruye ni inventa el logotipo.

Colocá el archivo oficial en:

`assets/brand/importb2b-logo.png`

Si preferís SVG, cambiá los `src` del HTML a `importb2b-logo.svg`.

## 1. Crear Supabase

1. Crear un proyecto Supabase.
2. Abrir SQL Editor.
3. Ejecutar completo `supabase/schema.sql`.
4. En Authentication, desactivar sign-ups públicos.
5. Crear manualmente las dos cuentas internas.
6. En Table Editor > `profiles`, asignar los nombres correctos si hace falta.

## 2. Configurar frontend

Abrir:

`assets/js/config.js`

Reemplazar:

- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

por Project URL y publishable/anon key de Supabase.

La clave pública de frontend se usa con RLS. NO colocar una `service_role` key en el navegador.

## 3. Subir a Netlify

Opción simple:

1. Comprimir/subir la carpeta completa a Netlify.
2. Netlify detectará `netlify.toml`.
3. La función quedará disponible en `/api/usdt`.
4. Abrir la URL pública generada por Netlify.

Para actualizaciones frecuentes conviene conectar un repositorio Git.

## 4. Binance P2P

La beta consulta el mercado público web de Binance P2P:

- `BUY`: comprar USDT pagando ARS.
- `SELL`: vender USDT y recibir ARS.

La función:

1. descarga 20 anuncios BUY y SELL;
2. calcula la mediana;
3. elimina anuncios alejados más de 3%;
4. usa métricas del anunciante cuando están disponibles;
5. ordena los anuncios válidos como Binance P2P;
6. devuelve el mejor precio válido (BUY: menor / SELL: mayor) y conserva top 3 como muestra.

Así se busca evitar que un anuncio promocionado fuera de mercado defina toda la cotización.

### Respaldo

El endpoint web público de Binance puede cambiar. Por eso la app:
- guarda snapshots en Supabase;
- utiliza la última cotización guardada si la consulta falla;
- permite una cotización manual.

## Próxima beta sugerida

- edición/eliminación de movimientos desde UI;
- cierres diarios;
- caja por cuenta bancaria;
- comprobantes;
- retiros/aportes por socio;
- reportes PDF;
- período personalizado;
- conciliación;
- conexión con stock/pedidos IMPORTB2B.
