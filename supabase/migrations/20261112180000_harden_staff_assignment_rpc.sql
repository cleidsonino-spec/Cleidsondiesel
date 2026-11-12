-- Harden the SECURITY DEFINER assignment RPC.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default;
-- only authenticated users should be able to reach this role-checked operation.
REVOKE ALL ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_order_to_mechanic(uuid, uuid, text)
  TO authenticated;
