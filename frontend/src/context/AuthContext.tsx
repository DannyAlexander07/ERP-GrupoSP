// Archivo: frontend/src/context/AuthContext.tsx (Versión con Permisos)
import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext, type AuthContextType, type UserData } from '../hooks/useAuth';
// Necesitaremos el servicio de auth para obtener los datos del usuario al recargar
import { fetchUserProfile } from '../services/authService'; 

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const validateToken = async () => {
            const token = localStorage.getItem('user_token');
            if (token) {
                try {
                    // Al recargar, obtenemos el perfil completo del usuario para tener sus permisos actualizados
                    const userData = await fetchUserProfile(); 
                    setIsAuthenticated(true);
                    setUser(userData);
                } catch {
                    // Si el token es inválido o expiró, cerramos sesión
                    logout();
                }
            }
            setLoading(false);
        };
        validateToken();
    }, []);

    const login = (token: string, userData: UserData) => {
        localStorage.setItem('user_token', token);
        setIsAuthenticated(true);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('user_token');
        setIsAuthenticated(false);
        setUser(null);
    };

    // --- ¡LÓGICA CLAVE AÑADIDA! ---
    const hasPermission = useCallback((permissionCode: string): boolean => {
        if (!user || !user.roles) {
            return false;
        }
        // Buscamos en todos los roles del usuario si alguno tiene el permiso requerido
        return user.roles.some(rol => 
            rol.permisos && rol.permisos.some(p => p.codigo_permiso === permissionCode)
        );
    }, [user]); // Se recalcula solo si el usuario cambia

    const value: AuthContextType = { isAuthenticated, user, login, logout, loading, hasPermission };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};