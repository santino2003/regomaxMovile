// Estado global
let ordenesData = [];

// Cargar órdenes al iniciar
document.addEventListener('DOMContentLoaded', () => {
    // Mostrar username si está guardado
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.nombre || user.name) {
        document.getElementById('username-display').textContent = (user.nombre || user.name).toUpperCase();
    }
    
    cargarOrdenes();
});

/**
 * Carga las órdenes desde la API
 */
async function cargarOrdenes() {
    const loadingState = document.getElementById('loadingState');
    const tableContainer = document.getElementById('tableContainer');
    const emptyState = document.getElementById('emptyState');
    const alertContainer = document.getElementById('alertContainer');

    // Mostrar loading
    loadingState.classList.remove('d-none');
    tableContainer.classList.add('d-none');
    emptyState.classList.add('d-none');
    alertContainer.innerHTML = '';

    try {
        // Obtener token del localStorage
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
            throw new Error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
        }

        // Preparar headers con token
        const headers = {
            'Content-Type': 'application/json'
        };

        // Si hay token, agregarlo al header Authorization
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('📡 Enviando petición a API con token...');
        console.log('Token:', token.substring(0, 20) + '...');

        const response = await fetch('https://programa.regomax.com/api/ordenes/estado/abierta', {
            method: 'GET',
            credentials: 'include', // Incluye cookies si existen
            headers: headers
        });

        if (!response.ok) {
            // Si es 401, significa que la autenticación falló
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = '/login.html?error=sesion_expirada';
                return;
            }
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        ordenesData = Array.isArray(data) ? data : data.data || [];

        console.log('Órdenes cargadas:', ordenesData);

        // Renderizar tabla
        if (ordenesData.length > 0) {
            renderizarTabla(ordenesData);
            document.getElementById('ordenesCount').textContent = ordenesData.length;
            tableContainer.classList.remove('d-none');
        } else {
            emptyState.classList.remove('d-none');
        }

    } catch (error) {
        console.error('Error cargando órdenes:', error);
        mostrarError(error.message);
    } finally {
        loadingState.classList.add('d-none');
    }
}

/**
 * Renderiza las órdenes en la tabla
 */
function renderizarTabla(ordenes) {
    const tbody = document.getElementById('ordenesTableBody');
    tbody.innerHTML = '';

    // Guardar órdenes en sessionStorage para acceder desde la página de detalle
    sessionStorage.setItem('ordenesData', JSON.stringify(ordenes));

    ordenes.forEach((orden, index) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => {
            window.location.href = `/detalle-orden.html?index=${index}`;
        };
        
        // Obtener datos con fallbacks
        const clienteFinal = orden.cliente_final || orden.clienteFinal || orden.empresa || orden.cliente || orden.customer || 'N/A';
        
        // Extraer el primer producto del array
        let producto = 'N/A';
        if (orden.productos && Array.isArray(orden.productos) && orden.productos.length > 0) {
            producto = orden.productos[0].producto || 'N/A';
        }

        row.innerHTML = `
            <td><strong>${clienteFinal}</strong></td>
            <td>${producto}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Muestra el detalle de una orden
 */
function verDetalle(index) {
    const orden = ordenesData[index];
    if (!orden) return;

    const mensaje = `
═══════════════════════════════════════
           DETALLE DE ORDEN
═══════════════════════════════════════

ID: OV-${orden.id}
Cliente: ${orden.cliente || orden.customer || 'N/A'}
Cliente Final: ${orden.cliente_final || orden.clienteFinal || '-'}
Fecha: ${formatearFecha(orden.fecha || orden.createdAt)}
Estado: ${orden.estado || 'Abierto'}
Responsable: ${orden.responsable || orden.asignado || 'N/A'}
Total: $${formatearMoneda(orden.total || 0)}

═══════════════════════════════════════
            DATOS COMPLETOS (JSON)
═══════════════════════════════════════

${JSON.stringify(orden, null, 2)}
    `;

    alert(mensaje);
}

/**
 * Placeholder para editar orden (redirigiría a otra página en producción)
 */
function editarOrden(index) {
    const orden = ordenesData[index];
    if (!orden) return;
    alert(`Funcionalidad de edición: Orden OV-${orden.id}\n\nEn producción, esto abriría un formulario de edición.`);
}

/**
 * Muestra un mensaje de error en la UI
 */
function mostrarError(mensaje) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="error-message">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Error:</strong> ${mensaje}
        </div>
    `;
}

/**
 * Exporta las órdenes como JSON
 */
function exportarJSON() {
    if (ordenesData.length === 0) {
        alert('No hay órdenes para exportar');
        return;
    }

    const dataStr = JSON.stringify(ordenesData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ordenes-abietas-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Logout
 */
function logout() {
    if (confirm('¿Seguro que querés salir?')) {
        localStorage.clear();
        window.location.href = '/login.html';
    }
}

/**
 * Formatea una fecha
 */
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    try {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return fecha;
    }
}

/**
 * Formatea un número como moneda
 */
function formatearMoneda(valor) {
    return parseFloat(valor || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
