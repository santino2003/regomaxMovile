// Estado global
let ordenActual = null;
let detallesOrden = [];
let bolsonesEscaneados = [];
let totalPeso = 0;
let bolsonesEscaneadosPorOrden = {};
let scannerStream = null;
let scannerInterval = null;

// Inicializar cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Mostrar usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.nombre || user.name) {
        document.getElementById('username-display').textContent = (user.nombre || user.name).toUpperCase();
    }

    // Mostrar loading
    document.getElementById('loadingState').classList.remove('d-none');

    // Obtener el ID de la orden de la URL
    const params = new URLSearchParams(window.location.search);
    const ordenIndex = params.get('index');

    if (ordenIndex === null) {
        window.location.href = '/ordenes.html';
        return;
    }

    // Cargar la orden desde sessionStorage o localStorage
    const ordenesJSON = sessionStorage.getItem('ordenesData') || localStorage.getItem('ordenesData');
    if (ordenesJSON) {
        const ordenes = JSON.parse(ordenesJSON);
        const orden = ordenes[parseInt(ordenIndex)];
        
        if (orden) {
            cargarDetallesOrden(orden);
            document.getElementById('loadingState').classList.add('d-none');
            document.getElementById('mainContent').classList.remove('d-none');
        } else {
            window.location.href = '/ordenes.html';
        }
    } else {
        window.location.href = '/ordenes.html';
    }

    // Inicializar modales
    window.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    window.confirmarModal = new bootstrap.Modal(document.getElementById('confirmarModal'));
    window.exitoModal = new bootstrap.Modal(document.getElementById('exitoModal'));

    // Event listeners
    document.getElementById('codigoBolson').addEventListener('keydown', (e) => {
        if (e.keyCode === 13) { // Enter
            e.preventDefault();
            const codigo = document.getElementById('codigoBolson').value.trim();
            if (codigo) {
                procesarCodigoBolson(codigo);
                document.getElementById('codigoBolson').value = '';
                document.getElementById('codigoBolson').focus();
            }
        }
    });

    document.getElementById('btnAgregarManual').addEventListener('click', () => {
        const codigo = document.getElementById('codigoBolson').value.trim();
        if (codigo) {
            procesarCodigoBolson(codigo);
            document.getElementById('codigoBolson').value = '';
            document.getElementById('codigoBolson').focus();
        } else {
            mostrarError('Ingrese un código de bolsón');
        }
    });

    document.getElementById('btnEscanearQR').addEventListener('click', abrirEscanerQRDetalle);

    document.getElementById('btnDespachar').addEventListener('click', procesarDespacho);
    document.getElementById('btnConfirmarDespacho').addEventListener('click', confirmarDespacho);
    document.getElementById('btnCerrarExito').addEventListener('click', () => {
        window.exitoModal.hide();
        window.location.href = '/ordenes.html';
    });
});

/**
 * Cargar los detalles de la orden
 */
function cargarDetallesOrden(orden) {
    ordenActual = orden;
    detallesOrden = orden.productos || [];
    bolsonesEscaneados = [];

    // Inicializar diccionario para esta orden
    if (!bolsonesEscaneadosPorOrden[orden.id]) {
        bolsonesEscaneadosPorOrden[orden.id] = {};
    }

    // Llenar datos en la UI
    document.getElementById('ordenNumero').textContent = `OV-${orden.id}`;
    document.getElementById('clienteFinal').textContent = orden.cliente_final || 'N/A';
    document.getElementById('fechaOrden').textContent = new Date(orden.fecha).toLocaleDateString('es-ES');
    document.getElementById('estadoOrden').textContent = (orden.estado || 'abierta').toUpperCase();

    // Listar productos
    const productosList = document.getElementById('productosList');
    productosList.innerHTML = '';
    
    detallesOrden.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'producto-item';
        div.innerHTML = `
            <span>${prod.producto}</span>
            <span class="badge bg-primary">${prod.cantidad} kg</span>
        `;
        productosList.appendChild(div);
    });

    // Habilitar input de escaneo
    document.getElementById('codigoBolson').disabled = false;
    document.getElementById('btnAgregarManual').disabled = false;
    document.getElementById('codigoBolson').focus();
}

