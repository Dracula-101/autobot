-- handle_new_user only runs as the on_auth_user_created trigger; don't expose it over RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
