// Archivo: frontend/src/hooks/useAuth.ts (VERSIÓN ACTUALIZADA CON EMPRESA_ID EN USERDATA)
import { createContext, useContext } from 'react';

// 1. Definimos el tipo de los datos de USUARIO que guardaremos en el contexto
export interface UserData {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
    empresa_id: number;
    // roles ahora es un array de objetos con más detalle
    roles: { rol_id: number; nombre_rol: string; permisos: { codigo_permiso: string }[] }[]; 
}

// 2. Definimos el tipo del contexto de autenticación
export interface AuthContextType {
    isAuthenticated: boolean;
    user: UserData | null; 
    login: (token: string, userData: UserData) => void; 
    logout: () => void;
    loading: boolean;
    hasPermission: (permission: string) => boolean; // <-- ¡NUEVA FUNCIÓN!
}
// 3. Creamos y exportamos el Context aquí.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 4. El hook personalizado consume el contexto para hacerlo fácil de usar en otros componentes.
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};