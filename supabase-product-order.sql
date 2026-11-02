-- Run once for existing installations before deploying the updated app.
alter table public.products add column if not exists position integer;
with ranked as (
  select id, row_number() over (order by created_at, id) - 1 as display_position
  from public.products
)
update public.products p set position = ranked.display_position
from ranked where p.id = ranked.id and p.position is null;
alter table public.products alter column position set default 2147483647;
alter table public.products alter column position set not null;

create or replace function public.reorder_products(p_ids text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  lock table public.products in share row exclusive mode;
  if p_ids is null
    or cardinality(p_ids) <> (select count(*) from public.products)
    or (select count(distinct id) from unnest(p_ids) as ids(id)) <> cardinality(p_ids)
    or exists (select 1 from unnest(p_ids) as ids(id)
               where not exists (select 1 from public.products p where p.id = ids.id)) then
    raise exception 'The product list changed. Close Manage products, refresh inventory, and try again.';
  end if;
  update public.products p set position = ordered.ordinality - 1
  from unnest(p_ids) with ordinality as ordered(id, ordinality)
  where p.id = ordered.id;
end;
$$;
revoke execute on function public.reorder_products(text[]) from public, anon;
grant execute on function public.reorder_products(text[]) to authenticated;

update public.products set weekly = 350 where sku = 'LAB-001';