function obtenerCodigoBolson(bolson, codigoEscaneado = '') {
    return String(bolson?.codigo || bolson?.codigo_bolson || bolson?.id || codigoEscaneado).trim();
}

function obtenerBolsonesHashOrden() {
    if (!ordenActual || !ordenActual.id) {
        return {};
    }

    if (!bolsonesEscaneadosPorOrden[ordenActual.id]) {
        bolsonesEscaneadosPorOrden[ordenActual.id] = {};
    }

    return bolsonesEscaneadosPorOrden[ordenActual.id];
}

function actualizarEstadoBotonDespacho() {
    document.getElementById('btnDespachar').disabled = bolsonesEscaneados.length === 0;
}

function agregarBolsonAlAcumulado(bolson, codigoEscaneado) {
    const codigoBolson = obtenerCodigoBolson(bolson, codigoEscaneado);

    if (!codigoBolson) {
        mostrarError('El bolsón verificado no tiene código válido');
        return false;
    }

    const bolsonNormalizado = {
        ...bolson,
        codigo: codigoBolson,
        codigoEscaneado
    };

    const bolsonesHash = obtenerBolsonesHashOrden();
    bolsonesEscaneados.push(bolsonNormalizado);

    try {
        actualizarTablaBolsones();
        actualizarTotales();
        bolsonesHash[codigoEscaneado] = true;
    } catch (error) {
        bolsonesEscaneados = bolsonesEscaneados.filter(b => obtenerCodigoBolson(b) !== codigoBolson);
        delete bolsonesHash[codigoEscaneado];
        actualizarTablaBolsones();
        actualizarTotales();
        actualizarEstadoBotonDespacho();
        console.error('Error al actualizar el acumulado de bolsones:', error);
        mostrarError('El bolsón se verificó, pero no se pudo agregar a la lista');
        return false;
    }

    actualizarEstadoBotonDespacho();

    return true;
}

/**
 * Procesar código del bolsón
 */
