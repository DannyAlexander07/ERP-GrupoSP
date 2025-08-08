// Archivo: frontend/src/services/notificationService.ts (VERSIÓN CON DISEÑO DE ERRORES MEJORADO Y CORREGIDA)
import Swal from 'sweetalert2';

// Alerta de éxito que se cierra sola
export const showSuccessToast = (title: string) => {
    Swal.fire({
        icon: 'success',
        title: title,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
    });
};

// Alerta de error simple
export const showErrorAlert = (message: string) => {
    Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: message,
        confirmButtonColor: '#3b82f6',
    });
};

// Alerta de confirmación para acciones
export const showConfirmDialog = (title: string, text: string) => {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
    });
};

// --- FUNCIÓN MEJORADA Y CORREGIDA PARA ACEPTAR undefined EN ERRORES ---
// Alerta de error de validación que muestra una lista de problemas con diseño
export const showValidationErrorAlert = (errors: { [key: string]: string | undefined; }) => { // ¡CAMBIO CLAVE AQUÍ!
    // Icono SVG para cada item de la lista
    const errorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" style="color: #ef4444; margin-right: 12px; flex-shrink: 0;" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>`;
    
    // Convertimos el objeto de errores en una lista de HTML con estilos
    // Filtramos los errores que son undefined para no mostrarlos
    const errorMessages = Object.values(errors)
        .filter((error): error is string => typeof error === 'string' && error.trim() !== '') // Filtra undefined y strings vacíos
        .map(error => `<li style="display: flex; align-items: center; margin-bottom: 0.75rem; font-size: 1rem;">${errorIcon}<span>${error}</span></li>`)
        .join('');
    
    Swal.fire({
        icon: 'error',
        title: 'Por favor, corrige los siguientes errores:',
        html: `<ul style="text-align: left; list-style: none; padding: 0; margin-top: 1rem;">${errorMessages}</ul>`,
        confirmButtonColor: '#3b82f6',
    });
};