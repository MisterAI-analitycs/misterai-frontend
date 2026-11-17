// avatares.js - Catálogo de 30 escudos para el perfil de MisterAI (10 combinaciones de color x 3 diseños).
// Se generan por código: no hay imágenes que subir ni moderar, y el usuario solo elige un número del 1 al 30.

const AVATAR_TOTAL = 30;

const AVATAR_COLORES = [
    ['#10b981', '#022c22'], ['#3b82f6', '#172554'], ['#ef4444', '#450a0a'], ['#f59e0b', '#451a03'],
    ['#a855f7', '#3b0764'], ['#ec4899', '#500724'], ['#14b8a6', '#042f2e'], ['#eab308', '#422006'],
    ['#f97316', '#431407'], ['#94a3b8', '#0f172a']
];

let avatarContador = 0;

/** Devuelve el SVG (texto) del escudo número n (1-30) con el tamaño indicado en píxeles. */
function avatarSvg(n, tamano = 48) {
    const num = Math.min(AVATAR_TOTAL, Math.max(1, Number(n) || 1));
    const [c1, c2] = AVATAR_COLORES[(num - 1) % AVATAR_COLORES.length];
    const diseno = Math.floor((num - 1) / AVATAR_COLORES.length) % 3;
    const id = `av${num}x${avatarContador++}`;
    const escudo = 'M32 4 L58 12 V32 C58 46 46 56 32 62 C18 56 6 46 6 32 V12 Z';

    let relleno = '';
    if (diseno === 0) {          // franjas verticales
        relleno = `<rect x="11" y="0" width="11" height="70" fill="${c1}"/><rect x="27" y="0" width="11" height="70" fill="${c1}"/><rect x="43" y="0" width="11" height="70" fill="${c1}"/>`;
    } else if (diseno === 1) {   // banda diagonal
        relleno = `<polygon points="0,44 70,14 70,30 0,60" fill="${c1}"/>`;
    } else {                     // círculo central con aro
        relleno = `<circle cx="32" cy="31" r="15" fill="${c1}"/><circle cx="32" cy="31" r="9" fill="${c2}"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 66" width="${tamano}" height="${Math.round(tamano * 66 / 64)}" role="img" aria-label="Escudo ${num}">` +
        `<defs><clipPath id="${id}"><path d="${escudo}"/></clipPath></defs>` +
        `<path d="${escudo}" fill="${c2}"/>` +
        `<g clip-path="url(#${id})">${relleno}</g>` +
        `<path d="${escudo}" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"/></svg>`;
}
