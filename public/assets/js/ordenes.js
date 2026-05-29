// Estado global
let ordenesData = [];
let scannerStream = null;
let scannerInterval = null;

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

        const response = await fetch('https://deb.regomax.com/api/ordenes/estado/abierta', {
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

/**
 * Abre el modal del escáner QR/Código de barras
 */
async function abrirEscanerQR() {
    const modal = new bootstrap.Modal(document.getElementById('scannerModal'));
    modal.show();

    try {
        // Verificar si el navegador soporta mediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tu navegador no soporta acceso a la cámara. Usa un navegador moderno como Chrome, Safari o Firefox.');
        }

        // Solicitar acceso a la cámara
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        const video = document.getElementById('scannerVideo');
        video.srcObject = scannerStream;
        
        // Esperar a que el video esté listo
        video.onloadedmetadata = () => {
            video.play().then(() => {
                iniciarEscaneo();
            }).catch(err => {
                console.error('Error al reproducir video:', err);
                document.getElementById('scannerStatus').innerHTML = `
                    <i class="bi bi-exclamation-circle me-2"></i>
                    Error al acceder a la cámara
                `;
            });
        };

    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        
        let mensajeError = 'Error: No se pudo acceder a la cámara.';
        
        if (error.name === 'NotAllowedError') {
            mensajeError = '❌ Permiso denegado. Por favor, permite el acceso a la cámara en los ajustes de tu navegador.';
        } else if (error.name === 'NotFoundError') {
            mensajeError = '❌ No se encontró cámara en el dispositivo.';
        } else if (error.name === 'NotReadableError') {
            mensajeError = '❌ La cámara está siendo usada por otra aplicación.';
        } else if (error.message.includes('soporta')) {
            mensajeError = error.message;
        }
        
        document.getElementById('scannerStatus').innerHTML = `
            <i class="bi bi-exclamation-circle me-2"></i>
            ${mensajeError}
        `;
    }
}

/**
 * Inicia el escaneo de códigos QR/Códigos de barras
 */
function iniciarEscaneo() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let lastScannedCode = null;
    let lastScannedTime = 0;

    scannerInterval = setInterval(() => {
        if (!video || !video.srcObject || !scannerStream) {
            clearInterval(scannerInterval);
            return;
        }

        try {
            // Dibujar el frame actual del video en el canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // Usar ZXing para decodificar el código
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const luminanceSource = new ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
            const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));

            // Intentar leer el código
            let result = null;
            try {
                const reader = new ZXing.MultiFormatReader();
                result = reader.decode(binaryBitmap);
            } catch (e) {
                // Sin código detectado, esto es normal
            }

            // Si se detectó un código
            if (result) {
                const scannedText = result.getText();

                // Evitar leer el mismo código múltiples veces en corto tiempo
                if (scannedText !== lastScannedCode || Date.now() - lastScannedTime > 2000) {
                    lastScannedCode = scannedText;
                    lastScannedTime = Date.now();

                    procesarCodigoEscaneado(scannedText);
                }
            }
        } catch (error) {
            // Errores normales durante el escaneo
        }
    }, 300); // Escanear cada 300ms
}

/**
 * Procesa el código escaneado
 */
function procesarCodigoEscaneado(codigo) {
    console.log('✅ Código detectado:', codigo);

    // Actualizar estado en el modal
    const statusEl = document.getElementById('scannerStatus');
    statusEl.className = 'scanner-status detected';
    statusEl.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>¡Código detectado!
    `;

    // Mostrar el código escaneado
    const displayEl = document.getElementById('scannedCodeDisplay');
    displayEl.innerHTML = `
        <div class="scanned-code">
            <strong>Código leído:</strong><br>
            <code>${codigo}</code>
        </div>
    `;

    // Cerrar el escáner y simular Enter para enviar el código
    cerrarEscaner();

    // Simular que el usuario presionó el código en un campo de texto
    // y luego presionó Enter para procesar
    crearCampoEntradaTemporal(codigo);
}

/**
 * Crea un campo temporal para recibir el código y simula Enter
 */
function crearCampoEntradaTemporal(codigo) {
    // Crear un input temporal
    const input = document.createElement('input');
    input.type = 'text';
    input.value = codigo;
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    // Enfocar el input y simular Enter
    input.focus();
    
    // Crear y disparar evento de teclado Enter
    const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    });

    input.dispatchEvent(enterEvent);

    // Mostrar notificación
    mostrarNotificacionCodigo(codigo);

    // Eliminar el input temporal después de un tiempo
    setTimeout(() => input.remove(), 1000);
}

/**
 * Muestra una notificación del código escaneado
 */
function mostrarNotificacionCodigo(codigo) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.role = 'alert';
    alert.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        <strong>¡Código escaneado!</strong> ${codigo}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);

    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (alertContainer.contains(alert)) {
            alert.remove();
        }
    }, 5000);
}

/**
 * Cierra el escáner y detiene la cámara
 */
function cerrarEscaner() {
    // Detener el intervalo de escaneo
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }

    // Detener todos los tracks del stream de video
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }

    // Limpiar el video
    const video = document.getElementById('scannerVideo');
    if (video) {
        video.srcObject = null;
    }

    // Limpiar la notificación
    document.getElementById('scannedCodeDisplay').innerHTML = '';
    document.getElementById('scannerStatus').className = 'scanner-status scanning';
    document.getElementById('scannerStatus').innerHTML = `
        <i class="bi bi-hourglass-split me-2"></i>Escaneando...
    `;
}
