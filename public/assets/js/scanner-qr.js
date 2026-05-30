/**
 * Función optimizada para escanear QR y Códigos de Barras
 * Usa jsQR para QR y ZXing para códigos de barras
 */
function iniciarEscaneoDetalle() {
    const video = document.getElementById('scannerVideoDetalle');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let lastCode = null;
    let lastTime = 0;

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
            
            // Intenta QR primero (jsQR)
            let code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            
            if (!code) {
                // Si no hay QR, intenta código de barras (ZXing)
                try {
                    const luminanceSource = new ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
                    const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
                    const reader = new ZXing.MultiFormatReader();
                    const result = reader.decode(binaryBitmap);
                    code = { data: result.getText() };
                } catch (e) {
                    // Sin código detectado
                }
            }

            if (code?.data) {
                if (code.data !== lastCode || Date.now() - lastTime > 1500) {
                    lastCode = code.data;
                    lastTime = Date.now();
                    procesarCodigoEscaneadoDetalle(code.data);
                }
            }
        } catch (e) {
            // Error normal de escaneo
        }
    }, 200);
}
