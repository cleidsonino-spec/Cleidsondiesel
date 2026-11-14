\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000004');
INSERT INTO public.user_roles(user_id, role) VALUES
 ('00000000-0000-4000-8000-000000000001','admin'),
 ('00000000-0000-4000-8000-000000000002','secretaria'),
 ('00000000-0000-4000-8000-000000000003','mecanico'),
 ('00000000-0000-4000-8000-000000000004','mecanico');

INSERT INTO public.service_orders(id,status,delivered_at,created_by,customer_name,vehicle,complaint)
VALUES
 ('10000000-0000-4000-8000-000000000001','entregue',now(),'00000000-0000-4000-8000-000000000001','Cliente sintético','Hilux teste','Revisão concluída'),
 ('10000000-0000-4000-8000-000000000002','em_servico',NULL,'00000000-0000-4000-8000-000000000001','Cliente sintético 2','Van teste','Falha de teste');
INSERT INTO public.warranties(id,service_order_id,duration_months,start_date,end_date,created_by)
VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',3,CURRENT_DATE,CURRENT_DATE+90,'00000000-0000-4000-8000-000000000001');

-- Guard must reject warranty issuance on an order not actually delivered.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.warranties(service_order_id,duration_months,start_date,end_date,created_by)
    VALUES ('10000000-0000-4000-8000-000000000002',3,CURRENT_DATE,CURRENT_DATE+90,'00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL: warranty on non-delivered order was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL: warranty on non-delivered order was accepted' THEN RAISE; END IF;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT public.register_warranty_return(
 '20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega'
) AS return_id \gset
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.warranty_return_events
 WHERE warranty_return_id=:'return_id'::uuid AND event_type='created';
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: audit create event missing'; END IF;
END $$;

-- A close attempt with missing diagnosis/resolution must be rejected.
DO $$
BEGIN
 BEGIN
  PERFORM public.register_warranty_return(
   '20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',
   :'return_id'::uuid,'resolved','',''
  );
  RAISE EXCEPTION 'FAIL: closure without diagnosis/resolution accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
END $$;
SELECT public.register_warranty_return(
 '20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',
 :'return_id'::uuid,'in_review','Falha confirmada','Em análise'
);
SELECT public.register_warranty_return(
 '20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',
 :'return_id'::uuid,'resolved','Falha confirmada','Componente substituído'
);

-- Create a second open return to test OS creation and idempotency.
SELECT public.register_warranty_return(
 '20000000-0000-4000-8000-000000000001','Retorno sintético para abertura de OS'
) AS open_return_id \gset
SELECT public.open_warranty_return_service_order(:'open_return_id'::uuid) AS return_order_id \gset
SELECT public.open_warranty_return_service_order(:'open_return_id'::uuid) AS return_order_id_again \gset
DO $$
DECLARE o public.service_orders;
BEGIN
 IF :'return_order_id'::uuid <> :'return_order_id_again'::uuid THEN
   RAISE EXCEPTION 'FAIL: open operation is not idempotent';
 END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=:'return_order_id'::uuid;
 IF o.status <> 'recebido' OR o.parts_value <> 0 OR o.labor_value <> 0 THEN
   RAISE EXCEPTION 'FAIL: return OS status or financial values invalid';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.warranty_returns
   WHERE id=:'open_return_id'::uuid AND return_service_order_id=o.id) THEN
   RAISE EXCEPTION 'FAIL: return/order link missing';
 END IF;
END $$;
INSERT INTO public.technical_service_logs(service_order_id,procedure,description,result,observations)
VALUES ('10000000-0000-4000-8000-000000000001','Teste','Inspeção sintética','OK','Sem dados reais');
INSERT INTO public.service_order_assignments(service_order_id,mechanic_user_id)
VALUES (:'return_order_id'::uuid,'00000000-0000-4000-8000-000000000003');

-- Mechanic assigned to the return OS can read technical context; no finance columns are exposed.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE c record;
BEGIN
 SELECT * INTO c FROM public.get_warranty_return_context(:'return_order_id'::uuid);
 IF c.return_id IS NULL OR c.original_order_number IS NULL THEN
  RAISE EXCEPTION 'FAIL: assigned mechanic could not read context';
 END IF;
 IF to_jsonb(c)::text ~* '(parts_value|labor_value|order_total|financial_total)' THEN
  RAISE EXCEPTION 'FAIL: financial data leaked in context';
 END IF;
END $$;

-- Unassigned mechanic must be denied.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
DO $$
BEGIN
 BEGIN
  PERFORM * FROM public.get_warranty_return_context(:'return_order_id'::uuid);
  RAISE EXCEPTION 'FAIL: unassigned mechanic read context';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
ROLLBACK;
