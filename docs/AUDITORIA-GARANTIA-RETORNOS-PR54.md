# Auditoria — garantia, retornos e pós-serviço

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`  
Escopo: revisão estática de frontend, regras puras, migrations e portal do cliente. Não houve conexão ao banco, chamadas reais de API ou testes de integração.

## Arquivos revisados

- `src/components/painel/warranty-editor.tsx`
- `src/lib/warranty.ts`
- `src/routes/_authenticated/painel.ordens.$id.tsx`
- `src/routes/_authenticated/painel.garantias.tsx`
- `src/routes/_authenticated/painel.garantias.index.tsx`
- `src/routes/_authenticated/painel.index.tsx`
- `drizzle/migrations/0006_customers_vehicles_and_warranty_module.sql`
- `supabase/migrations/20261113350000_warranty_returns_and_audit.sql`
- `supabase/migrations/20261113360000_customer_portal_warranty_return_updates.sql`
- `supabase/migrations/20261113380000_harden_warranty_access.sql`

## Controles positivos confirmados no código

1. **Vínculo da garantia:** a garantia aponta para uma OS original; a migration impede alterar `service_order_id`, data de início, autoria e criação da garantia.
2. **Prazo:** o trigger `validate_warranty_dates` calcula o vencimento no banco a partir da data inicial e duração em meses, com prazo limitado a 1–120 meses. A função frontend também calcula a data para prévia, mas o trigger é a fonte de verdade.
3. **Retorno vinculado:** `warranty_returns.warranty_id` e `service_order_id` são obrigatórios, com FKs restritivas. A RPC deriva a OS da garantia selecionada; não recebe uma OS arbitrária do cliente.
4. **Trilha de auditoria:** emissão/alteração de garantia e criação/alteração de retorno geram eventos com ator, horário e snapshots anterior/posterior. Os eventos são legíveis por admin/secretaria e não têm escrita direta concedida a usuários autenticados.
5. **Transições de retorno:** retorno encerrado não pode ser editado; retorno recebido precisa passar por análise antes de encerrar; retorno em análise não pode retroceder para recebido.
6. **Preservação:** não há exclusão física permitida para garantias/retornos no fluxo autenticado analisado.
7. **Portal do cliente:** a função pública retorna status, datas e `customer_update`; não inclui diagnóstico, resolução técnica, peças utilizadas ou descrição interna de mão de obra.
8. **Acesso:** garantias e retornos são protegidos por RLS para admin/secretaria; gravação do retorno ocorre por RPC com verificação de papel.

## Achados e riscos

### 1. Diagnóstico técnico não é obrigatório no banco ao encerrar retorno — prioridade alta

A interface `WarrantyReturnPanel.save()` exige diagnóstico não vazio quando o status escolhido é `resolved` ou `not_covered`. Porém, a RPC `register_warranty_return` valida no banco apenas a presença de uma solução/justificativa com pelo menos três caracteres para esses estados. Não valida `v_diagnosis`.

Como a RPC é executável por usuários autenticados autorizados, uma chamada direta pode encerrar um retorno sem diagnóstico, contornando a validação da tela.

**Correção necessária:** a própria RPC deve exigir diagnóstico técnico não vazio antes de aceitar `resolved` ou `not_covered`. Se houver casos excepcionais sem diagnóstico, devem ter estado/justificativa específicos, não depender apenas da UI.

### 2. Emissão de garantia depende do status apenas na interface — prioridade alta

`canIssueWarranty()` limita a emissão ao status `pronto` na tela. Porém, os controles de banco revisados validam duração, datas, identidade imutável e papel, mas não verificam o status atual da OS antes de inserir a garantia.

As permissões concedem INSERT/UPDATE de garantias a authenticated, com RLS admin/secretaria. Portanto, um operador autorizado pode contornar a regra de interface por chamada direta à API e tentar emitir garantia antes de a OS estar pronta.

**Correção necessária:** validação transacional no banco, no INSERT, que confirme que a OS está no status permitido. Definir explicitamente se a emissão após entrega (`entregue`) também deve ser aceita; atualmente a interface restringe a `pronto`.

### 3. Elegibilidade por vencimento do prazo no retorno — regra de negócio a definir

A RPC localiza a garantia e valida seu vínculo, mas não rejeita retorno registrado após `end_date`. Isso pode ser intencional para documentar reclamações fora da cobertura, mas a regra deve ser explícita: permitir registrar o retorno e classificá-lo como fora da cobertura após análise, ou bloquear abertura de retorno em garantia vencida. Não bloquear automaticamente sem decisão comercial, pois isso pode impedir o registro histórico de uma reclamação.

### 4. Auditoria e histórico não equivalem a teste de execução

A UI exibe ator e horário dos eventos, e o banco grava snapshots. Não foi comprovado em execução que triggers, RLS, RPC, portal e migrações estejam instalados e coerentes no ambiente de destino. A consulta de eventos também exibe o UUID do usuário, não seu nome legível; melhoria de usabilidade opcional.

## Testes de aceitação necessários

1. Emitir garantia em OS `pronto`; confirmar duração e vencimento calculado pelo banco.
2. Tentar emitir por API em OS `recebido`, `em_servico`, `entregue` e `cancelado`; confirmar bloqueio conforme regra de negócio definida.
3. Tentar alterar `service_order_id`, `start_date` e autoria de garantia existente; confirmar rejeição.
4. Abrir retorno novo e confirmar vínculo automático à OS da garantia.
5. Tentar encerrar diretamente pela RPC sem diagnóstico, com diagnóstico em branco e com diagnóstico válido; o banco deve rejeitar os dois primeiros.
6. Tentar encerrar retorno recebido sem passar por análise; confirmar rejeição.
7. Tentar editar retorno já encerrado; confirmar rejeição.
8. Tentar atualizar retorno associado a outra garantia; confirmar rejeição.
9. Testar garantia vencida: registrar reclamação, analisar e classificar fora da cobertura conforme regra definida.
10. Conferir eventos de criação/alteração com ator e timestamp; verificar que usuário sem papel não lê ou grava.
11. Consultar portal com token válido e confirmar que somente `customer_update`, status e datas são expostos, sem diagnóstico, resolução, peças ou mão de obra interna.
12. Testar expiração e revogação do token e isolamento entre OS distintas.

## Limites e próximos passos

- Esta é uma auditoria estática, não um teste funcional do banco.
- As duas falhas de validação devem ser corrigidas na camada de banco/RPC para que chamadas diretas não contornem a regra.
- `AGENTS.md` proíbe editar manualmente `supabase/migrations/` e `drizzle/`; não foram alterados arquivos de migration nem simulada uma correção no frontend.
- O usuário não autorizou uso de Lovable, acesso ao Supabase, execução de migrações ou deploy; nenhuma dessas ações foi realizada.
- Nenhum dado de produção foi acessado ou alterado.
