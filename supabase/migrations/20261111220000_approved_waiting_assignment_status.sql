-- Status separado entre aprovação do cliente e encaminhamento para execução.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aprovado_aguardando_encaminhamento';