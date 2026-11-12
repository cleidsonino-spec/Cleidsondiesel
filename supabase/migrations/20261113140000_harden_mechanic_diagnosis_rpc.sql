-- Restringe a RPC de diagnóstico completo aos usuários autenticados.
-- A função já valida papel de mecânico e atribuição ativa; esta migração
-- remove também o EXECUTE padrão herdado por PUBLIC.
ALTER FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  SECURITY DEFINER;
ALTER FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  SET search_path = public;

REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_complete_diagnosis(uuid, text, boolean, boolean)
  TO authenticated;
