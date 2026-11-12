-- Desativa a sobrecarga antiga do diagnóstico que não exigia
-- as duas verificações de manutenção.
-- A interface atual utiliza exclusivamente a versão de quatro argumentos.
REVOKE ALL ON FUNCTION public.mechanic_complete_diagnosis(uuid, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.mechanic_complete_diagnosis(uuid, text) IS
  'Sobrecarga legada desativada para chamadas de clientes; utilizar a versão de quatro argumentos com as verificações de manutenção.';
