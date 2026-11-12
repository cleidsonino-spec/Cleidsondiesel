-- Os perfis de equipe são usados pelas políticas e RPCs da oficina.
-- A migration separada garante que os novos valores estejam commitados
-- antes de serem usados pela tabela de convites e pelas funções seguintes.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mecanico';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
