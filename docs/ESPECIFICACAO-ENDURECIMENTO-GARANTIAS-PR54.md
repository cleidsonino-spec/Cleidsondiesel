# Especificação — endurecimento das regras de garantia

Data: 2026-11-12  
Relacionada à auditoria: `docs/AUDITORIA-GARANTIA-RETORNOS-PR54.md`

## Objetivo

Tornar as regras de encerramento de retorno e emissão de garantia obrigatórias no banco, e não somente na interface. A API direta deve obedecer às mesmas regras apresentadas ao operador.

## Regra 1 — diagnóstico obrigatório para encerrar retorno

Na função `public.register_warranty_return`, antes de atualizar um retorno para `resolved` ou `not_covered`:

- exigir `char_length(trim(coalesce(_diagnosis, ''))) >= 3` (ou mínimo definido pelo responsável técnico);
- manter a exigência existente de solução/justificativa com pelo menos 3 caracteres;
- aplicar validação dentro da mesma transação e antes do UPDATE;
- manter o bloqueio de encerramento direto a partir de `received`: o retorno precisa estar em `in_review`;
- manter a imutabilidade de retornos já encerrados;
- manter autoria via `auth.uid()` e o trigger de auditoria que grava o evento na mesma transação.

A validação de frontend deve continuar para orientar o operador, mas não substitui a validação da RPC. Não criar uma rota alternativa de escrita direta.

## Regra 2 — emissão somente quando a OS estiver pronta

A emissão de garantia deve ser validada no banco no INSERT de `public.warranties`, consultando a OS vinculada e exigindo status `pronto`, que corresponde à regra atual da interface (“Pronto p/ retirada”).

Requisitos de implementação:

- validar existência da OS e status permitido no banco;
- serializar a verificação com bloqueio de linha da OS (`SELECT ... FOR UPDATE`) para reduzir condição de corrida com mudança simultânea de status;
- não permitir que atualização de uma garantia existente transfira a garantia para outra OS ou altere sua data inicial/autoria, preservando o trigger de identidade existente;
- não alterar o status da OS como efeito colateral da emissão;
- manter RLS e permissões admin/secretaria atuais;
- não criar exceção para `entregue` sem decisão explícita de regra de negócio. O comportamento atual da UI aceita somente `pronto`.

A regra precisa considerar que a migration Drizzle 0006 cria a tabela e que a migration Supabase 20261113380000 adiciona controles posteriores. A alteração deve ser criada como migration nova e incremental, sem editar migrations históricas já versionadas.

## Requisitos de compatibilidade

- Não remover garantias nem retornos existentes.
- Não alterar datas, coberturas, termos ou vínculos históricos.
- Não mudar o conteúdo público do portal.
- Não expor diagnóstico, resolução, peças ou mão de obra interna no portal.
- Não converter aprovação de orçamento em garantia ou pagamento.
- Preservar o fluxo atual de admin/secretaria e a trilha de auditoria.

## Testes de aceitação obrigatórios

### Retorno em garantia
1. Criar retorno como `received` e avançar para `in_review`.
2. Chamar a RPC diretamente tentando encerrar sem diagnóstico: deve falhar.
3. Chamar a RPC diretamente tentando encerrar com diagnóstico em branco ou só espaços: deve falhar.
4. Encerrar com diagnóstico e solução válidos: deve concluir e registrar evento de auditoria.
5. Tentar encerrar diretamente a partir de `received`: deve falhar.
6. Tentar alterar retorno encerrado: deve falhar.
7. Confirmar que ator, timestamp e snapshots são gravados atomicamente.

### Emissão da garantia
1. Inserir garantia para OS `pronto`: deve permitir.
2. Inserir garantia para OS `recebido`, `em_analise`, `em_servico`, `entregue` ou `cancelado`: deve rejeitar, enquanto a regra de negócio permanecer limitada a `pronto`.
3. Tentar emissão por API direta: deve obedecer ao mesmo bloqueio.
4. Simular alteração concorrente do status da OS durante a emissão: a verificação deve ser serializada e não aceitar estado inválido.
5. Confirmar que a garantia existente continua vinculada à OS original e que sua identidade não pode ser alterada.

### Regressão e segurança
1. Testar perfis admin, secretaria, mecânico, usuário comum e anon.
2. Confirmar que somente admin/secretaria podem emitir/alterar garantia e registrar retorno.
3. Confirmar que o portal mantém somente campos públicos autorizados.
4. Confirmar que nenhuma garantia/retorno histórico é removido ou reescrito.

## Limites desta especificação

- Este documento não implementa a correção.
- `AGENTS.md` proíbe edição manual de `supabase/migrations/` e `drizzle/`; o usuário também não autorizou uso do Lovable nem acesso ao Supabase.
- Portanto, não foram alteradas migrations, não houve conexão ao banco, execução SQL, teste real de API ou deploy.
- A correção só poderá ser considerada pronta após migration incremental aprovada pelo fluxo autorizado e testes de aceitação em ambiente descartável/de homologação.
