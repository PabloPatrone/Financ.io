# Financ.io

App para anotar gastos e ingresos, parecida a Monefy pero sin límites. Es una **PWA**, o sea una página web que se instala en el celular y anda como una app, sin internet.

## Qué tiene (v1)

- Gastos, ingresos y transferencias entre cuentas (también entre monedas distintas)
- **Varios perfiles** (ej: Personal y Empresa), cada uno con sus propias cuentas, categorías y movimientos
- Categorías editables: nombre, ícono y color
- Varias monedas (ARS, USD, EUR, BRL, y podés agregar otras)
- Gráfico de torta por categoría y **variación % contra el mes anterior** (por categoría y en el total)
- Tema claro / oscuro / automático
- Exportar e importar un respaldo (.json), y exportar a Excel (.csv)
- **Importar el historial de Monefy** desde su CSV (Ajustes → Importar desde Monefy). Si importás el mismo archivo dos veces, no duplica.
- Funciona sin conexión y guarda los datos en el dispositivo

## Estructura

```
index.html            la página
manifest.webmanifest  nombre, ícono y colores de la app instalada
sw.js                 service worker: hace que funcione sin internet
css/styles.css        estilos (los colores de los temas están arriba de todo)
js/app.js             pantallas y botones
js/store.js           datos: cómo se guardan, valores por defecto y cálculos
js/utils.js           formato de plata, fechas y otras funciones chicas
js/charts.js          gráfico de torta en SVG
js/monefy.js          importador del CSV de Monefy
icons/                íconos de la app
```

No usa librerías ni hay que compilar nada: lo que editás es lo que corre.

## Probarla en la PC (Windows)

Hace falta servirla desde un servidor local, porque abriendo el `index.html` con doble clic no anda. Cualquiera de estas opciones sirve:

- **VS Code**: instalá la extensión "Live Server", abrí la carpeta, clic derecho en `index.html` y elegí "Open with Live Server".
- **Python**: en una terminal, dentro de la carpeta, corré `python -m http.server 8080` y entrá a http://localhost:8080
- **Node**: `npx serve .`

Para ver datos de ejemplo, entrá con `?demo` al final de la dirección (solo funciona la primera vez, con la app vacía).

## Ponerla en el iPhone (gratis, con GitHub Pages)

1. Creá una cuenta en github.com y un repositorio nuevo, por ejemplo `mis-finanzas`.
2. Subí todos los archivos de esta carpeta (en la web: "Add file → Upload files").
3. En el repo, andá a **Settings → Pages**. En "Branch" elegí `main` y la carpeta `/ (root)`, y tocá Save.
4. En un minuto queda publicada en `https://TU-USUARIO.github.io/mis-finanzas/`.
5. En el iPhone, abrí esa dirección **en Safari**, tocá **Compartir → Agregar a pantalla de inicio**.

Para pasársela a amigos o familia, mandales el mismo link. Los datos de cada uno quedan en su propio celular: nadie ve los de nadie.

### Cuando cambies algo

Subí los archivos de nuevo y cambiá `CACHE = 'mis-finanzas-v1'` en `sw.js` por `v2`, `v3`, etc. Así los celulares bajan la versión nueva. A veces hay que cerrar la app y abrirla dos veces para ver el cambio.

## Importante sobre los datos

- Se guardan **solo en ese dispositivo**. Si borrás la app de la pantalla de inicio, se borran los datos.
- Usá **Ajustes → Exportar respaldo** cada tanto y guardá el archivo en iCloud Drive o Google Drive.
- Para pasar los datos del celu a la PC (o al revés): exportás en uno e importás en el otro.

## Próximos pasos posibles

1. **Presupuestos** por categoría con aviso cuando te pasás.
2. **Movimientos recurrentes** (alquiler, suscripciones).
3. **Cuentas de usuario y sincronización** entre dispositivos (con un backend gratis como Supabase).
4. **Mercado Pago**: traer movimientos automáticamente. Necesita el paso 3 antes, porque la clave de Mercado Pago no puede quedar guardada dentro de la app.