function procesarCodigoBolson(codigo) {
    if (!ordenActual || !ordenActual.id) {
        mostrarError('Error: No hay orden cargada');
        return;
    }

    const codigoEscaneado = String(codigo).trim();
    const bolsonesHash = obtenerBolsonesHashOrden();

    // Verificar duplicados en el acumulado local de la orden
    if (bolsonesHash[codigoEscaneado] || bolsonesEscaneados.some(b => obtenerCodigoBolson(b) === codigoEscaneado)) {
        mostrarError(`El bolsón ${codigoEscaneado} ya fue agregado en esta sesión`);
        return;
    }

    const token = localStorage.getItem('auth_token');

    fetch(`https://deb.regomax.com/api/despachos/verificar-bolson/${encodeURIComponent(codigoEscaneado)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
    })
    .then(response => {
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login.html?error=sesion_expirada';
            return null;
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;

        if (!data.success) {
            mostrarError(`Error: ${data.message || 'Error al verificar bolsón'}`);
            return;
        }

        if (data.data?.despachado) {
            mostrarError(`El bolsón ${codigoEscaneado} ya fue despachado anteriormente`);
            bolsonesHash[codigoEscaneado] = true;
            return;
        }

        const bolson = data.data?.bolson;

        if (!bolson) {
            mostrarError('La verificación no devolvió datos del bolsón');
            return;
        }

        const productoEnOrden = detallesOrden.find(p => p.producto === bolson.producto);

        if (!productoEnOrden) {
            mostrarError(`El producto "${bolson.producto}" no está en la orden seleccionada`);
            return;
        }

        agregarBolsonAlAcumulado(bolson, codigoEscaneado);
    })
    .catch(error => {
        console.error('Error:', error);
        mostrarError('Error de conexión al verificar el bolsón');
    })
    .finally(() => {
        const input = document.getElementById('codigoBolson');
        input.value = '';
        input.focus();
    });
}

/**
 * Actualizar tabla de bolsones
 */
function actualizarTablaBolsones() {
    const tbody = document.getElementById('tablaBolsones');
    const tablaTotales = document.getElementById('tablaTotales');

    tbody.innerHTML = '';

    if (bolsonesEscaneados.length > 0) {
        tablaTotales.classList.remove('d-none');

        bolsonesEscaneados.forEach((bolson, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${bolson.codigo}</strong></td>
                <td>${bolson.producto}</td>
                <td>${parseFloat(bolson.peso).toFixed(2)} kg</td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="eliminarBolson(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('contadorBolsones').textContent = bolsonesEscaneados.length;
    } else {
        const filaVacia = document.createElement('tr');
        filaVacia.id = 'filaVacia';
        filaVacia.innerHTML = `
            <td colspan="5" class="empty-state" style="padding: 2rem 0;">
                <i class="bi bi-inbox"></i>
                <p class="mt-2 mb-0">No hay bolsones escaneados</p>
            </td>
        `;
        tbody.appendChild(filaVacia);
        tablaTotales.classList.add('d-none');
        document.getElementById('contadorBolsones').textContent = '0';
    }
}

/**
 * Eliminar un bolsón
 */
function eliminarBolson(index) {
    const codigoBolson = obtenerCodigoBolson(bolsonesEscaneados[index]);
    const codigoEscaneado = bolsonesEscaneados[index].codigoEscaneado;
    bolsonesEscaneados.splice(index, 1);
    if (ordenActual && bolsonesEscaneadosPorOrden[ordenActual.id]) {
        delete bolsonesEscaneadosPorOrden[ordenActual.id][codigoBolson];
        if (codigoEscaneado) {
            delete bolsonesEscaneadosPorOrden[ordenActual.id][codigoEscaneado];
        }
    }

    actualizarTablaBolsones();
    actualizarTotales();
    actualizarEstadoBotonDespacho();
}

/**
 * Actualizar totales
 */
function actualizarTotales() {
    totalPeso = bolsonesEscaneados.reduce((sum, bolson) => sum + parseFloat(bolson.peso || 0), 0);
    document.getElementById('pesoTotal').textContent = `${totalPeso.toFixed(2)} kg`;
}

/**
 * Procesar despacho
 */
function procesarDespacho() {
    if (!ordenActual || !ordenActual.id) {
        mostrarError('Error: No hay orden cargada');
        return;
    }

    if (bolsonesEscaneados.length === 0) {
        mostrarError('Debe escanear al menos un bolsón');
        return;
    }

    // Agrupar por producto
    const productosTotales = {};
    bolsonesEscaneados.forEach(bolson => {
        if (!productosTotales[bolson.producto]) {
            productosTotales[bolson.producto] = {
                producto: bolson.producto,
                cantidad: 0,
                bolsones: []
            };
        }
        productosTotales[bolson.producto].cantidad += parseFloat(bolson.peso || 0);
        productosTotales[bolson.producto].bolsones.push(bolson.codigo);
    });

    // Crear resumen
    let resumenHTML = `
        <h6>Resumen del Despacho</h6>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Cantidad en Orden</th>
                    <th>Cantidad a Despachar</th>
                    <th>Cantidad Restante</th>
                </tr>
            </thead>
            <tbody>
    `;

    let puedeDespachar = true;

    for (const [producto, totales] of Object.entries(productosTotales)) {
        const productoOrden = detallesOrden.find(p => p.producto === producto);

        if (!productoOrden) {
            puedeDespachar = false;
            continue;
        }

        const cantidadOrden = parseFloat(productoOrden.cantidad);
        const cantidadDespachar = parseFloat(totales.cantidad);
        const cantidadRestante = Math.max(0, cantidadOrden - cantidadDespachar);

        const alertClass = cantidadDespachar > cantidadOrden ? 'table-danger' : '';

        resumenHTML += `
            <tr class="${alertClass}">
                <td>${producto}</td>
                <td>${cantidadOrden.toFixed(2)} kg</td>
                <td>${cantidadDespachar.toFixed(2)} kg</td>
                <td>${cantidadRestante.toFixed(2)} kg</td>
            </tr>
        `;

        if (cantidadDespachar > cantidadOrden) {
            resumenHTML += `
                <tr class="table-warning">
                    <td colspan="4" class="text-center">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>
                        <small>Despachando más de lo solicitado</small>
                    </td>
                </tr>
            `;
        }
    }

    resumenHTML += `
            </tbody>
        </table>
        <div class="mt-2">
            <strong>Total Bolsones:</strong> ${bolsonesEscaneados.length}<br>
            <strong>Peso Total:</strong> ${totalPeso.toFixed(2)} kg
        </div>
    `;

    document.getElementById('resumenDespacho').innerHTML = resumenHTML;
    window.confirmarModal.show();
}

/**
 * Confirmar despacho
 */
async function confirmarDespacho() {
    const btnConfirmar = document.getElementById('btnConfirmarDespacho');
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="spinner-border spinner-border-sm me-2"></i>Procesando...';

    try {
        const token = localStorage.getItem('auth_token');
        const despachoData = {
            ordenVentaId: ordenActual.id,
            codigos: bolsonesEscaneados.map(b => b.codigo)
        };

        const response = await fetch('https://deb.regomax.com/api/despachos/nuevo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(despachoData)
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login.html?error=sesion_expirada';
            return;
        }

        const data = await response.json();

        if (data.success) {
            window.confirmarModal.hide();

            const detalleHTML = `
                <div class="alert alert-success">
                    <ul class="mb-0">
                        <li>Bolsones despachados: ${data.data.bolsonesDespachados}</li>
                        ${data.data.ordenCompleta ? '<li>La orden ha sido completada</li>' : ''}
                    </ul>
                </div>
            `;

            document.getElementById('detalleExito').innerHTML = detalleHTML;
            window.exitoModal.show();

            // Limpiar
            bolsonesEscaneados = [];
            bolsonesEscaneadosPorOrden[ordenActual.id] = {};
            actualizarTablaBolsones();
            actualizarTotales();
            document.getElementById('codigoBolson').value = '';
        } else {
            mostrarError(data.message || 'Error al procesar despacho');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="bi bi-check2 me-2"></i>Confirmar Despacho';
    }
}

/**
 * Mostrar error
 */
function mostrarError(mensaje) {
    document.getElementById('errorMessage').textContent = mensaje;
    window.errorModal.show();
}

/**
 * Cerrar sesión
 */
function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

/**
 * Abre el modal del escáner QR/Código de barras para detalle-orden
 */
async function abrirEscanerQRDetalle() {
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

        const video = document.getElementById('scannerVideoDetalle');
        video.srcObject = scannerStream;
        
        // Esperar a que el video esté listo
        video.onloadedmetadata = () => {
            video.play().then(() => {
                iniciarEscaneoDetalle();
            }).catch(err => {
                console.error('Error al reproducir video:', err);
                document.getElementById('scannerStatusDetalle').innerHTML = `
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
        
        document.getElementById('scannerStatusDetalle').innerHTML = `
            <i class="bi bi-exclamation-circle me-2"></i>
            ${mensajeError}
        `;
    }
}

