import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './router/ProtectedRoute';

// --- Páginas Principales ---
import DashboardPage from './pages/dashboard/DashboardPage';
import ListaClientesPage from './pages/clientes/ListaClientesPage';
import ListaProveedoresPage from './pages/proveedores/ListaProveedoresPage';
import ListaServiciosPage from './pages/servicios/ListaServiciosPage';
import ListaFacturasVentaPage from './pages/ventas/ListaFacturasVentaPage';
import NuevaVentaPage from './pages/ventas/NuevaVentaPage';
import ListaFacturasCompraPage from './pages/compras/ListaFacturasCompraPage';
import NuevaCompraPage from './pages/compras/NuevaCompraPage';
import ListaCuentasBancariasPage from './pages/tesoreria/ListaCuentasBancariasPage';
import ListaPagosRealizadosPage from './pages/tesoreria/ListaPagosRealizadosPage';
import ListaPagosRecibidosPage from './pages/tesoreria/ListaPagosRecibidosPage';
import ListaPlanContablePage from './pages/contabilidad/ListaPlanContablePage';
import ListaAsientosContablesPage from './pages/contabilidad/ListaAsientosContablesPage';
import ListaProyectosPage from './pages/proyectos/ListaProyectosPage';
import NuevaProyectoPage from './pages/proyectos/NuevaProyectoPage';
import ListaPrestamosPage from './pages/prestamos/ListaPrestamosPage';
import NuevoPrestamoPage from './pages/prestamos/NuevoPrestamoPage';
import ListaUsuariosPage from './pages/configuracion/ListaUsuariosPage';
import ListaEmpresasPage from './pages/configuracion/ListaEmpresasPage';
import LibrosElectronicosPage from './pages/reportes/LibrosElectronicosPage';
import EstadoResultadosPage from './pages/reportes/EstadoResultadosPage';
import BalanceGeneralPage from './pages/reportes/BalanceGeneralPage'; 

// --- ¡NUEVA IMPORTACIÓN! ---
import ListaCentrosCostoPage from './pages/maestros/ListaCentrosCostoPage';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading-spinner">Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Proyectos */}
          <Route path="/proyectos" element={<ListaProyectosPage />} />
          <Route path="/proyectos/nuevo" element={<NuevaProyectoPage />} />

          {/* Ventas */}
          <Route path="/ventas" element={<ListaFacturasVentaPage />} />
          <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
          
          {/* Compras */}
          <Route path="/compras" element={<ListaFacturasCompraPage />} />
          <Route path="/compras/nueva" element={<NuevaCompraPage />} />

          {/* Tesorería */}
          <Route path="/tesoreria/cuentas" element={<ListaCuentasBancariasPage />} />
          <Route path="/tesoreria/pagos-realizados" element={<ListaPagosRealizadosPage />} />
          <Route path="/tesoreria/pagos-recibidos" element={<ListaPagosRecibidosPage />} />

          {/* Contabilidad */}
          <Route path="/contabilidad/plan-cuentas" element={<ListaPlanContablePage />} />
          <Route path="/contabilidad/asientos" element={<ListaAsientosContablesPage />} />

          {/* Préstamos */}
          <Route path="/prestamos" element={<ListaPrestamosPage />} />
          <Route path="/prestamos/nuevo" element={<NuevoPrestamoPage />} />

          {/* Maestros */}
          <Route path="/maestros" element={<Navigate to="/clientes" />} />
          <Route path="/clientes" element={<ListaClientesPage />} />
          <Route path="/proveedores" element={<ListaProveedoresPage />} />
          <Route path="/servicios" element={<ListaServiciosPage />} />
          <Route path="/centros-costo" element={<ListaCentrosCostoPage />} /> 

          {/* Reportes */}
          <Route path="/reportes" element={<Navigate to="/reportes/libros-electronicos" />} />
          <Route path="/reportes/libros-electronicos" element={<LibrosElectronicosPage />} />
          <Route path="/reportes/estado-resultados" element={<EstadoResultadosPage />} />
          <Route path="/reportes/balance-general" element={<BalanceGeneralPage />} /> 

          {/* Configuración */}
          <Route path="/configuracion" element={<Navigate to="/configuracion/usuarios" />} />
          <Route path="/configuracion/usuarios" element={<ListaUsuariosPage />} />
          <Route path="/configuracion/empresas" element={<ListaEmpresasPage />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;