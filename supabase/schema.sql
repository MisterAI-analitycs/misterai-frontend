-- MisterAI - Esquema de Supabase (ejecutar en SQL Editor)

create table if not exists public.partidos (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade,
    nombre           text not null,
    modalidad        text not null default 'Fútbol 11',
    file_path        text,                    -- clave del vídeo en R2 (se vacía al borrar el vídeo)
    huella           text,                    -- huella rápida del vídeo (detección de duplicados)
    tamano_bytes     bigint,
    estado_analisis  text not null default 'pendiente'
                     check (estado_analisis in ('pendiente','procesando','completado','error')),
    resultados       jsonb,                   -- métricas, coordenadas, mapa de calor (lo escribe el worker)
    created_at       timestamptz not null default now(),
    -- Coste de computación (Modal) acumulado, reintentos incluidos. Dato INTERNO: el cliente no puede leerlo.
    modal_segundos   numeric(10,1) not null default 0,
    modal_coste_usd  numeric(10,5) not null default 0
);

create index if not exists partidos_user_idx  on public.partidos (user_id, created_at desc);
create index if not exists partidos_huella_idx on public.partidos (huella);

alter table public.partidos enable row level security;

-- Cada usuario solo ve sus propios partidos.
create policy "ver propios partidos" on public.partidos
    for select using (auth.uid() = user_id);

-- Pendiente de eliminar cuando la subida por el backend esté probada: solo el backend
-- (con la clave secreta) debería crear partidos. Sin permiso INSERT para authenticated, esta política
-- no tiene efecto; se deja como segunda barrera.
create policy "crear partido pendiente" on public.partidos
    for insert with check (
        auth.uid() = user_id
        and estado_analisis = 'pendiente'
        and resultados is null
        and (file_path is null or file_path like auth.uid()::text || '/%')
    );

-- Los vídeos NO se guardan en Supabase: van a Cloudflare R2 (bucket privado, jurisdicción UE).

-- Perfiles y roles. Solo el backend (clave secreta) puede crear o cambiar roles.
create table if not exists public.perfiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    rol        text not null default 'usuario' check (rol in ('usuario', 'admin')),
    created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "ver mi perfil" on public.perfiles
    for select to authenticated
    using (auth.uid() = id);

-- El primer administrador se da de alta con una sentencia aparte, indicando su user id:
-- insert into public.perfiles (id, rol) values ('<user_id>', 'admin');

-- Permisos. Los proyectos nuevos de Supabase no conceden acceso a las tablas por defecto:
-- sin estos GRANT, la API devuelve "permission denied" aunque las políticas RLS existan.
-- anon no tiene acceso. El navegador (authenticated) solo lee, y en partidos solo las columnas de
-- cliente (las columnas nuevas no se conceden solas, así que el coste interno queda oculto).
-- Escribe el backend o el worker con service_role.
grant select (id, user_id, nombre, modalidad, file_path, huella, tamano_bytes, estado_analisis, resultados, created_at)
    on public.partidos to authenticated;
grant select on public.perfiles to authenticated;
grant select, insert, update, delete on public.partidos to service_role;
grant select, insert, update, delete on public.perfiles to service_role;
