/**
 * Verifica si el usuario está autenticado
 * Si no tiene token válido, redirige a login
 */
function verificarAutenticacion() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');

    // Si no hay token ni usuario, redirige a login
    if (!token || !user) {
        window.location.href = '/login.html?error=no_autenticado';
        return false;
    }

    return true;
}

// Ejecutar verificación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
});
