# ☕ TrueBrew

**TrueBrew** es un mapa colaborativo de cafés de especialidad diseñado para Buenos Aires (CABA) y pensado principalmente para uso móvil. Permite a los amantes del café verificar si las cafeterías locales realmente sirven "Café de Especialidad" o no, confiando enteramente en un modelo de consenso impulsado por la comunidad mediante votos a favor y en contra.

![Interfaz de la app TrueBrew](assets/features.png)

---

## ✨ Características

- 🗺️ **Mapa Oscuro Interactivo:** Explora CABA utilizando un mapa base premium y oscuro de CARTO, integrado junto con React-Leaflet.
- 👍 **Verificación Colaborativa:** Inicia sesión para votar. Las cafeterías con un balance positivo de votos se visualizan como verificadas (Verde), las que tienen saldo negativo se marcan como falsas (Rojo) y los empates/lugares sin votos permanecen pendientes (Naranja).
- 📍 **Agregar Locales y Geolocalización:** Los usuarios pueden agregar nuevas cafeterías directamente desde su ubicación física mediante rastreo nativo de GPS.
- 🛡️ **Panel de Moderación por Roles:** Las cuentas de administradores tienen acceso exclusivo a un panel de "Pendientes" para revisar de manera proactiva, editar, aprobar o rechazar los envíos de la comunidad.
- 🔐 **Autenticación Nativa de Google (OAuth):** Inicio de sesión con un solo toque utilizando las APIs nativas de Identidad en Android gracias a Capacitor, y respaldado por una alternativa web inteligente para su uso desde el navegador.
- 🧱 **Protección DDoS:** Los endpoints de la API están estrictamente asegurados con `express-rate-limit` para prevenir ataques de spam malintencionados.

## 💻 Tecnologías Utilizadas

- **Frontend:** React + Vite
- **Integración de Mapas:** Leaflet (`react-leaflet`)
- **Backend:** Node.js + Express
- **Base de Datos:** PostgreSQL (alojada en Aiven Cloud)
- **Contenedor Móvil (Wrapper):** Capacitor.js (`@capacitor/core`, `@capacitor/google-auth`, `@capacitor/geolocation`)
- **Hosting / Despliegue:** Render.com (Sirve la SPA monolítica junto con la API)

## 🚀 Guía de Instalación Local

### 1. Requisitos Previos
Asegúrate de tener instalado **Node.js 20+** y contar con una conexión a una base de datos **PostgreSQL**.

### 2. Instalación
Clona el repositorio e instala las dependencias utilizando el modo "legacy" para evitar conflictos de versiones entre dependencias de Capacitor:
```bash
git clone https://github.com/chespix/TrueBrew.git
cd TrueBrew
npm install --legacy-peer-deps
```

### 3. Variables de Entorno
Crea un archivo `.env` en el directorio principal del proyecto:
```env
# Servidor
PORT=3001
NODE_ENV=development

# URI Base de Datos Postgres
DATABASE_URL=postgres://usuario:contraseña@hostname:port/dbname

# Autenticación y Seguridad
JWT_SECRET=tu_clave_secreta_jwt_super_segura
GOOGLE_CLIENT_ID=el_id_de_tu_cliente_web.apps.googleusercontent.com

# Administradores permitidos (Separados por coma)
ADMIN_EMAILS=usuario1@gmail.com,usuario2@gmail.com

# URL Base para la API (Dejar vacío para nivel local, o poner la URL de Render para compilar la app)
VITE_API_URL=http://localhost:3001
```

### 4. Ejecución del Servidor e Inicialización de Datos (Seed)
Para que Postgres genere las tablas (schema automáticamente), inyecte cafeterías de prueba (mock) en la base de datos e inicie simultáneamente Vite y Express:
```bash
npm run dev:seed
```
*La aplicación estará accesible a través de tu navegador Web en `http://localhost:5173/`.*

---

## 📱 Desarrollo para Android (Capacitor)

Dado que TrueBrew utiliza Capacitor, la aplicación construida con React se traduce limpiamente en una aplicación nativa basada en Java para Android.

```bash
# 1. Compila la Aplicación React en Producción
npm run build

# 2. Sincroniza la carpeta dist/ hacia la carpeta nativa /assets en Android
npx cap sync

# 3. Abre Android Studio para compilar un AAB / APK
npx cap open android
```

### Notas Importantes para Desarrollo Nativo
- **Autenticación con Google:** Para hacer funcionar el flujo de inicio de sesión en un teléfono Android (o emulador), DEBES registrar las huellas digitales (fingerprints) de firma `SHA-1` debug/producción de tu aplicación dentro de Google Cloud Console (bajo Categoría de Android Oauth).
- **Integraciones con Hardware Móvil:** La aplicación incluye nativamente `@capacitor/status-bar` y `@capacitor/app` para capturar la pulsación del botón físico "Atrás" en los dispositivos Android, y alterar inteligentemente el color de la barra principal del dispositivo.

---

## ☁️ Despliegue y Producción (Web: Render)

TrueBrew está listo para salir a producción en la plataforma Render. El archivo `render.yaml` administra la infraestructura completa automáticamente.

1. Conecta tu repositorio recién enviado de GitHub a tu cuenta de Render.
2. Selecciona la opción "Blueprint" (o simplemente levanta un Web Service y vincula el Repositorio de GitHub de TrueBrew).
3. El proceso de instalación utiliza `npm install --include=dev && npm run build` intencionalmente para evitar que Render elimine `vite` durante el proceso de instalación de producción.
4. Por código, Express intersecta automáticamente la señal `process.env.NODE_ENV === 'production'` sirviendo directamente los archivos visuales compilados e inyectando la app de React en el internet a través de `dist/`.
