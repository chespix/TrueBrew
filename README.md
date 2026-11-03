# ☕ TrueBrew

> Proyecto experimental, 100% "vibecodeado".

**TrueBrew** es un mapa colaborativo de cafés de especialidad en Buenos Aires (CABA), pensado principalmente para el celular. La comunidad vota si cada cafetería sirve realmente "café de especialidad" o no, y el mapa muestra el resultado.

🌐 **Web:** https://truebrew-nsy9.onrender.com/ (el plan gratuito de Render tarda unos segundos en despertar)

![Interfaz de la app TrueBrew](assets/features.png)

---

## ✨ Características

- 🗺️ **Mapa interactivo** con tiles de OpenStreetMap y React-Leaflet, con modo claro y oscuro (el oscuro es un filtro CSS sobre los tiles).
- 👍 **Verificación colaborativa:** con sesión iniciada podés votar. Más votos a favor que en contra = verificado (verde), más en contra = falso (rojo), empate o sin votos = pendiente (naranja). La API solo publica los conteos, nunca quién votó.
- 📍 **Agregar locales:** tocando el mapa, desde tu ubicación GPS, buscando la cafetería en Overture Maps o buscando una dirección (Nominatim / OpenStreetMap).
- 🛡️ **Moderación:** los locales que agrega un usuario quedan pendientes hasta que un admin los aprueba. Los admins también pueden editar y eliminar.
- 🔐 **Login con Google:** nativo en Android (Credential Manager vía `@capgo/capacitor-social-login`) y con Google Identity Services en la web (`@react-oauth/google`).
- 🧱 **Límites de uso:** `express-rate-limit` limita los pedidos por IP (300 cada 15 minutos para la API, 20 locales nuevos por hora).

## 💻 Tecnologías

- **Frontend:** React + Vite, Leaflet (`react-leaflet`, `react-leaflet-cluster`)
- **Backend:** Node.js + Express (sirve la API y, en producción, la SPA compilada)
- **Base de datos:** PostgreSQL (Aiven)
- **App móvil:** Capacitor 8 (Android)
- **Hosting:** Render.com

## 📁 Estructura

```
server.js            API Express (auth, locales, votos, moderación, búsquedas)
database.js          Acceso a Postgres y creación de tablas
src/App.jsx          Estado y lógica principal de la app
src/components/      Pantallas: TopNav, SearchBar, ShopDetails, modales...
src/map/             Íconos de marcadores y controles del mapa
src/lib/             Helpers (notificaciones, estado según votos)
src/data/mockShops.js  Cafés iniciales para el seed
scripts/             Utilidades (importar cafés desde OpenStreetMap)
tests/               Tests de la API
android/             Proyecto nativo de Capacitor
```

## 🚀 Instalación local

### 1. Requisitos

- **Node.js 22+**
- Una base **PostgreSQL** (local o en la nube)

### 2. Instalación

```bash
git clone https://github.com/chespix/TrueBrew.git
cd TrueBrew
npm install
```

### 3. Variables de entorno

Creá un archivo `.env` en la raíz:

```env
# Servidor
PORT=3001

# Postgres
DATABASE_URL=postgres://usuario:contraseña@host:puerto/basededatos
# DB_SSL=false            # para un Postgres local sin SSL
# DB_SSL_INSECURE=true    # no verificar el certificado (solo si hace falta)

# Autenticación
JWT_SECRET=una_clave_larga_y_aleatoria
GOOGLE_CLIENT_ID=tu_client_id_web.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=tu_client_id_web.apps.googleusercontent.com

# Admins (separados por coma)
ADMIN_EMAILS=usuario1@gmail.com,usuario2@gmail.com

# Opcionales
# OVERTURE_API_KEY=...        # sin esto se usa la clave DEMO de Overture
# CONTACT_EMAIL=vos@mail.com  # se agrega al User-Agent de Nominatim
# TRUST_PROXY=1               # saltos de proxy delante del server (Render = 1)

# URL de la API para builds de Android (vacío en desarrollo web: Vite hace de proxy)
# VITE_API_URL=https://truebrew-nsy9.onrender.com
```

Si la base es de Aiven, la conexión se verifica con el certificado `ca.pem` del repo.

### 4. Ejecutar

```bash
npm run dev:seed   # crea las tablas, carga los cafés iniciales si la base está vacía y levanta Vite + Express
npm run dev        # lo mismo, sin seed
```

La app queda en `https://localhost:5173/` (Vite usa un certificado autofirmado para que funcione la geolocalización; aceptá la advertencia del navegador).

### 5. Lint y tests

```bash
npm run lint
DATABASE_URL=postgres://... npm test   # ¡usa una base descartable! Los tests borran las tablas
```

GitHub Actions corre lint, build y tests en cada push a `main` y en cada PR (`.github/workflows/ci.yml`).

### Otros scripts

- `npm run fetch:cafes`: baja de OpenStreetMap los cafés de CABA con nombres tipo "specialty", "coffee", "tostador" y reescribe `src/data/mockShops.js`.
- `npm start`: arranca el server en modo producción (sirve `dist/`). Corré `npm run build` antes.

---

## 📱 Android (Capacitor)

```bash
npm run build      # compila la app web (con VITE_API_URL apuntando a Render)
npx cap sync       # copia dist/ y los plugins al proyecto Android
npx cap open android
```

Desde Android Studio: **Build → Generate Signed App Bundle** con tu upload key (las claves no están en el repo).

**Versionado:** antes de cada release actualizá `versionCode` (+1) y `versionName` en `android/app/build.gradle`, y `version` en `package.json`.

**Login con Google en Android:** el plugin usa el **Client ID web** (`webClientId`) para pedir el token. En Google Cloud Console, en el mismo proyecto, tiene que haber un cliente OAuth **Android** con el package `app.truebrew.caba` y el SHA-1 de cada certificado que firma la app: debug, upload key y el de **Play App Signing** (Play Console → Integridad de la app). Si falla, filtrá Logcat por `GoogleProvider`.

---

## ☁️ Deploy (Render)

`render.yaml` define el servicio web:

1. Conectá el repo en Render como **Blueprint** (o creá un Web Service a mano con los mismos comandos).
2. Build: `npm install --include=dev && npm run build` (incluye dev dependencies porque Vite hace falta para compilar).
3. Start: `node server.js --seed` (el seed solo carga datos si la base está vacía).
4. Cargá las variables `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` y, si querés, `OVERTURE_API_KEY` y `CONTACT_EMAIL`. `JWT_SECRET` lo genera Render.

Para que la base no se duerma podés pegarle a `GET /api/ping` periódicamente (por ejemplo con un cron externo).
