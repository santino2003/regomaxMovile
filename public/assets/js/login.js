function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement && errorElement.querySelector('span')) {
        errorElement.querySelector('span').textContent = message;
        errorElement.classList.remove('d-none');
    }

    const successElement = document.getElementById('successMessage');
    if (successElement) {
        successElement.classList.add('d-none');
    }
}

function showSuccess(message) {
    const successElement = document.getElementById('successMessage');
    if (successElement && successElement.querySelector('span')) {
        successElement.querySelector('span').textContent = message;
        successElement.classList.remove('d-none');
    }

    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.classList.add('d-none');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');

    if (!form || !loginButton) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        form.classList.add('was-validated');

        if (!form.checkValidity()) {
            return;
        }

        const username = document.getElementById('username')?.value.trim() || '';
        const password = document.getElementById('password')?.value.trim() || '';

        if (!username || !password) {
            showError('Usuario y contraseña son requeridos');
            return;
        }

        const originalText = loginButton.innerHTML;
        loginButton.disabled = true;
        loginButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Iniciando...
        `;

        try {
            
            const response = await fetch('https://programa.regomax.com/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al iniciar sesión');
            }

            // Guardar token en localStorage (importante para autenticación futura)
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                console.log('✅ Token guardado en localStorage');
            }

            // Guardar usuario
            localStorage.setItem('user', JSON.stringify({
                nombre: username,
                username: username
            }));

            showSuccess(`Bienvenido "${username}". Accediendo...`);

            setTimeout(() => {
                window.location.href = '/ordenes.html';
            }, 800);

        } catch (error) {
            showError(error?.message || 'Error desconocido');
            loginButton.disabled = false;
            loginButton.innerHTML = originalText;
        }
    });
});