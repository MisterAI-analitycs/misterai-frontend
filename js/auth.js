// auth.js - Gestión de autenticación con Supabase para MisterAI

// 1. Inicialización de Supabase
// Reemplaza estos valores con las credenciales de tu proyecto en el dashboard de Supabase
const SUPABASE_URL = 'https://tu-proyecto-id.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-de-supabase-aqui';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabase) {
    console.error("⚠️ No se ha podido cargar el SDK de Supabase. Asegúrate de incluir el CDN en el HTML.");
}

/**
 * Iniciar sesión con email y contraseña (Entrar al Vestuario)
 * @param {string} email 
 * @param {string} password 
 */
async function loginMister(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // Login exitoso: Redirigir al panel táctico principal
        console.log('Sesión iniciada con éxito:', data.user);
        window.location.href = 'dashboard.html'; 
        return { success: true, data };
    } catch (error) {
        console.error('Error en el inicio de sesión:', error.message);
        alert(`Error de acceso: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Registrar un nuevo Míster con metadatos de perfil
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 */
async function registerMister(email, password, name) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    display_name: name, // Guarda el nombre del club/míster en la metadata del usuario
                }
            }
        });

        if (error) throw error;

        // Nota: Si tienes activada la confirmación por email en Supabase, el usuario tendrá que verificar su correo antes de loguearse.
        console.log('Registro completado:', data.user);
        alert('¡Cuenta creada! Revisa tu correo electrónico para confirmar tu cuenta antes de acceder.');
        return { success: true, data };
    } catch (error) {
        console.error('Error en el registro:', error.message);
        alert(`Error al crear la cuenta: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Autenticación externa mediante Google OAuth
 */
async function loginWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirige al usuario de vuelta a la página principal tras aceptar los permisos de Google
                redirectTo: window.location.origin + '/index.html',
            }
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error con Google Auth:', error.message);
        alert(`Error al conectar con Google: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Cerrar sesión (Vaciar el vestuario)
 */
async function logoutMister() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Redirigir al login tras cerrar sesión
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error.message);
    }
}

/**
 * Guardián de Ruta: Comprobar el estado de la sesión en tiempo real
 * Úsalo en el dashboard para echar a los usuarios que no estén logueados.
 */
function protectRoute() {
    if (!supabase) return;
    
    // Ejecutar comprobación inmediata
    const session = supabase.auth.session;
    if (!session && window.location.pathname !== '/login.html') {
        window.location.href = 'login.html';
    }

    // Escuchar cambios de estado (por ejemplo, si expira el token)
    supabase.auth.onAuthStateChange((event, session) => {
        if (!session && event === 'SIGNED_OUT') {
            window.location.href = 'login.html';
        }
    });
}