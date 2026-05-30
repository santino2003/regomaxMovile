/**
 * Función optimizada para escanear QR y Códigos de Barras
 * Usa jsQR para QR y Quagga para códigos de barras
 */
function iniciarEscaneoDetalle() {
    const video = document.getElementById('scannerVideoDetalle');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('scannerStatusDetalle');

    let lastCode = null;
    let lastTime = 0;
    let frameCount = 0;

    scannerInterval = setInterval(() => {
        if (!video?.srcObject || !scannerStream) {
            clearInterval(scannerInterval);
            return;
        }

        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Intenta QR primero (jsQR) - más rápido
            let code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            let tipoDetectado = 'QR';
            
            if (!code) {
                // Si no hay QR, intenta código de barras (Quagga)
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    Quagga.decodeSingle({
                        src: dataUrl,
                        numOfWorkers: 0,
                        inputStream: { type: 'ImageFile' },
                        decoder: { readers: ['code_128_reader', 'ean_reader', 'code_39_reader', 'upc_reader'] }
                    }, (result) => {
                        if (result && result.codeResult) {
                            code = { data: result.codeResult.code };
                            tipoDetectado = 'Código de Barras';
                        }
                    });
                } catch (e) {
                    // Sin código detectado
                }
            }

            if (code?.data) {
                if (code.data !== lastCode || Date.now() - lastTime > 1500) {
                    lastCode = code.data;
                    lastTime = Date.now();
                    
                    // Mostrar feedback visual
                    statusEl.className = 'scanner-status detected';
                    statusEl.innerHTML = `
                        <i class="bi bi-check-circle me-2"></i>
                        ✅ ${tipoDetectado} detectado: <strong>${code.data}</strong>
                    `;
                    
                    // Reproducir sonido
                    reproducirSonidoExito();
                    
                    // Procesar después de un pequeño delay
                    setTimeout(() => procesarCodigoEscaneadoDetalle(code.data), 300);
                }
            } else {
                // Mostrar feedback cada 10 frames
                frameCount++;
                if (frameCount % 10 === 0) {
                    statusEl.innerHTML = `
                        <i class="bi bi-hourglass-split me-2"></i>
                        Buscando... apunta el código hacia la cámara
                    `;
                }
            }
        } catch (e) {
            // Error normal de escaneo
        }
    }, 150);
}

/**
 * Reproducer sonido de éxito cuando detecta código
 */
function reproducirSonidoExito() {
    // Crear un sonido simple con Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Si falla el audio, no importa
    }
}
