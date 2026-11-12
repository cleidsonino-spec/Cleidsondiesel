-- Estados explícitos de presença; preserva os quatro estados existentes.
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'compareceu';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'nao_compareceu';
