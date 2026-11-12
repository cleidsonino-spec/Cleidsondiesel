-- Confirmação explícita de quem entrega o veículo e identificação legível de quem recebe.
-- Registros antigos permanecem válidos e não são alterados retroativamente.
ALTER TABLE public.vehicle_intake_records
  ADD COLUMN IF NOT EXISTS delivered_by_name text,
  ADD COLUMN IF NOT EXISTS delivery_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_by_name text,
  ADD COLUMN IF NOT EXISTS delivery_consent_text text;

CREATE OR REPLACE FUNCTION public.validate_vehicle_intake_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivered_by_name IS NULL
     OR char_length(trim(NEW.delivered_by_name)) < 2
     OR char_length(trim(NEW.delivered_by_name)) > 160 THEN
    RAISE EXCEPTION 'Informe o nome de quem entregou o veículo';
  END IF;

  IF NEW.received_by_name IS NULL
     OR char_length(trim(NEW.received_by_name)) < 2
     OR char_length(trim(NEW.received_by_name)) > 160 THEN
    RAISE EXCEPTION 'Não foi possível identificar quem recebeu o veículo';
  END IF;

  IF NEW.delivery_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A pessoa que entregou precisa confirmar o registro de recebimento';
  END IF;

  IF NEW.delivery_consent_text IS NULL
     OR char_length(trim(NEW.delivery_consent_text)) < 20
     OR char_length(trim(NEW.delivery_consent_text)) > 1000 THEN
    RAISE EXCEPTION 'O texto de confirmação da entrega é obrigatório';
  END IF;

  NEW.delivery_consent_text := trim(NEW.delivery_consent_text);
  NEW.delivered_by_name := trim(NEW.delivered_by_name);
  NEW.received_by_name := trim(NEW.received_by_name);
  NEW.received_at := now();
  NEW.delivery_confirmed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_intake_confirmation_validate ON public.vehicle_intake_records;
CREATE TRIGGER vehicle_intake_confirmation_validate
BEFORE INSERT ON public.vehicle_intake_records
FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_intake_confirmation();

COMMENT ON COLUMN public.vehicle_intake_records.delivered_by_name IS
  'Nome informado da pessoa que entregou o veículo à oficina.';
COMMENT ON COLUMN public.vehicle_intake_records.received_by_name IS
  'Nome de exibição do usuário autenticado que registrou e recebeu o veículo; received_by mantém a identidade vinculada à conta.';
COMMENT ON COLUMN public.vehicle_intake_records.delivery_consent_text IS
  'Texto exato do aceite apresentado à pessoa que entregou o veículo.';
COMMENT ON COLUMN public.vehicle_intake_records.delivery_confirmed_at IS
  'Data/hora do aceite expresso da pessoa que entregou o veículo.';
