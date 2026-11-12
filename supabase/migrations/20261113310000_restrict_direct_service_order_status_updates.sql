-- Impede que clientes autenticados alterem o status da OS diretamente pela API.
-- As transições continuam sendo realizadas pelas RPCs SECURITY DEFINER do fluxo:
-- atribuição, diagnóstico, aprovação, conclusão técnica e confirmação de entrega.
-- A edição comum mantém UPDATE somente nos campos operacionais/editáveis.
--
-- Importante: as policies RLS continuam valendo; esta migration não amplia
-- quais perfis podem editar ordens nem concede acesso a anon.
REVOKE UPDATE (status) ON TABLE public.service_orders
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE ON TABLE public.service_orders
  FROM PUBLIC, anon, authenticated;

GRANT UPDATE (
  plate,
  customer_id,
  vehicle_id,
  customer_name,
  phone,
  vehicle,
  vehicle_year,
  mileage,
  complaint,
  diagnosis,
  parts,
  parts_value,
  part_items,
  labor_value,
  entry_date,
  due_date,
  notes,
  inspection_checklist,
  fuel_filter_replacement,
  system_cleaning
) ON TABLE public.service_orders TO authenticated;

COMMENT ON COLUMN public.service_orders.status IS
  'Transições de status devem ocorrer pelas funções autorizadas do fluxo de OS; authenticated não possui UPDATE direto nesta coluna.';
