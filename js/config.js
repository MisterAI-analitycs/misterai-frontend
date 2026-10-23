// config.js - Configuración PÚBLICA del frontend de MisterAI.
// Aquí NUNCA van claves secretas (service_role, Stripe secret, etc.).
// La anon key de Supabase es pública por diseño: la protegen las políticas RLS.

const MISTERAI_CONFIG = {
    SUPABASE_URL: 'https://wzrxnvaumnntombqqjnv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cnhudmF1bW5udG9tYnFxam52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjM1MTEsImV4cCI6MjA5ODMzOTUxMX0.HsbyBJbMzA7aH9dfAFrz-FMCy9VgBz2rWvSAB8N0Hjs',
    API_URL: '',            // URL del backend FastAPI en Render. Vacío mientras no exista.
    // Los vídeos NO van a Supabase: irán a Cloudflare R2 mediante URLs firmadas del backend.
    MAX_FILE_GB: 6          // Tamaño máximo aceptado en el navegador (1080p, 90 min: 3,5-6 GB)
};

const CONFIG_OK = !MISTERAI_CONFIG.SUPABASE_URL.includes('TU-PROYECTO') && !MISTERAI_CONFIG.SUPABASE_ANON_KEY.includes('TU-ANON');

// Cliente único de Supabase, compartido por auth.js, upload.js y dashboard.js
const sb = (window.supabase && CONFIG_OK)
    ? window.supabase.createClient(MISTERAI_CONFIG.SUPABASE_URL, MISTERAI_CONFIG.SUPABASE_ANON_KEY)
    : null;

if (!window.supabase) {
    console.error('No se cargó el SDK de Supabase. Incluye el CDN antes de config.js.');
} else if (!CONFIG_OK) {
    console.warn('MisterAI: falta configurar js/config.js con los datos de tu proyecto Supabase.');
}

// Utilidad: URL absoluta de una página hermana (funciona también en GitHub Pages con subruta)
function pageUrl(name) {
    return new URL(name, window.location.href).href;
}
