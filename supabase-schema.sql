create table if not exists public.products (
  id text primary key,
  name text not null,
  sku text not null unique,
  opening integer not null default 0 check (opening >= 0),
  received integer not null default 0 check (received >= 0),
  shipped integer not null default 0 check (shipped >= 0),
  weekly integer not null default 0 check (weekly >= 0),
  lead integer not null default 0 check (lead >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  product_id text not null references public.products(id) on delete cascade,
  type text not null check (type in ('Receipt', 'Shipment')),
  quantity integer not null check (quantity > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.movements enable row level security;

drop policy if exists "inventory products are readable" on public.products;
drop policy if exists "inventory products are insertable" on public.products;
drop policy if exists "inventory products are editable" on public.products;
drop policy if exists "inventory movements are readable" on public.movements;
drop policy if exists "inventory movements are insertable" on public.movements;

create policy "inventory products are readable" on public.products for select to anon using (true);
create policy "inventory products are insertable" on public.products for insert to anon with check (true);
create policy "inventory products are editable" on public.products for update to anon using (true) with check (true);
create policy "inventory movements are readable" on public.movements for select to anon using (true);
create policy "inventory movements are insertable" on public.movements for insert to anon with check (true);

create or replace function public.record_movement(
  p_product_id text,
  p_type text,
  p_quantity integer,
  p_date date,
  p_note text default ''
) returns public.movements
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.movements;
begin
  if p_quantity <= 0 or p_type not in ('Receipt', 'Shipment') then
    raise exception 'Invalid movement';
  end if;

  update public.products
  set received = received + case when p_type = 'Receipt' then p_quantity else 0 end,
      shipped = shipped + case when p_type = 'Shipment' then p_quantity else 0 end
  where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into public.movements (product_id, type, quantity, date, note)
  values (p_product_id, p_type, p_quantity, p_date, coalesce(p_note, ''))
  returning * into saved;
  return saved;
end;
$$;

grant execute on function public.record_movement(text, text, integer, date, text) to anon;
