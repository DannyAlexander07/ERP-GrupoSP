# 🚀 SPEAS - SISTEMA ERP INTEGRAL

SPEAS es un sistema de planificación de recursos empresariales (ERP) full-stack, diseñado desde cero para la **gestión integral de empresas de servicios**.  
Desarrollado con un **stack moderno JavaScript/TypeScript**, permite un control detallado sobre operaciones comerciales, financieras y contables, centralizando la información crítica del negocio en una interfaz moderna e intuitiva.

---

## 📜 Tabla de Contenidos
1. [✨ Características Principales](#-características-principales)
2. [🛠️ Stack Tecnológico](#️-stack-tecnológico)
3. [🚀 Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
4. [📂 Estructura del Proyecto](#-estructura-del-proyecto)

---

## ✨ Características Principales

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/layout-dashboard.svg" width="20"> Dashboard Gerencial**
- Visualización de KPIs en tiempo real (Ventas, Cuentas por Cobrar/Pagar).
- Gráficos interactivos para análisis de Flujo de Caja, Resumen Anual, Top 5 Clientes/Proveedores y más.
- Reportes financieros visuales como Estado de Resultados en formato cascada y rentabilidad por cliente.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/users.svg" width="20"> Módulo de Maestros**
- Gestión centralizada de Clientes, Proveedores y Servicios.
- Mantenimiento de un Plan de Cuentas contable detallado.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/dollar-sign.svg" width="20"> Módulo de Ventas y CRM**
- Creación, seguimiento y anulación de facturas de venta.
- Registro de pagos recibidos y manejo de saldos a favor.
- Aplicación de saldos a facturas pendientes.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/shopping-cart.svg" width="20"> Módulo de Compras**
- Registro de facturas de compra y control de cuentas por pagar.
- Seguimiento del estado de deudas con proveedores.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/landmark.svg" width="20"> Módulo de Tesorería**
- Gestión de cuentas bancarias propias en múltiples monedas.
- Registro y control de todos los pagos realizados y recibidos.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/book-open.svg" width="20"> Módulo de Contabilidad**
- Generación automática de asientos contables.
- Visualización y mantenimiento del libro diario.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/file-text.svg" width="20"> Módulo de Reportes**
- Reportes como Estado de Resultados y Balance General.
- Exportación de datos a Excel.
- Base para Libros Electrónicos (PLE) para SUNAT.

**<img src="https://raw.githubusercontent.com/lucide-icons/lucide/master/icons/settings-2.svg" width="20"> Configuración y Seguridad**
- Gestión de usuarios, empresas y roles.
- Backend protegido por JWT y contraseñas encriptadas con bcrypt.js.

---

## 🛠️ Stack Tecnológico

| Área             | Tecnología / Herramienta                          | Descripción |
|------------------|---------------------------------------------------|-------------|
| **Backend**      | **Node.js con TypeScript**                         | Entorno de ejecución para JavaScript del lado del servidor. |
|                  | **Express.js**                                     | Framework minimalista para la construcción de la API RESTful. |
|                  | **PostgreSQL**                                     | Base de datos relacional para la persistencia de datos. |
|                  | **JWT** & **bcrypt.js**                            | Autenticación segura y encriptación de contraseñas. |
| **Frontend**     | **React 19 con TypeScript**                        | Librería para construir la interfaz de usuario. |
|                  | **Vite**                                           | Herramienta de desarrollo frontend de alta velocidad. |
|                  | **React Router**                                   | Gestión de rutas y navegación en la aplicación. |
|                  | **Axios**                                          | Cliente HTTP para la comunicación con el backend. |
|                  | **ApexCharts**                                     | Creación de gráficos interactivos y dinámicos. |
|                  | **CSS Plano**                                      | Estilos personalizados para un diseño limpio y moderno. |
| **Librerías Clave** | **SweetAlert2**                                 | Notificaciones y alertas atractivas. |
|                  | **Lucide-React**                                   | Iconografía limpia y consistente. |
|                  | **File-Saver** & **xlsx**                          | Exportación de datos a formato Excel. |

---

## 🚀 Instalación y Puesta en Marcha

### 📋 Prerrequisitos
- Node.js **v18+**
- npm o yarn
- PostgreSQL **v14+**

### 1️⃣ Base de Datos
```bash
# Crear base de datos
CREATE DATABASE bd_erp;
```

### 2️⃣ Backend
```bash
Copiar
Editar
cd backend
npm install
cp .env.example .env
nano .env
npm run dev
```
Backend disponible en: http://localhost:4000
# Ejecutar script inicial para tablas
# Ejecutar scripts de actualización (ALTER TABLE)

3️⃣ Frontend
```bash
Copiar
Editar
cd frontend
npm install
npm run dev
```
Frontend disponible en: http://localhost:5173
### 📂 Estructura del Proyecto
```bash
/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Lógica de peticiones HTTP
│   │   ├── middleware/    # Autenticación, autorización
│   │   ├── routes/        # Definición de endpoints de la API
│   │   └── services/      # Lógica de negocio y consultas a la BD
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── hooks/         # Hooks personalizados
│   │   ├── pages/         # Páginas/módulos
│   │   ├── services/      # Llamadas a la API
└── README.md
```
