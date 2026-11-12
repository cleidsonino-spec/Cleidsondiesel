-- Registro auditável de retornos relacionados a uma garantia já emitida.
CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id uuid NOT NULL REFERENCES public.warranties(id) ON DELETE RESTRICT,
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  reported_at timestamptz NOT NULL DEFAULT now(),
  complaint text NOT NULL CHECK (length(trim(complaint)) BETWEEN 5 AND 5000),
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido','em_avaliacao','coberto','nao_coberto','concluido')),
  assessment text NOT NULL DEFAULT '',
  resolution text NOT NULL DEFAULT '',
  follow_up_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranty_claim_order_consistency CHECK (service_order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS warranty_claims_warranty_idx
  ON public.warranty_claims(warranty_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS warranty_claims_order_idx
  ON public.warranty_claims(service_order_id, reported_at DESC);

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.warranty_claims TO authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.warranty_claims FROM authenticated;

DROP POLICY IF EXISTS warranty_claims_staff_read ON public.warranty_claims;
CREATE POLICY warranty_claims_staff_read ON public.warranty_claims
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria'));

DROP POLICY IF EXISTS warranty_claims_staff_insert ON public.warranty_claims;
CREATE POLICY warranty_claims_staff_insert ON public.warranty_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria'))
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.warranties w
      WHERE w.id = warranty_id
        AND w.service_order_id = service_order_id
    )
  );

DROP POLICY IF EXISTS warranty_claims_staff_update ON public.warranty_claims;
CREATE POLICY warranty_claims_staff_update ON public.warranty_claims
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria'))
  WITH CHECK (
    (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria'))
    AND EXISTS (
      SELECT 1 FROM public.warranties w
      WHERE w.id = warranty_id
        AND w.service_order_id = service_order_id
    )
  );

CREATE OR REPLACE FUNCTION public.validate_warranty_claim_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.warranty_id <> OLD.warranty_id
     OR NEW.service_order_id <> OLD.service_order_id
     OR NEW.created_by <> OLD.created_by
     OR NEW.created_at <> OLD.created_at
     OR NEW.reported_at <> OLD.reported_at THEN
    RAISE EXCEPTION 'A origem do retorno não pode ser alterada';
  END IF;

  IF OLD.status = 'concluido' AND NEW.status <> 'concluido' THEN
    RAISE EXCEPTION 'Um retorno concluído não pode ser reaberto; registre um novo retorno';
  END IF;

  IF NEW.status = 'concluido' AND length(trim(coalesce(NEW.resolution, ''))) < 3 THEN
    RAISE EXCEPTION 'Descreva a solução antes de concluir o retorno';
  END IF;

  IF NEW.status = 'concluido' AND OLD.status <> 'concluido' THEN
    NEW.resolved_at := coalesce(NEW.resolved_at, now());
  ELSIF NEW.status <> 'concluido' THEN
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
