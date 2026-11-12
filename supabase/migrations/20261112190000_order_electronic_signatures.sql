-- Assinaturas eletrônicas simples para recebimento e entrega do veículo.
-- A aprovação do orçamento já possui fluxo próprio em quote_approvals e não é duplicada aqui.
CREATE TABLE IF NOT EXISTS public.service_order_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('vehicle_receipt','vehicle_delivery')),
  signer_name text NOT NULL CHECK (length(trim(signer_name)) BETWEEN 3 AND 120),
  signer_relation text NOT NULL CHECK (length(trim(signer_relation)) BETWEEN 2 AND 80),
  consent_text text NOT NULL,
  document_snapshot jsonb NOT NULL CHECK (jsonb_typeof(document_snapshot) = 'object'),
  signed_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE (service_order_id, event_type)
);

CREATE INDEX IF NOT EXISTS service_order_signatures_order_idx
  ON public.service_order_signatures(service_order_id, signed_at DESC);

ALTER TABLE public.service_order_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_signatures_read_staff ON public.service_order_signatures;
CREATE POLICY service_order_signatures_read_staff
  ON public.service_order_signatures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria'));

REVOKE ALL ON public.service_order_signatures FROM anon, authenticated;
GRANT SELECT ON public.service_order_signatures TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_order_signature_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'Assinaturas registradas são imutáveis';
END $$;

DROP TRIGGER IF EXISTS service_order_signatures_immutable ON public.service_order_signatures;
CREATE TRIGGER service_order_signatures_immutable
  BEFORE UPDATE OR DELETE ON public.service_order_signatures
  FOR EACH ROW EXECUTE FUNCTION public.prevent_order_signature_mutation();

CREATE OR REPLACE FUNCTION public.record_order_signature(
  _order_id uuid,
  _event_type text,
  _signer_name text,
  _signer_relation text,
  _consent boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  o public.service_orders;
  clean_name text;
  clean_relation text;
  consent text;
  snapshot jsonb;
  signature_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria')
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  clean_name := regexp_replace(trim(coalesce(_signer_name,'')), '[[:space:]]+', ' ', 'g');
  clean_relation := regexp_replace(trim(coalesce(_signer_relation,'')), '[[:space:]]+', ' ', 'g');
  IF length(clean_name) NOT BETWEEN 3 AND 120 OR length(clean_relation) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe o nome completo e o vínculo do signatário';
  END IF;
  IF _consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A confirmação expressa do signatário é obrigatória';
  END IF;

  SELECT * INTO o FROM public.service_orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de serviço não encontrada'; END IF;

  IF _event_type = 'vehicle_receipt' THEN
    IF o.status <> 'recebido' THEN
      RAISE EXCEPTION 'A assinatura de recebimento só pode ser registrada na entrada do veículo';
    END IF;
    consent := 'Confirmo que acompanhei e concordo com o registro das condições do veículo no momento do recebimento pela oficina.';
  ELSIF _event_type = 'vehicle_delivery' THEN
    IF o.status NOT IN ('pronto','entregue') THEN
      RAISE EXCEPTION 'A assinatura de entrega só pode ser registrada quando o serviço estiver pronto';
    END IF;
    consent := 'Confirmo o recebimento do veículo e declaro que tive a oportunidade de conferir sua entrega e os serviços registrados nesta ordem.';
  ELSE
    RAISE EXCEPTION 'Tipo de assinatura inválido';
  END IF;

  snapshot := jsonb_build_object(
    'order_id', o.id,
    'order_number', o.number,
    'customer_name', o.customer_name,
    'vehicle', o.vehicle,
    'vehicle_year', o.vehicle_year,
    'plate', o.plate,
    'complaint', o.complaint,
    'diagnosis', o.diagnosis,
    'parts', o.parts,
    'status_at_signing', o.status,
    'total_at_signing', coalesce(o.parts_value,0) + coalesce(o.labor_value,0)
  );

  INSERT INTO public.service_order_signatures
    (service_order_id,event_type,signer_name,signer_relation,consent_text,document_snapshot,recorded_by)
  VALUES
    (_order_id,_event_type,clean_name,clean_relation,consent,snapshot,auth.uid())
  RETURNING id INTO signature_id;

  RETURN signature_id;
END $$;

REVOKE ALL ON FUNCTION public.record_order_signature(uuid,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_order_signature(uuid,text,text,text,boolean) TO authenticated;
