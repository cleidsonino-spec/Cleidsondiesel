-- Fluxo permitido: recebido -> em_avaliacao -> coberto/nao_coberto -> concluido.
-- Não permite saltar a avaliação nem alterar um retorno já concluído.
CREATE OR REPLACE FUNCTION public.validate_warranty_claim_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  transition_allowed boolean := false;
BEGIN
  IF NEW.warranty_id IS DISTINCT FROM OLD.warranty_id
     OR NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.reported_at IS DISTINCT FROM OLD.reported_at THEN
    RAISE EXCEPTION 'A origem do retorno não pode ser alterada';
  END IF;

  IF OLD.status = 'concluido' THEN
    RAISE EXCEPTION 'Um retorno concluído é imutável; registre um novo retorno';
  END IF;

  IF NEW.status = OLD.status THEN
    transition_allowed := true;
  ELSIF OLD.status = 'recebido' AND NEW.status = 'em_avaliacao' THEN
    transition_allowed := true;
  ELSIF OLD.status = 'em_avaliacao' AND NEW.status IN ('coberto','nao_coberto') THEN
    transition_allowed := true;
  ELSIF OLD.status IN ('coberto','nao_coberto') AND NEW.status = 'concluido' THEN
    transition_allowed := true;
  END IF;

  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Transição de retorno em garantia não permitida: % -> %', OLD.status, NEW.status;
  END IF;

  IF NEW.status IN ('em_avaliacao','coberto','nao_coberto')
     AND length(trim(coalesce(NEW.assessment,''))) < 3 THEN
    RAISE EXCEPTION 'Registre a avaliação técnica antes de avançar o retorno';
  END IF;

  IF NEW.status = 'concluido' AND length(trim(coalesce(NEW.resolution,''))) < 3 THEN
    RAISE EXCEPTION 'Descreva a solução antes de concluir o retorno';
  END IF;

  IF NEW.status = 'concluido' AND OLD.status <> 'concluido' THEN
    NEW.resolved_at := now();
  ELSE
    NEW.resolved_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warranty_claim_update_guard ON public.warranty_claims;
CREATE TRIGGER warranty_claim_update_guard
  BEFORE UPDATE ON public.warranty_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_warranty_claim_update();
