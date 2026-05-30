// Estado global
let ordenActual = null;
let detallesOrden = [];
let bolsonesEscaneados = [];
let totalPeso = 0;
let bolsonesEscaneadosPorOrden = {};
let scannerStream = null;
let scannerInterval = null;
let html5QRScanner = null; // Scanner instance from html5-qrcode
let lastScannedCode = null; // Último código escaneado
let lastScannedTime = 0; // Timestamp del último escaneo

/**
 * Reproduce un sonido de beep cuando se detecta un código
 */
function beep() {
    try {
        const ctx = new(window.AudioContext || window.webkitAudioContext)();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 1000;

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            ctx.currentTime + 0.15
        );

        osc.start();
        osc.stop(ctx.currentTime + 0.15);

    } catch(e) {
        console.error('Error al reproducir beep:', e);
    }
}

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
        // Limpiar el input pero NO hacer la petición al backend
        const input = document.getElementById('codigoBolson');
        input.value = '';
        input.focus();
        return; // IMPORTANTE: Retornar aquí para NO hacer la petición
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
            mostrarError(`Error: ${data.message || 'Bolson no valido o fuera de stock'}`);
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
                <td style="text-align: center;">
                    <button type="button" class="btn btn-sm btn-danger" onclick="eliminarBolson(${index})" style="padding: 0.5rem 0.75rem;">
                        <i class="bi bi-trash" style="font-size: 1.1rem;"></i>
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
 * Mostrar notificación de error flotante
 */
function mostrarError(mensaje) {
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = 'floating-notification';
    notificacion.innerHTML = `
        <i class="bi bi-exclamation-circle-fill"></i>
        <span class="floating-notification-message">${mensaje}</span>
    `;
    
    // Agregar al body
    document.body.appendChild(notificacion);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notificacion.classList.add('fadeOut');
        setTimeout(() => {
            notificacion.remove();
        }, 300); // Esperar a que termine la animación
    }, 3000);
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
    // Limpiar cualquier instancia anterior del scanner
    if (html5QRScanner) {
        try {
            await html5QRScanner.stop();
        } catch (err) {
            console.log('El scanner ya estaba detenido');
        }
        html5QRScanner = null;
    }

    const modal = new bootstrap.Modal(document.getElementById('scannerModal'));
    modal.show();

    try {
        // Verificar si el navegador soporta html5-qrcode
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('html5-qrcode library not loaded');
        }

        // Limpiar el elemento reader
        const readerElement = document.getElementById('reader');
        if (readerElement) {
            readerElement.innerHTML = '';
        }

        // Esperar un poco para asegurar que el elemento está limpio
        await new Promise(resolve => setTimeout(resolve, 300));

        // Inicializar el scanner
        html5QRScanner = new Html5Qrcode("reader");

        // Configurar los formatos soportados
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
        ];

        // Iniciar el escaneo
        await html5QRScanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 300, height: 200 },
                formatsToSupport: formatsToSupport
            },
            onScanSuccessDetalle,
            onScanErrorDetalle
        );

        // Actualizar estado
        document.getElementById('scannerStatusDetalle').className = 'scanner-status scanning';
        document.getElementById('scannerStatusDetalle').innerHTML = `
            <i class="bi bi-hourglass-split me-2"></i>Escaneando...
        `;

    } catch (error) {
        console.error('Error al abrir el escáner:', error);
        
        let mensajeError = 'Error: No se pudo abrir el escáner.';
        
        if (error.name === 'NotAllowedError') {
            mensajeError = '❌ Permiso denegado. Por favor, permite el acceso a la cámara.';
        } else if (error.name === 'NotFoundError') {
            mensajeError = '❌ No se encontró cámara en el dispositivo.';
        } else if (error.name === 'NotReadableError') {
            mensajeError = '❌ La cámara está siendo usada por otra aplicación.';
        }
        
        document.getElementById('scannerStatusDetalle').className = 'scanner-status';
        document.getElementById('scannerStatusDetalle').innerHTML = `
            <i class="bi bi-exclamation-circle me-2"></i>
            ${mensajeError}
        `;
    }
}

