// upload.js - Subida de partidos para MisterAI
// Requiere cargar antes: supabase-js (CDN), js/config.js y js/auth.js
//
// Flujo: huella rápida -> subida a R2 -> fila en 'partidos'
// -> aviso opcional al backend. Toda la lógica de almacenamiento está en uploadVideoResumable():
// si más adelante el vídeo pasa a otro proveedor (R2, Modal...), solo se toca esa función.

const ALLOWED_VIDEO_EXT = ['mp4', 'mov', 'm4v'];

/** Valida extensión y tamaño. Devuelve un mensaje de error o null si todo está bien. */
function validateMatchFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_VIDEO_EXT.includes(ext)) {
        return 'Archivo no válido. Sube un vídeo del partido (.mp4, .mov o .m4v).';
    }
    const maxBytes = MISTERAI_CONFIG.MAX_FILE_GB * 1024 * 1024 * 1024;
    if (file.size > maxBytes) {
        return `El vídeo supera el máximo de ${MISTERAI_CONFIG.MAX_FILE_GB} GB.`;
    }
    return null;
}

/**
 * Huella rápida del vídeo: SHA-256 de tamaño + 3 fragmentos (inicio, mitad, final).
 * Calcular el SHA-256 completo de 2-3 GB en el navegador no es viable en móviles;
 * esta huella detecta duplicados exactos al instante. El backend puede calcular
 * después el hash completo si quiere una verificación definitiva.
 */
async function quickFingerprint(file) {
    const SLICE = 4 * 1024 * 1024;
    const starts = [0, Math.max(0, Math.floor(file.size / 2) - SLICE / 2), Math.max(0, file.size - SLICE)];
    const parts = [new TextEncoder().encode(String(file.size))];
    for (const s of starts) {
        parts.push(new Uint8Array(await file.slice(s, s + SLICE).arrayBuffer()));
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) { buf.set(p, offset); offset += p.length; }
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * TEMPORAL: la subida a Cloudflare R2 se implementará cuando exista el backend
 * (que generará las URLs firmadas). Mientras tanto, falla con un mensaje claro.
 */
function uploadVideoResumable(file, objectName, accessToken, onProgress) {
    return Promise.reject(new Error('La subida de vídeos aún no está activada (pendiente de conectar con R2).'));
}

/**
 * Sube un partido y lo registra para su análisis.
 * @param {File} file
 * @param {{nombre?: string, modalidad?: string, onProgress?: function(number)}} opts
 * @returns {Promise<{partido: object, duplicado: boolean}>}
 */
async function uploadMatch(file, opts = {}) {
    if (!sb) throw new Error('El servicio aún no está configurado.');

    const problem = validateMatchFile(file);
    if (problem) throw new Error(problem);

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = pageUrl('login.html');
        throw new Error('Debes iniciar sesión para subir un partido.');
    }
    const user = session.user;

    const huella = await quickFingerprint(file);

    // ¿Ya subiste este mismo vídeo? Evitamos subirlo (y analizarlo) dos veces.
    const { data: existente } = await sb
        .from('partidos')
        .select('*')
        .eq('user_id', user.id)
        .eq('huella', huella)
        .maybeSingle();
    if (existente) return { partido: existente, duplicado: true };

    const ext = file.name.split('.').pop().toLowerCase();
    const objectName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await uploadVideoResumable(file, objectName, session.access_token, opts.onProgress);

    const { data: partido, error } = await sb
        .from('partidos')
        .insert({
            user_id: user.id,
            nombre: (opts.nombre || '').trim() || `Partido ${new Date().toLocaleDateString('es-ES')}`,
            modalidad: opts.modalidad || 'Fútbol 11',
            file_path: objectName,
            huella,
            tamano_bytes: file.size,
            estado_analisis: 'pendiente'
        })
        .select()
        .single();
    if (error) throw error;

    // Aviso al backend (Render). Si falla no es grave: la fila queda en 'pendiente'
    // y el backend puede recogerla igualmente.
    if (MISTERAI_CONFIG.API_URL) {
        try {
            await fetch(`${MISTERAI_CONFIG.API_URL}/api/partido-subido`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ partido_id: partido.id })
            });
        } catch (e) {
            console.warn('No se pudo avisar al backend; el partido queda pendiente.', e);
        }
    }

    return { partido, duplicado: false };
}
