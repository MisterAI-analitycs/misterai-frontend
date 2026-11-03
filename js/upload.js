// upload.js - Subida de partidos para MisterAI
// Requiere cargar antes: supabase-js (CDN), js/config.js y js/auth.js
//
// Flujo: huella rápida -> el backend abre una subida multipart en Cloudflare R2 y firma
// una URL por trozo -> el navegador sube los trozos directamente a R2 -> el backend cierra
// la subida y registra el partido como 'pendiente'. El navegador ya no escribe en la base de datos.

const ALLOWED_VIDEO_EXT = ['mp4', 'mov', 'm4v'];
const PARALLEL_PARTS = 3;   // trozos subiéndose a la vez
const PART_RETRIES = 3;     // reintentos por trozo

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
 * esta huella detecta duplicados exactos al instante.
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

/** Llamada al backend con la sesión del usuario. */
async function apiPost(path, token, body) {
    let res;
    try {
        res = await fetch(`${MISTERAI_CONFIG.API_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });
    } catch (e) {
        throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo en unos segundos.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Error del servidor (${res.status})`);
    return data;
}

/** Sube un trozo a su URL firmada y devuelve su ETag. Usa XHR para medir el progreso. */
function putPart(url, blob, onBytes) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.upload.onprogress = (e) => onBytes(e.loaded);
        xhr.onload = () => {
            const etag = xhr.getResponseHeader('ETag');
            if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
            else reject(new Error(`Fallo al subir un trozo (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Fallo de red al subir un trozo'));
        xhr.send(blob);
    });
}

/** Sube todos los trozos con reintentos y pequeña concurrencia. Devuelve [{PartNumber, ETag}]. */
async function uploadParts(file, init, onProgress) {
    const total = file.size;
    const loaded = new Array(init.parts.length).fill(0);
    const results = [];
    const report = () => onProgress && onProgress(Math.min(99, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100)));
    let next = 0;

    async function worker() {
        while (next < init.parts.length) {
            const idx = next++;
            const part = init.parts[idx];
            const start = idx * init.part_size;
            const blob = file.slice(start, Math.min(start + init.part_size, total));
            let lastError;
            for (let attempt = 0; attempt <= PART_RETRIES; attempt++) {
                try {
                    const etag = await putPart(part.url, blob, (b) => { loaded[idx] = b; report(); });
                    loaded[idx] = blob.size;
                    report();
                    results.push({ PartNumber: part.part_number, ETag: etag });
                    lastError = null;
                    break;
                } catch (e) {
                    lastError = e;
                    loaded[idx] = 0;
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
            if (lastError) throw lastError;
        }
    }

    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, init.parts.length) }, worker));
    return results;
}

/**
 * Sube un partido y lo registra para su análisis.
 * @param {File} file
 * @param {{nombre?: string, modalidad?: string, onProgress?: function(number)}} opts
 * @returns {Promise<{partido: object, duplicado: boolean}>}
 */
async function uploadMatch(file, opts = {}) {
    if (!sb) throw new Error('El servicio aún no está configurado.');
    if (!MISTERAI_CONFIG.API_URL) throw new Error('Falta configurar la dirección del servidor.');

    const problem = validateMatchFile(file);
    if (problem) throw new Error(problem);

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = pageUrl('login.html');
        throw new Error('Debes iniciar sesión para subir un partido.');
    }
    const token = session.access_token;

    const huella = await quickFingerprint(file);

    // El primer aviso tras un rato sin uso puede tardar: el servidor gratuito se está despertando.
    const init = await apiPost('/api/upload/init', token, {
        filename: file.name,
        size: file.size,
        content_type: file.type || 'video/mp4',
        huella
    });
    if (init.duplicado) return { partido: init.partido, duplicado: true };

    let parts;
    try {
        parts = await uploadParts(file, init, opts.onProgress);
    } catch (e) {
        // Liberamos los trozos ya subidos; si esto falla, la regla de R2 los borra al día siguiente.
        apiPost('/api/upload/abort', token, { key: init.key, upload_id: init.upload_id }).catch(() => {});
        throw e;
    }

    const done = await apiPost('/api/upload/complete', token, {
        key: init.key,
        upload_id: init.upload_id,
        parts,
        nombre: (opts.nombre || '').trim() || `Partido ${new Date().toLocaleDateString('es-ES')}`,
        modalidad: opts.modalidad || 'Fútbol 11',
        huella
    });
    if (opts.onProgress) opts.onProgress(100);
    return { partido: done.partido, duplicado: false };
}
