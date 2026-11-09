-- Run after supabase-transfers.sql. Deletes location history only, without changing stock.
begin;
create or replace function public.delete_location_movement(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in to continue'; end if;
  delete from public.location_movements where id = p_id;
  if not found then raise exception 'Movement not found. Refresh the activity log and try again.'; end if;
end;
$$;
revoke all on function public.delete_location_movement(uuid) from public, anon;
grant execute on function public.delete_location_movement(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
