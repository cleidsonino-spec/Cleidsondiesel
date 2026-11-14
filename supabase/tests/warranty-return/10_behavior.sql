\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE test_ids (return_id uuid, open_return_id uuid, return_order_id uuid);
GRANT SELECT ON test_ids TO authenticated;
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
 ('10000000-0000-4000-8000-000000000002','em_servico',NULL,'00000000-0000-4000-8000-000000000001','Cliente sintético 2','Van teste','Falha de teste'),
 ('10000000-0000-4000-8000-000000000003','entregue',NULL,'00000000-0000-4000-8000-000000000001','Cliente sintético 3','Caminhão teste','Entrega sem timestamp');
-- Mecânico atribuído à OS original deve herdar a OS de retorno.
INSERT INTO public.service_order_assignments(service_order_id,mechanic_user_id,assigned_by,active)
VALUES ('10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000001',true);
INSERT INTO public.warranties(id,service_order_id,duration_months,start_date,end_date,created_by)
VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',3,CURRENT_DATE,CURRENT_DATE+90,'00000000-0000-4000-8000-000000000001');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.warranties(service_order_id,duration_months,start_date,end_date,created_by)
    VALUES ('10000000-0000-4000-8000-000000000002',3,CURRENT_DATE,CURRENT_DATE+90,'00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL: warranty on non-delivered order was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL: warranty on non-delivered order was accepted' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.warranties(service_order_id,duration_months,start_date,end_date,created_by)
    VALUES ('10000000-0000-4000-8000-000000000003',3,CURRENT_DATE,CURRENT_DATE+90,'00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL: warranty on delivered order without delivered_at was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL: warranty on delivered order without delivered_at was accepted' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
INSERT INTO test_ids(return_id)
SELECT public.register_warranty_return('20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega');
DO $$
DECLARE n integer; rid uuid;
BEGIN
 SELECT return_id INTO rid FROM test_ids;
 SELECT count(*) INTO n FROM public.warranty_return_events WHERE warranty_return_id=rid AND event_type='created';
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: audit create event missing'; END IF;
END $$;
DO $$
DECLARE rid uuid;
BEGIN
 SELECT return_id INTO rid FROM test_ids;
 BEGIN
  PERFORM public.register_warranty_return('20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',rid,'resolved','','');
  RAISE EXCEPTION 'FAIL: closure without diagnosis/resolution accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
END $$;
SELECT public.register_warranty_return('20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',(SELECT return_id FROM test_ids),'in_review','Falha confirmada','Em análise');
SELECT public.register_warranty_return('20000000-0000-4000-8000-000000000001','Cliente relata falha após entrega',(SELECT return_id FROM test_ids),'resolved','Falha confirmada','Componente substituído');
DO $audit$
DECLARE n integer; rid uuid;
BEGIN
 SELECT return_id INTO rid FROM test_ids;
 SELECT count(*) INTO n FROM public.warranty_return_events WHERE warranty_return_id=rid AND event_type='updated';
 IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected two update audit events, got %', n; END IF;
END $audit$;
UPDATE test_ids SET open_return_id = public.register_warranty_return('20000000-0000-4000-8000-000000000001','Retorno sintético para abertura de OS');
UPDATE test_ids SET return_order_id=public.open_warranty_return_service_order(open_return_id);
DO $$
DECLARE t test_ids%ROWTYPE; o public.service_orders; n integer;
BEGIN
 SELECT * INTO t FROM test_ids;
 IF t.return_order_id <> public.open_warranty_return_service_order(t.open_return_id) THEN RAISE EXCEPTION 'FAIL: open operation is not idempotent'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=t.return_order_id;
 IF o.status <> 'recebido' OR o.parts_value <> 0 OR o.labor_value <> 0 THEN RAISE EXCEPTION 'FAIL: return OS status or financial values invalid'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.warranty_returns WHERE id=t.open_return_id AND return_service_order_id=o.id) THEN RAISE EXCEPTION 'FAIL: return/order link missing'; END IF;
 SELECT count(*) INTO n FROM public.service_order_assignments
 WHERE service_order_id=o.id AND mechanic_user_id='00000000-0000-4000-8000-000000000003' AND active=true;
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: original mechanic was not inherited exactly once'; END IF;
 SELECT count(*) INTO n FROM public.service_order_assignments
 WHERE service_order_id=o.id AND active=true;
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: return OS must have exactly one active mechanic'; END IF;
 -- Simula retorno legado já aberto sem atribuição: chamada repetida deve reparar.
 UPDATE public.service_order_assignments SET active=false
 WHERE service_order_id=o.id AND mechanic_user_id='00000000-0000-4000-8000-000000000003' AND active=true;
 PERFORM public.open_warranty_return_service_order(t.open_return_id);
 SELECT count(*) INTO n FROM public.service_order_assignments
 WHERE service_order_id=o.id AND mechanic_user_id='00000000-0000-4000-8000-000000000003' AND active=true;
 IF n <> 1 THEN RAISE EXCEPTION 'FAIL: repeated open did not restore exactly one active assignment'; END IF;
END $$;
INSERT INTO public.technical_service_logs(service_order_id,procedure,description,result,observations)
VALUES ('10000000-0000-4000-8000-000000000001','Teste','Inspeção sintética','OK','Sem dados reais');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE c record; oid uuid;
BEGIN
 SELECT return_order_id INTO oid FROM test_ids;
 SELECT * INTO c FROM public.get_warranty_return_context(oid);
 IF c.return_id IS NULL OR c.original_order_number IS NULL THEN RAISE EXCEPTION 'FAIL: assigned mechanic could not read context'; END IF;
 IF to_jsonb(c)::text ~* '(parts_value|labor_value|order_total|financial_total)' THEN RAISE EXCEPTION 'FAIL: financial data leaked in context'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.warranty_returns WHERE return_service_order_id=oid) THEN RAISE EXCEPTION 'FAIL: assigned mechanic cannot read assigned return row'; END IF;
 BEGIN
  PERFORM public.open_warranty_return_service_order((SELECT open_return_id FROM test_ids));
  RAISE EXCEPTION 'FAIL: mechanic opened return OS';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.register_warranty_return('20000000-0000-4000-8000-000000000001','Tentativa de mecânico');
  RAISE EXCEPTION 'FAIL: mechanic registered warranty return';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
DO $$
DECLARE oid uuid;
BEGIN
 SELECT return_order_id INTO oid FROM test_ids;
 IF EXISTS (SELECT 1 FROM public.warranty_returns WHERE return_service_order_id=oid) THEN RAISE EXCEPTION 'FAIL: unassigned mechanic read return row'; END IF;
 BEGIN
  PERFORM * FROM public.get_warranty_return_context(oid);
  RAISE EXCEPTION 'FAIL: unassigned mechanic read context';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
ROLLBACK;
