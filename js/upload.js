// upload.js - Gestión de subida de partidos y datos tácticos para MisterAI

/**
 * Configuración del Bucket de Supabase.
 * Asegúrate de crear un bucket público o privado llamado 'partidos' en la sección de Storage de tu panel de Supabase.
 */
const BUCKET_NAME = 'partidos';

/**
 * Inicializa los eventos de la zona de arrastrar y soltar (Drag & Drop)
 * @param {string} dropZoneId - ID del elemento HTML que servirá de zona de soltar
 * @param {string} fileInputId - ID del input de tipo file oculto
 */
function initDragAndDrop(dropZoneId, fileInputId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);

    if (!dropZone || !fileInput) return;

    // Prevenir comportamiento por defecto del navegador al arrastrar archivos
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => e.preventDefault(), false);
        document.body.addEventListener(eventName, e => e.preventDefault(), false);
    });

    // Efecto visual al pasar el archivo sobre la zona
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('border-emerald-400', 'bg-emerald-500/5');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('border-emerald-400', 'bg-emerald-500/5');
        }, false);
    });

    // Capturar el archivo cuando se suelta
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleMatchFile(files[0]);
        }
    });

    // Capturar el archivo si se selecciona mediante el explorador clásico
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMatchFile(e.target.files[0]);
        }
    });
}

/**
 * Valida el archivo seleccionado antes de iniciar la subida
 * @param {File} file 
 */
function handleMatchFile(file) {
    // Validar extensiones permitidas (Vídeos mp4, mov o archivos de datos como csv/json)
    const allowedExtensions = ['mp4', 'mov', 'avi', 'csv', 'json'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
        alert('❌ Archivo no válido. Sube un vídeo del partido (.mp4, .mov) o un set de datos tácticos.');
        return;
    }

    // Mostrar interfaz de carga (Si tienes una barra de progreso en tu HTML)
    updateUploadUI('ready', file.name);
}

/**
 * Sube el archivo a Supabase Storage y lo registra en la base de datos
 * @param {string} fileInputId - ID del input file que contiene el archivo
 * @param {string} matchName - Nombre descriptivo del partido (Ej: "Jerez CD vs Cádiz B")
 */
async function uploadMatch(fileInputId, matchName) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || fileInput.files.length === 0) {
        alert('⚠️ Por favor, selecciona o arrastra un archivo de partido primero.');
        return;
    }

    const file = fileInput.files[0];
    
    // Validar que el usuario esté autenticado (utiliza el cliente de auth.js)
    if (!supabase) {
        alert('⚠️ Error de conexión con el servidor.');
        return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('⚠️ Debes iniciar sesión para subir contenido al vestuario.');
        window.location.href = 'login.html';
        return;
    }

    // Crear un nombre de archivo único para evitar colisiones en el Storage
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

    try {
        updateUploadUI('uploading', 0);

        // 1. Subir archivo al Storage de Supabase
        // Nota: El SDK de Supabase v2 maneja la subida de archivos grandes automáticamente.
        const { data: storageData, error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueFileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) throw storageError;

        // Obtener la URL pública del archivo subido
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uniqueFileName);

        // 2. Registrar el partido en tu tabla de la base de datos ('partidos' o 'matches')
        // Esto despertará a tu backend o pipeline de IA (YOLO) para procesar el análisis táctico.
        const { data: dbData, error: dbError } = await supabase
            .from('partidos')
            .insert([
                {
                    user_id: user.id,
                    nombre: matchName || `Partido ${new Date().toLocaleDateString()}`,
                    file_path: uniqueFileName,
                    file_url: publicUrl,
                    estado_analisis: 'pendiente', // 'pendiente', 'procesando', 'completado'
                    tipo_archivo: fileExtension
                }
            ])
            .select();

        if (dbError) throw dbError;

        updateUploadUI('success', file.name);
        console.log('Partido registrado con éxito para análisis:', dbData);
        
        // Redirigir o refrescar el panel después de 2 segundos
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Error durante el proceso de subida:', error.message);
        updateUploadUI('error', error.message);
        alert(`Error al procesar el partido: ${error.message}`);
    }
}

/**
 * Función auxiliar para actualizar los textos y barras de progreso en el HTML
 * Modifica esto según las clases y componentes que uses en tu frontend.
 */
function updateUploadUI(status, payload) {
    const statusText = document.getElementById('upload-status-text');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressContainer = document.getElementById('upload-progress-container');

    if (!statusText) return;

    switch (status) {
        case 'ready':
            statusText.innerText = `⚽ Archivo cargado: ${payload}. Listo para entrar al vestuario.`;
            if (progressContainer) progressContainer.classList.add('hidden');
            break;
        case 'uploading':
            statusText.innerText = `⏳ Subiendo partido al servidor táctico... Por favor, no cierres la pestaña.`;
            if (progressContainer) progressContainer.classList.remove('hidden');
            if (progressBar) progressBar.style.width = `50%`; // Estado indeterminado simulado en carga directa simple
            break;
        case 'success':
            statusText.innerText = `✅ ¡Subida completada con éxito! Enviando a la pizarra de MisterAI...`;
            if (progressBar) {
                progressBar.style.width = `100%`;
                progressBar.classList.remove('bg-emerald-500');
                progressBar.classList.add('bg-blue-500');
            }
            break;
        case 'error':
            statusText.innerText = `❌ Error en la subida: ${payload}`;
            if (progressBar) {
                progressBar.classList.remove('bg-emerald-500');
                progressBar.classList.add('bg-red-500');
            }
            break;
    }
}