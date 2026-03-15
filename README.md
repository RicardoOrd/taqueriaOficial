# 🌮 Taquería — Sistema de Comandas

App de punto de venta para taquería. Frontend React + Backend Node.js + SQLite.

---

## Requisitos

- [Node.js](https://nodejs.org) **v18 o superior**
- npm (viene incluido con Node.js)

---

## Instalación

```bash
# 1. Entra a la carpeta del proyecto
cd taqueria

# 2. Instala las dependencias
npm install

# 3. Arranca el servidor
npm start
```

Abre **http://localhost:3000** en tu navegador.

---

## Credenciales por defecto

| Usuario | Contraseña |
|---------|-----------|
| admin   | 1234      |

> Puedes cambiar la contraseña desde `db/database.js` o usando el endpoint `/api/auth/change-password`.

---

## Uso en celular o iPad

1. Asegúrate de que tu celular esté en la **misma red WiFi** que tu PC.
2. En tu PC, averigua tu IP local:
   - Windows: `ipconfig` en la terminal → busca "Dirección IPv4"
   - Mac/Linux: `ifconfig` o `ip addr`
3. En el celular abre el navegador y entra a: `http://TU_IP:3000`
   - Ejemplo: `http://192.168.1.100:3000`
4. **Para instalar como app:**
   - **iPhone/iPad**: Safari → botón compartir → "Añadir a pantalla de inicio"
   - **Android**: Chrome → menú ⋮ → "Añadir a pantalla de inicio"

---

## Estructura del proyecto

```
taqueria/
├── server.js           → Servidor Express principal
├── package.json        → Dependencias
├── db/
│   ├── database.js     → Inicialización de SQLite y esquema
│   └── taqueria.sqlite → Base de datos (se crea automáticamente)
├── routes/
│   ├── middleware.js   → Autenticación JWT
│   ├── auth.js         → Login / cambio de contraseña
│   ├── products.js     → CRUD de productos
│   └── orders.js       → CRUD de comandas + reportes
└── public/
    └── index.html      → Frontend React (SPA)
```

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/api/auth/login` | Iniciar sesión |
| GET    | `/api/products` | Listar productos activos |
| POST   | `/api/products` | Crear producto |
| PUT    | `/api/products/:id` | Editar producto |
| DELETE | `/api/products/:id` | Eliminar (soft delete) |
| GET    | `/api/orders` | Listar comandas activas + recientes |
| POST   | `/api/orders` | Crear comanda |
| PUT    | `/api/orders/:id` | Actualizar comanda / cobrar |
| DELETE | `/api/orders/:id` | Cancelar comanda |
| GET    | `/api/orders/report?date=YYYY-MM-DD` | Corte del día |

Todos los endpoints (excepto login) requieren el header:
```
Authorization: Bearer <token>
```

---

## Modo desarrollo (auto-reload)

```bash
npm run dev
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz (opcional):

```env
PORT=3000
JWT_SECRET=mi_clave_secreta_super_segura
```

---

## Base de datos

SQLite — el archivo `db/taqueria.sqlite` se crea automáticamente al primer arranque.
Los datos persisten entre reinicios del servidor.

Para hacer respaldo basta con copiar ese archivo `.sqlite`.

---

## Tecnologías

- **Backend**: Node.js, Express, better-sqlite3, JWT, bcryptjs
- **Frontend**: React 18 (CDN), Babel standalone
- **DB**: SQLite 3
