// Archivo: frontend/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import 'aos/dist/aos.css';
import './styles/global.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider> {/* <-- ENVUELVE LA APP */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
);