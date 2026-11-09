-- Diagnóstico somente leitura do schema Neon.
-- Este script NÃO cria, altera ou apaga tabelas nem dados.
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'customers',
    'vehicles',
    'service_orders',
    'payments',
    'warranties',
    'appointments',
    'user_roles',
    'quote_approvals'
  )
ORDER BY table_name, ordinal_position;
