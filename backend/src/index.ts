// Archivo: backend/src/src/index.ts (VERSIÓN COMPLETA Y CORRECTA)
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { testConnection } from './config/database';

// Importaciones de todas las rutas del sistema
import authRoutes from './routes/auth.routes';
import clienteRoutes from './routes/cliente.routes';
import proveedorRoutes from './routes/proveedor.routes';
import servicioRoutes from './routes/servicio.routes';
import ventaRoutes from './routes/venta.routes'; 
import compraRoutes from './routes/compra.routes'; 
import cuentaBancariaRoutes from './routes/cuentaBancaria.routes'; 
import pagoRealizadoRoutes from './routes/pagoRealizado.routes';
import pagoRecibidoRoutes from './routes/pagoRecibido.routes'; 
import planContableRoutes from './routes/planContable.routes'; 
import asientoContableRoutes from './routes/asientoContable.routes'; 
import proyectoRoutes from './routes/proyecto.routes'; 
import monedaRoutes from './routes/moneda.routes'; 
import centroCostoRoutes from './routes/centroCosto.routes'; 
import usuarioRoutes from './routes/usuario.routes';
import empresaRoutes from './routes/empresa.routes'; 
import rolRoutes from './routes/rol.routes';
import prestamoRoutes from './routes/prestamo.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reporteRoutes from './routes/reporte.routes'; 
import reporteContableRoutes from './routes/reporteContable.routes';

// Cargar variables de entorno
dotenv.config();

// Probar la conexión a la base de datos al iniciar
testConnection();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // --- ¡CORRECCIÓN AQUÍ! ---
    // Añadimos las cabeceras personalizadas a la lista de cabeceras permitidas.
    allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'X-Auditoria-Usuario-Id',
        'X-Auditoria-Nombre-Usuario'
    ],
}));
app.use(express.json());

// Ruta de prueba
app.get('/api', (req, res) => {
    res.send('¡El servidor del ERP está funcionando correctamente!');
});

// --- Uso de Rutas de la API ---
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/ventas', ventaRoutes); 
app.use('/api/compras', compraRoutes); 
app.use('/api/cuentas-bancarias', cuentaBancariaRoutes); 
app.use('/api/pagos-realizados', pagoRealizadoRoutes);
app.use('/api/pagos-recibidos', pagoRecibidoRoutes); 
app.use('/api/plan-contable', planContableRoutes); 
app.use('/api/asientos-contables', asientoContableRoutes); 
app.use('/api/proyectos', proyectoRoutes); 
app.use('/api/monedas', monedaRoutes); 
app.use('/api/centros-costo', centroCostoRoutes); 
app.use('/api/usuarios', usuarioRoutes); 
app.use('/api/empresas', empresaRoutes); 
app.use('/api/roles', rolRoutes);
app.use('/api/prestamos', prestamoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/reportes-contables', reporteContableRoutes);

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});