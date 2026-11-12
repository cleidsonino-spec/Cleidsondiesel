-- Histórico append-only de lembretes enviados manualmente para agendamentos.
CREATE TABLE IF NOT EXISTS public.appointment_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  channel text NOT NULL CHECK (channel IN ('whatsapp'))
);

CREATE INDEX IF NOT EXISTS appointment_reminder_logs_appointment_idx
  ON public.appointment_reminder_logs(appointment_id, sent_at DESC);

ALTER TABLE public.appointment_reminder_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_reminder_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_reminder_logs TO authenticated;

CREATE POLICY appointment_reminder_logs_staff_read
  ON public.appointment_reminder_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
  );

-- O registro é feito por RPC para validar função/status e preservar histórico imutável.
CREATE OR REPLACE FUNCTION public.record_appointment_reminder(
  _appointment_id uuid,
  _channel text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado para registrar lembretes';
  END IF;

  IF _channel <> 'whatsapp' THEN
    RAISE EXCEPTION 'Canal de lembrete inválido';
  END IF;

  PERFORM 1
    FROM public.appointments
   WHERE id = _appointment_id
     AND status = 'confirmado'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O agendamento precisa estar confirmado para registrar o lembrete';
  END IF;

  INSERT INTO public.appointment_reminder_logs(appointment_id, sent_by, channel)
  VALUES (_appointment_id, auth.uid(), _channel)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_appointment_reminder(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_appointment_reminder(uuid, text) TO authenticated;

COMMENT ON TABLE public.appointment_reminder_logs IS
  'Histórico append-only dos lembretes enviados manualmente pela equipe. Não comprova entrega pelo WhatsApp.';
