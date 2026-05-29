const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();

// Middleware para agregar headers de permisos de cámara
app.use((req, res, next) => {
    // Permitir acceso a cámara en iOS y otros navegadores
    res.setHeader('Permissions-Policy', 'camera=*, microphone=*');
    // Headers adicionales para cámara
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

app.use(express.static('public'));

// Si entran a la raíz y no hay un index.html, redirigimos al login.
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

const PORT = process.env.PORT || 3000;

// Escuchar en 0.0.0.0 evita problemas en algunos entornos donde "localhost" no enruta bien.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor iniciado en http://localhost:${PORT}`);
    console.log(`📱 Para acceder desde otro dispositivo, usa: http://<tu-ip>:${PORT}`);
    console.log(`📱 Para iOS, necesitas HTTPS. Usa un proxy SSL o ngrok para producción.`);
});