/**
 * Inicia el escaneo de códigos QR/Códigos de barras para detalle-orden
 */
function iniciarEscaneoDetalle() {
    const video = document.getElementById('scannerVideoDetalle');
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

                    procesarCodigoEscaneadoDetalle(scannedText);
                }
            }
        } catch (error) {
            // Errores normales durante el escaneo
        }
    }, 300); // Escanear cada 300ms
}

/**
 * Procesa el código escaneado en detalle-orden
 */
function procesarCodigoEscaneadoDetalle(codigo) {
    console.log('✅ Código detectado:', codigo);

    // Actualizar estado en el modal
    const statusEl = document.getElementById('scannerStatusDetalle');
    statusEl.className = 'scanner-status detected';
    statusEl.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>¡Código detectado!
    `;

    // Mostrar el código escaneado
    const displayEl = document.getElementById('scannedCodeDisplayDetalle');
    displayEl.innerHTML = `
        <div class="scanned-code">
            <strong>Código leído:</strong><br>
            <code>${codigo}</code>
        </div>
    `;

    // Cerrar el escáner
    cerrarEscanerDetalle();

    // Poner el código en el input y procesar
    document.getElementById('codigoBolson').value = codigo;
    procesarCodigoBolson(codigo);
}

/**
 * Cierra el escáner y detiene la cámara en detalle-orden
 */
function cerrarEscanerDetalle() {
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
    const video = document.getElementById('scannerVideoDetalle');
    if (video) {
        video.srcObject = null;
    }

    // Limpiar la notificación
    document.getElementById('scannedCodeDisplayDetalle').innerHTML = '';
    document.getElementById('scannerStatusDetalle').className = 'scanner-status scanning';
    document.getElementById('scannerStatusDetalle').innerHTML = `
        <i class="bi bi-hourglass-split me-2"></i>Escaneando...
    `;
}
