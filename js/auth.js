// auth.js - Autenticación con Supabase para MisterAI
// Requiere cargar antes: supabase-js (CDN) y js/config.js

/** Aviso flotante dentro de la página (sustituye a las ventanas alert del navegador). */
function showToast(message, type = 'error') {
    const old = document.getElementById('misterai-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'misterai-toast';
    el.setAttribute('role', 'alert');
    el.textContent = message;
    const colors = { error: '#be123c', success: '#059669', info: '#334155' };
    el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;max-width:90vw;'
        + 'padding:12px 18px;border-radius:12px;font:500 14px system-ui,sans-serif;color:#fff;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,.4);background:' + (colors[type] || colors.info);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

// Cualquier alert() de la web se muestra ahora como aviso dentro de la página.
window.alert = (msg) => {
    const text = String(msg);
    if (/error|⚠|no se pudo|no v[aá]lido|supera|falta/i.test(text)) showToast(text, 'error');
    else if (/creada/i.test(text)) showToast(text, 'success');
    else showToast(text, 'info');
};

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
