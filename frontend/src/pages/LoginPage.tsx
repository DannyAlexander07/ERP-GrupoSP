// Archivo: frontend/src/pages/LoginPage.tsx (VERSIÓN CON ENVÍO DE USERDATA A CONTEXTO)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Importamos useAuth
import { loginService } from '../services/authService';
import { showSuccessToast, showErrorAlert } from '../services/notificationService'; 
import logoImagen from '../assets/gruposp.jpeg'; 
import '../styles/LoginPage.css';

const LoginPage = () => {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth(); // Obtenemos la función login del contexto
    const navigate = useNavigate();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);

        if (!username || !password) {
            showErrorAlert('Por favor, ingrese usuario y contraseña.');
            setLoading(false);
            return;
        }

        try {
            // El loginService ahora devuelve el token Y los datos del usuario
            const { token, usuario: userData } = await loginService(username, password);
            
            showSuccessToast(`¡Bienvenido, ${userData.nombres}!`); 
            
            // ¡CAMBIO CLAVE AQUÍ! Pasamos el token Y los datos del usuario a la función login del contexto
            login(token, userData);
            
            navigate('/dashboard');
        } catch (err) {
            if (err instanceof Error) {
                showErrorAlert(err.message); 
            } else {
                showErrorAlert('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <img src={logoImagen} alt="Logo ERP" className="login-logo" />
                <h2>Iniciar Sesión</h2>
                <p>Bienvenido a SPEAS</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="username">Nombre de Usuario</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="usuario nombre"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Contraseña</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••"
                            required
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;