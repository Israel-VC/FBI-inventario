-- ============================================================
-- FBI Central de Alarmas - Setup de base de datos
-- Pegar este script completo en Supabase: SQL Editor > New query > Run
-- ============================================================

-- Tabla de productos
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null,
  marca text default '',
  modelo text default '',
  precio numeric default 0,
  stock integer default 0,
  minimo integer default 0,
  foto text,
  creado_en timestamptz default now()
);

-- Tabla de clientes (instalaciones)
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  domicilio text not null,
  telefono text default '',
  creado_en timestamptz default now()
);

-- Tabla de equipos instalados (relación cliente <-> producto)
create table equipos_instalados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  cantidad integer not null default 1,
  creado_en timestamptz default now()
);

-- Tabla de movimientos (entradas/salidas de stock)
create table movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad integer not null,
  motivo text default '',
  usuario_email text,
  creado_en timestamptz default now()
);

-- ============================================================
-- Seguridad: solo usuarios logueados pueden usar el sistema
-- ============================================================

alter table productos enable row level security;
alter table clientes enable row level security;
alter table equipos_instalados enable row level security;
alter table movimientos enable row level security;

create policy "Usuarios logueados pueden ver productos" on productos
  for select using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden crear productos" on productos
  for insert with check (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden editar productos" on productos
  for update using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden eliminar productos" on productos
  for delete using (auth.role() = 'authenticated');

create policy "Usuarios logueados pueden ver clientes" on clientes
  for select using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden crear clientes" on clientes
  for insert with check (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden editar clientes" on clientes
  for update using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden eliminar clientes" on clientes
  for delete using (auth.role() = 'authenticated');

create policy "Usuarios logueados pueden ver equipos" on equipos_instalados
  for select using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden crear equipos" on equipos_instalados
  for insert with check (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden editar equipos" on equipos_instalados
  for update using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden eliminar equipos" on equipos_instalados
  for delete using (auth.role() = 'authenticated');

create policy "Usuarios logueados pueden ver movimientos" on movimientos
  for select using (auth.role() = 'authenticated');
create policy "Usuarios logueados pueden crear movimientos" on movimientos
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- Datos de ejemplo (opcional, podés borrarlos despues desde la app)
-- ============================================================

insert into productos (nombre, categoria, marca, modelo, precio, stock, minimo) values
('Panel de control DSC PowerSeries', 'Paneles', 'DSC', 'PC1864', 145000, 6, 2),
('Sensor de movimiento PIR', 'Sensores', 'Bosch', 'DS150i', 18500, 24, 10),
('Sirena de exterior con flash', 'Sirenas', 'DSC', 'WS4913', 32000, 3, 4),
('Cámara IP domo 2MP', 'Cámaras', 'Hikvision', 'DS-2CD1123G0', 41000, 9, 5);
