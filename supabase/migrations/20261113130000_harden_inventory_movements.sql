-- O saldo de estoque deve mudar exclusivamente pelo livro de movimentos.
-- A função do trigger usa privilégios do proprietário para atualizar o saldo,
-- enquanto a sessão autenticada não recebe UPDATE direto na tabela de itens.
ALTER FUNCTION public.apply_inventory_movement() SECURITY DEFINER;
ALTER FUNCTION public.apply_inventory_movement() SET search_path = public;
REVOKE ALL ON FUNCTION public.apply_inventory_movement() FROM PUBLIC, anon, authenticated;

REVOKE UPDATE ON TABLE public.inventory_items FROM authenticated;

-- Preenche chaves ausentes de instalações que já tenham movimentos antes de
-- exigir NOT NULL. Cada linha antiga recebe uma chave única.
UPDATE public.inventory_movements
   SET idempotency_key = gen_random_uuid()::text
 WHERE idempotency_key IS NULL;

-- Toda movimentação precisa de uma chave para impedir duplicidade em retries
-- de rede após uma inserção que tenha sido confirmada pelo banco.
ALTER TABLE public.inventory_movements
  ALTER COLUMN idempotency_key SET NOT NULL;
