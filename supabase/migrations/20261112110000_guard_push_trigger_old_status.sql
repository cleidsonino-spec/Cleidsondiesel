-- Evita acessar OLD.status em triggers disparados por tabelas sem a coluna status.
-- A função é compartilhada por appointments, service_orders e warranties.
CREATE OR REPLACE FUNCTION push.notify_worker_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'push', 'vault', 'net'
AS $function$
DECLARE
  webhook_secret text;
  new_record jsonb;
  old_record jsonb;
  mechanic_name text;
BEGIN
  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  LIMIT 1;

  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    RAISE WARNING 'Push webhook secret is not configured';
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    new_record := to_jsonb(NEW);
    old_record := '{}'::jsonb;
  ELSIF TG_OP = 'UPDATE' THEN
    new_record := to_jsonb(NEW);
    old_record := to_jsonb(OLD);
  ELSE
    RAISE WARNING 'Unsupported operation % for push notification trigger', TG_OP;
    RETURN NULL;
  END IF;

  -- Só consulta OLD.status dentro do ramo em que o registro é de service_orders
  -- e a operação é UPDATE. Isso evita erro em warranties/appointments.
  IF TG_TABLE_SCHEMA = 'public' THEN
    IF TG_TABLE_NAME = 'service_orders' THEN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status
           AND NEW.status::text = 'aguardando_aprovacao' THEN
          SELECT si.full_name INTO mechanic_name
          FROM public.service_order_assignments a
          JOIN public.staff_invitations si
            ON si.accepted_user_id = a.mechanic_user_id
           AND si.revoked_at IS NULL
          WHERE a.service_order_id = NEW.id
            AND a.active = true
          ORDER BY a.assigned_at DESC
          LIMIT 1;

          new_record := jsonb_set(
            new_record,
            '{mechanic_name}',
            to_jsonb(coalesce(nullif(trim(mechanic_name), ''), 'Mecânico responsável')),
            true
          );
        END IF;
      END IF;
    END IF;
  END IF;

  PERFORM net.http_post(
    url := 'https://cleidson-diesel-push.cleidsonino.workers.dev/notify',
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'record', new_record,
      'old_record', old_record
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  RETURN NULL;
END;
$function$;
