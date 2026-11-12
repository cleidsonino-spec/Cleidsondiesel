-- The four-argument diagnosis RPC is SECURITY DEFINER and must not retain
-- PostgreSQL's default PUBLIC EXECUTE privilege. Only signed-in staff may call
-- it; the function body additionally verifies mechanic role and active assignment.
REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
TO authenticated;
