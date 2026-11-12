CREATE TABLE IF NOT EXISTS public.customer_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  authorization_type text NOT NULL CHECK (authorization_type IN ('execution_authorization','delivery_confirmation')),
  signer_name text NOT NULL CHECK (char_length(trim(signer_name)) BETWEEN 3 AND 120),
  signature_method text NOT NULL DEFAULT 'typed_name_checkbox' CHECK (signature_method = 'typed_name_checkbox'),
  consent_text text NOT NULL CHECK (char_length(trim(consent_text)) BETWEEN 10 AND 1000),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_authorizations_order_idx
  ON public.customer_authorizations(service_order_id, accepted_at DESC);

ALTER TABLE public.customer_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_authorizations FROM anon, authenticated;
GRANT SELECT ON public.customer_authorizations TO authenticated;
GRANT ALL ON public.customer_authorizations TO service_role;

DROP POLICY IF EXISTS customer_authorizations_staff_read ON public.customer_authorizations;
CREATE POLICY customer_authorizations_staff_read ON public.customer_authorizations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.record_customer_authorization(
  _order_id uuid,
  _authorization_type text,
  _signer_name text,
  _accepted boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.service_orders;
  v_name text;
  v_consent text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  v_name := regexp_replace(trim(coalesce(_signer_name, '')), '[[:space:]]+', ' ', 'g');
  IF length(v_name) < 3 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Informe o nome completo de quem está autorizando';
  END IF;
  IF _accepted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A confirmação do cliente é obrigatória';
  END IF;
  IF _authorization_type NOT IN ('execution_authorization', 'delivery_confirmation') THEN
    RAISE EXCEPTION 'Tipo de autorização inválido';
  END IF;

  SELECT * INTO o FROM public.service_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de serviço não encontrada'; END IF;

  IF _authorization_type = 'execution_authorization' THEN
    IF o.status <> 'aprovado_aguardando_encaminhamento' THEN
      RAISE EXCEPTION 'A OS precisa estar com orçamento aprovado e aguardando encaminhamento';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.quote_approvals q
      WHERE q.order_id = _order_id AND q.state = 'approved'
    ) THEN
      RAISE EXCEPTION 'O orçamento ainda não possui aprovação registrada';
    END IF;
    v_consent := 'Confirmo que fui informado(a) sobre o serviço descrito na ordem de serviço e autorizo a execução conforme o orçamento aprovado.';
  ELSE
    IF o.status <> 'pronto' THEN
      RAISE EXCEPTION 'A entrega só pode ser confirmada quando a OS estiver pronta para retirada';
    END IF;
    v_consent := 'Confirmo o recebimento do veículo e declaro que pude conferir sua entrega e os serviços registrados nesta ordem de serviço.';
  END IF;

  INSERT INTO public.customer_authorizations (
    service_order_id, authorization_type, signer_name,
    signature_method, consent_text, recorded_by
  ) VALUES (
    _order_id, _authorization_type, v_name,
    'typed_name_checkbox', v_consent, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_authorization(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_authorization(uuid, text, text, boolean) TO authenticated;

COMMENT ON TABLE public.customer_authorizations IS
  'Registros imutáveis de aceite eletrônico presencial por OS. Nome digitado e confirmação explícita; não equivale a assinatura manuscrita nem certificação ICP-Brasil.';
