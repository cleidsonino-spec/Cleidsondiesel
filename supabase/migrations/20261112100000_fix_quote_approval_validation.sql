-- Corrige a normalização do nome na aprovação pública do orçamento.
CREATE OR REPLACE FUNCTION public.approve_quote_identified(_token text, _name text, _cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  q public.quote_approvals;
  o public.service_orders;
  oid uuid;
  n text;
BEGIN
  n := regexp_replace(trim(_name), '[[:space:]]+', ' ', 'g');
  IF _token IS NULL
     OR _token !~ '^[a-f0-9]{64}$'
     OR n IS NULL
     OR length(n) > 120
     OR n !~ '^[[:alpha:]][[:alpha:]''-]+([ ][[:alpha:]][[:alpha:]''-]+)+$'
     OR NOT public.valid_cpf(_cpf) THEN
    RAISE EXCEPTION 'Invalid name or CPF';
  END IF;

  SELECT order_id INTO oid FROM public.quote_approvals WHERE token = _token;
  IF oid IS NULL THEN RAISE EXCEPTION 'Quote unavailable'; END IF;

  SELECT * INTO o FROM public.service_orders WHERE id = oid FOR UPDATE;
  SELECT * INTO q FROM public.quote_approvals WHERE token = _token FOR UPDATE;

  IF q.state = 'revoked'
     OR q.expires_at <= now()
     OR o.status IN ('cancelado', 'entregue', 'pronto')
     OR q.snapshot IS DISTINCT FROM public.quote_snapshot(o) THEN
    RAISE EXCEPTION 'Quote unavailable';
  END IF;

  IF q.state = 'pending' THEN
    UPDATE public.quote_approvals
    SET state = 'approved',
        approved_at = now(),
        approved_by = n,
        approved_cpf = regexp_replace(_cpf, '[^0-9]', '', 'g')
    WHERE id = q.id
    RETURNING * INTO q;

    UPDATE public.service_orders
    SET status = 'aprovado_aguardando_encaminhamento'
    WHERE id = oid;
  END IF;

  RETURN jsonb_build_object('approved_at', q.approved_at, 'approved_by', q.approved_by);
END
$function$;

REVOKE ALL ON FUNCTION public.approve_quote_identified(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_quote_identified(text, text, text) TO anon, authenticated;
