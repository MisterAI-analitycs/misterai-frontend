// auth.js - Autenticación con Supabase para MisterAI
// Requiere cargar antes: supabase-js (CDN) y js/config.js

function requireClient() {
    if (!sb) {
        alert('⚠️ El servicio aún no está configurado. Revisa js/config.js.');
        return false;
    }
    return true;
}

/** Iniciar sesión con email y contraseña */
async function loginMister(email, password) {
    if (!requireClient()) return { success: false };
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = pageUrl('dashboard.html');
        return { success: true, data };
    } catch (error) {
        alert(`Error de acceso: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/** Registrar un nuevo Míster (el nombre se guarda en la metadata del usuario) */
async function registerMister(email, password, name) {
    if (!requireClient()) return { success: false };
    try {
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: name },
                emailRedirectTo: pageUrl('dashboard.html')
            }
        });
        if (error) throw error;

        if (data.session) {
            // Confirmación por email desactivada: ya hay sesión
            window.location.href = pageUrl('dashboard.html');
        } else {
            alert('¡Cuenta creada! Revisa tu correo para confirmarla antes de acceder.');
        }
        return { success: true, data };
    } catch (error) {
        alert(`Error al crear la cuenta: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/** Acceso con Google OAuth */
async function loginWithGoogle() {
    if (!requireClient()) return { success: false };
    try {
        const { data, error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: pageUrl('dashboard.html') }
        });
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        alert(`Error al conectar con Google: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/** Cerrar sesión */
async function logoutMister() {
    if (sb) await sb.auth.signOut();
    window.location.href = pageUrl('login.html');
}

/**
 * Guardián de ruta. Devuelve el usuario si hay sesión; si no, redirige al login.
 * (API v2 de supabase-js: getSession() es asíncrona.)
 */
async function protectRoute() {
    if (!sb) return null; // Sin configuración no redirigimos para evitar bucles

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = pageUrl('login.html');
        return null;
    }

    sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') window.location.href = pageUrl('login.html');
    });

    return session.user;
}
