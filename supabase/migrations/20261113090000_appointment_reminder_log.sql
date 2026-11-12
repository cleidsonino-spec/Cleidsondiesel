-- Registro manual e auditável de lembretes enviados para agendamentos.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reminder_channel text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_reminder_channel_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_reminder_channel_check
  CHECK (reminder_channel IS NULL OR reminder_channel IN ('whatsapp'));

CREATE OR REPLACE FUNCTION public.validate_appointment_reminder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
     OR NEW.reminder_sent_by IS DISTINCT FROM OLD.reminder_sent_by
     OR NEW.reminder_channel IS DISTINCT FROM OLD.reminder_channel THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria')) THEN
      RAISE EXCEPTION 'Somente a equipe autorizada pode registrar lembretes';
    END IF;
    IF NEW.reminder_sent_at IS NOT NULL
       AND (NEW.reminder_sent_by IS DISTINCT FROM auth.uid()
         OR NEW.reminder_channel IS DISTINCT FROM 'whatsapp') THEN
      RAISE EXCEPTION 'Dados do lembrete inválidos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_reminder_guard ON public.appointments;
CREATE TRIGGER appointments_reminder_guard
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_reminder();
