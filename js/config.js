// config.js - Configuración PÚBLICA del frontend de MisterAI.
// Aquí NUNCA van claves secretas (service_role, Stripe secret, etc.).
// La anon key de Supabase es pública por diseño: la protegen las políticas RLS.

const MISTERAI_CONFIG = {
    SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
    SUPABASE_ANON_KEY: 'TU-ANON-KEY',
    API_URL: '',            // URL del backend FastAPI en Render. Vacío mientras no exista.
    BUCKET: 'partidos',     // Bucket PRIVADO de Supabase Storage
    MAX_FILE_GB: 4          // Tamaño máximo aceptado en el navegador
};

const CONFIG_OK = !MISTERAI_CONFIG.SUPABASE_URL.includes('TU-PROYECTO');

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
