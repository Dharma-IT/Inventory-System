-- Run in Supabase SQL Editor before deploying the delete action.
drop policy if exists "inventory movements are deletable" on public.movements;
create policy "inventory movements are deletable" on public.movements
  for delete to authenticated using (true);

create or replace function public.delete_movement(p_id uuid)
returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  movement public.movements;
  product public.products;
begin
  select * into movement from public.movements where id = p_id for update;
  if not found then
    raise exception 'Movement not found. Refresh the activity log and try again.';
  end if;

  select * into product from public.products where id = movement.product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;

  if movement.type = 'Receipt' then
    if product.received < movement.quantity
      or product.opening + product.received - product.shipped < movement.quantity then
      raise exception 'Cannot delete this receipt because it would leave stock or received totals below zero.';
    end if;
    update public.products set received = received - movement.quantity
      where id = movement.product_id returning * into product;
  else
    if product.shipped < movement.quantity then
      raise exception 'Cannot delete this shipment because it would leave shipped totals below zero.';
    end if;
    update public.products set shipped = shipped - movement.quantity
      where id = movement.product_id returning * into product;
  end if;

  delete from public.movements where id = p_id;
  return product;
end;
$$;

revoke execute on function public.delete_movement(uuid) from public, anon;
grant execute on function public.delete_movement(uuid) to authenticated;
