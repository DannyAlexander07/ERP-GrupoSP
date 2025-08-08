// Archivo: frontend/src/router/ProtectedRoute.tsx (VERSIÓN CORREGIDA PARA FORZAR LOGIN EN DESARROLLO)
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import MainLayout from '../components/layout/MainLayout';

const ProtectedRoute = () => {
    const { isAuthenticated, loading } = useAuth(); // <-- Obtener 'loading' del contexto

    // Si la autenticación aún está en proceso de carga, no renderizamos nada o un spinner
    if (loading) {
        return <div>Cargando autenticación...</div>; // O un spinner más elaborado
    }

    // Lógica correcta: Si el usuario NO está autenticado (y ya terminó de cargar), lo redirigimos al login.
    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    // Si está autenticado (y ya terminó de cargar), mostramos el layout principal con la página correspondiente.
    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};

export default ProtectedRoute;
