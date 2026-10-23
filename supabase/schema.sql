-- MisterAI - Esquema inicial de Supabase (ejecutar en SQL Editor)

create table if not exists public.partidos (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade,
    nombre           text not null,
    modalidad        text not null default 'Fútbol 11',
    file_path        text,                    -- ruta en el bucket (se vacía al borrar el vídeo)
    huella           text,                    -- huella rápida del vídeo (detección de duplicados)
    tamano_bytes     bigint,
    estado_analisis  text not null default 'pendiente'
                     check (estado_analisis in ('pendiente','procesando','completado','error')),
    resultados       jsonb,                   -- métricas, coordenadas, mapa de calor (lo escribe el worker)
    created_at       timestamptz not null default now()
);

create index if not exists partidos_user_idx  on public.partidos (user_id, created_at desc);
create index if not exists partidos_huella_idx on public.partidos (huella);

alter table public.partidos enable row level security;

-- Cada usuario solo ve y crea sus propios partidos.
create policy "ver propios partidos" on public.partidos
    for select using (auth.uid() = user_id);

-- El navegador solo puede crear filas en estado 'pendiente'; el resto de cambios
-- (procesando/completado/error, resultados) los hace el backend con la service_role key.
create policy "crear partido pendiente" on public.partidos
    for insert with check (auth.uid() = user_id and estado_analisis = 'pendiente' and resultados is null);

-- Bucket PRIVADO para los vídeos (sin acceso público)
insert into storage.buckets (id, name, public, file_size_limit)
values ('partidos', 'partidos', false, 4294967296)   -- 4 GB (requiere plan Pro)
on conflict (id) do nothing;

-- Cada usuario solo puede subir y leer dentro de su carpeta: <user_id>/archivo.mp4
create policy "subir a mi carpeta" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'partidos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "leer mi carpeta" on storage.objects
    for select to authenticated
    using (bucket_id = 'partidos' and (storage.foldername(name))[1] = auth.uid()::text);
