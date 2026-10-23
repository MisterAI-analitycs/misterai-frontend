// dashboard.js - Panel del entrenador: subida de partidos y listado del historial
// Requiere cargar antes: supabase-js, tus-js-client, js/config.js, js/auth.js y js/upload.js

const $ = (id) => document.getElementById(id);

const els = {
    dropZone: $('drop-zone'),
    fileInput: $('file-input'),
    details: $('upload-details'),
    filename: $('original-filename'),
    fileSize: $('file-size'),
    matchName: $('match-name'),
    matchType: $('match-type'),
    submit: $('btn-submit-analysis'),
    progressBox: $('upload-progress'),
    progressBar: $('upload-progress-bar'),
    progressText: $('upload-progress-text'),
    matches: $('matches-container'),
    userBadge: $('user-badge'),
    logout: $('btn-logout')
};

let pollTimer = null;

/** Escapa texto de usuario antes de meterlo en innerHTML (evita inyección de HTML/JS). */
function esc(text) {
    const d = document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
}

const STATUS_UI = {
    pendiente:  { label: 'En cola',     cls: 'text-slate-400', icon: 'fa-hourglass-half', spin: false },
    procesando: { label: 'Procesando',  cls: 'text-amber-400', icon: 'fa-spinner',        spin: true  },
    completado: { label: 'Completado',  cls: 'text-emerald-400', icon: 'fa-circle-check', spin: false },
    error:      { label: 'Error',       cls: 'text-rose-400',  icon: 'fa-triangle-exclamation', spin: false }
};

function matchCard(m) {
    const st = STATUS_UI[m.estado_analisis] || STATUS_UI.pendiente;
    const done = m.estado_analisis === 'completado';
    const date = new Date(m.created_at).toLocaleDateString('es-ES');
    const tag = done ? 'a' : 'div';
    const href = done ? ` href="analizar.html?id=${encodeURIComponent(m.id)}"` : '';
    return `
        <${tag}${href} class="flex items-center justify-between p-4 bg-slate-900/20 ${done ? 'hover:bg-slate-900/60 cursor-pointer' : ''} border border-slate-900 rounded-xl transition group">
            <div class="flex items-center gap-4 min-w-0">
                <div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <i class="fa-solid fa-file-video"></i>
                </div>
                <div class="min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${esc(m.nombre)}</h4>
                    <span class="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span class="${st.cls} font-medium flex items-center gap-1">
                            <i class="fa-solid ${st.icon} ${st.spin ? 'animate-spin' : ''} text-[8px]"></i> ${st.label}
                        </span>
                        <span class="text-slate-700">&bull;</span>
                        <span>${esc(m.modalidad || 'Fútbol 11')}</span>
                        <span class="text-slate-700">&bull;</span>
                        <span>${date}</span>
                    </span>
                </div>
            </div>
            ${done ? '<i class="fa-solid fa-chevron-right text-xs text-slate-600 group-hover:text-white transition pl-2"></i>' : ''}
        </${tag}>`;
}

async function loadMatches() {
    if (!sb) {
        els.matches.innerHTML = '<p class="text-xs text-slate-500 p-4">Servicio sin configurar (js/config.js).</p>';
        return;
    }
    const { data, error } = await sb
        .from('partidos')
        .select('id, nombre, modalidad, estado_analisis, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        els.matches.innerHTML = `<p class="text-xs text-rose-400 p-4">No se pudo cargar el historial: ${esc(error.message)}</p>`;
        return;
    }
    if (!data.length) {
        els.matches.innerHTML = '<p class="text-xs text-slate-500 p-4">Aún no has analizado ningún partido. Sube el primero arriba.</p>';
    } else {
        els.matches.innerHTML = data.map(matchCard).join('');
    }

    // Mientras haya partidos en curso, refrescamos cada 15 s; si no, paramos.
    const enCurso = data.some(m => ['pendiente', 'procesando'].includes(m.estado_analisis));
    clearTimeout(pollTimer);
    if (enCurso) pollTimer = setTimeout(loadMatches, 15000);
}

function showProgress(pct, text) {
    els.progressBox.classList.remove('hidden');
    els.progressBar.style.width = `${pct}%`;
    els.progressText.textContent = text;
}

function setupFile() {
    const file = els.fileInput.files[0];
    if (!file) return;
    const problem = validateMatchFile(file);
    if (problem) {
        alert(problem);
        els.fileInput.value = '';
        return;
    }
    els.details.classList.remove('hidden');
    els.filename.textContent = file.name;
    els.fileSize.textContent = file.size >= 1024 ** 3
        ? (file.size / 1024 ** 3).toFixed(2) + ' GB'
        : (file.size / 1024 ** 2).toFixed(1) + ' MB';
    const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    els.matchName.value = base.replace(/[-_]/g, ' ');
    els.matchName.focus();
}

async function submitMatch() {
    const file = els.fileInput.files[0];
    if (!file) return;

    els.submit.disabled = true;
    els.submit.classList.add('opacity-60', 'cursor-not-allowed');
    showProgress(0, 'Preparando subida...');

    try {
        const { duplicado } = await uploadMatch(file, {
            nombre: els.matchName.value,
            modalidad: els.matchType.value,
            onProgress: (pct) => showProgress(pct, `Subiendo partido... ${pct}% (no cierres la pestaña)`)
        });
        showProgress(100, duplicado
            ? 'Este vídeo ya estaba subido. No se vuelve a procesar.'
            : 'Partido recibido. Te avisaremos cuando el análisis esté listo.');
        els.details.classList.add('hidden');
        els.fileInput.value = '';
        await loadMatches();
    } catch (err) {
        showProgress(0, `Error en la subida: ${err.message || err}`);
    } finally {
        els.submit.disabled = false;
        els.submit.classList.remove('opacity-60', 'cursor-not-allowed');
    }
}

function setupDragAndDrop() {
    ['dragenter', 'dragover'].forEach(ev => els.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        els.dropZone.classList.add('border-emerald-400', 'bg-emerald-500/10');
    }));
    ['dragleave', 'drop'].forEach(ev => els.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('border-emerald-400', 'bg-emerald-500/10');
    }));
    els.dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) {
            els.fileInput.files = e.dataTransfer.files;
            setupFile();
        }
    });
    els.fileInput.addEventListener('change', setupFile);
}

(async function init() {
    setupDragAndDrop();
    els.submit.addEventListener('click', submitMatch);
    if (els.logout) els.logout.addEventListener('click', logoutMister);

    const user = await protectRoute();
    if (user && els.userBadge) {
        const name = user.user_metadata?.display_name || user.email || 'Míster';
        els.userBadge.textContent = name.slice(0, 2).toUpperCase();
        els.userBadge.title = name;
    }
    await loadMatches();
})();