/**
 * Callback cuando se detecta un código en el escáner de detalle-orden
 */
function onScanSuccessDetalle(decodedText, decodedResult) {
    console.log('✅ Código detectado:', decodedText);
    
    // Evitar escanear el mismo código dos veces muy rápido
    // Esperar 1.5 segundos antes de procesar el mismo código
    const currentTime = Date.now();
    const timeSinceLastScan = currentTime - lastScannedTime;
    
    if (decodedText === lastScannedCode && timeSinceLastScan < 1500) {
        console.log('⏱️ Mismo código detectado muy rápido, ignorando...');
        return;
    }
    
    // Actualizar el último código y tiempo escaneados
    lastScannedCode = decodedText;
    lastScannedTime = currentTime;
    
    procesarCodigoEscaneadoDetalle(decodedText);
}

/**
 * Callback para errores del escáner de detalle-orden
 */
function onScanErrorDetalle(error) {
    // Los errores de no detección son normales, no los mostramos
    // Solo errores graves se mostrarían aquí
}

/**
 * Procesa el código escaneado en detalle-orden
 */
function procesarCodigoEscaneadoDetalle(codigo) {
    console.log('✅ Código detectado:', codigo);

    const codigoEscaneado = String(codigo).trim();
    const bolsonesHash = obtenerBolsonesHashOrden();

    // Verificar si el código ya está en la lista (duplicado)
    const esCodigoDuplicado = bolsonesHash[codigoEscaneado] || bolsonesEscaneados.some(b => obtenerCodigoBolson(b) === codigoEscaneado);

    // Solo hacer beep si es un código nuevo (no duplicado)
    if (!esCodigoDuplicado) {
        beep();
    }

    // Poner el código en el input
    document.getElementById('codigoBolson').value = codigo;
    
    // Procesar el código (esto agregará el bolsón)
    procesarCodigoBolson(codigo);

    // Mostrar confirmación temporal (el código fue procesado)
    const displayEl = document.getElementById('scannedCodeDisplayDetalle');
    
    if (esCodigoDuplicado) {
        // Mostrar advertencia si es duplicado
        displayEl.innerHTML = `
            <div class="scanned-code" style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <i class="bi bi-exclamation-triangle me-2"></i><strong>⚠️ ${codigo}</strong> ya fue agregado<br>
                <small>Escanea otro código...</small>
            </div>
        `;
    } else {
        // Mostrar confirmación verde si es nuevo
        displayEl.innerHTML = `
            <div class="scanned-code" style="background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <i class="bi bi-check-circle me-2"></i><strong>✅ ${codigo}</strong> agregado<br>
                <small>Escanea otro código...</small>
            </div>
        `;
    }

    // Limpiar el input para el siguiente código
    setTimeout(() => {
        document.getElementById('codigoBolson').value = '';
        // Limpiar el mensaje de confirmación después de 3 segundos
        displayEl.innerHTML = '';
    }, 3000);
    
    // El scanner sigue activo para continuar escaneando
}

/**
 * Cierra el escáner y detiene la cámara en detalle-orden
 */
function cerrarEscanerDetalle() {
    // Resetear variables de control de duplicados
    lastScannedCode = null;
    lastScannedTime = 0;
    
    // Detener el scanner de html5-qrcode
    if (html5QRScanner) {
        html5QRScanner.stop().then(() => {
            html5QRScanner = null;
            // Limpiar el elemento reader
            const readerElement = document.getElementById('reader');
            if (readerElement) {
                readerElement.innerHTML = '';
            }
        }).catch(err => {
            console.error('Error al detener el scanner:', err);
            html5QRScanner = null;
            // Limpiar el elemento reader incluso si hay error
            const readerElement = document.getElementById('reader');
            if (readerElement) {
                readerElement.innerHTML = '';
            }
        });
    }

    // Detener el intervalo de escaneo (por compatibilidad)
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }

    // Detener todos los tracks del stream de video (por compatibilidad)
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }
}
