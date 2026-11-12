# Auditoria da interface e dos fluxos operacionais — PR #54

Data: 2026-11-12  
Branch: `integration/modulos-oficina-main`

## Escopo revisado

Revisão estática das telas de financeiro, estoque, recebimento, desempenho dos mecânicos, agendamentos, atribuição de mecânicos, garantia, portal do cliente e abertura de OS a partir de agendamento.

## Correção realizada

### Conversão de agendamento em ordem de serviço

Arquivo: `src/routes/_authenticated/painel.ordens.nova.tsx`

Problema encontrado:
- A tela inseria a OS e, em seguida, tentava marcar o agendamento como `concluido`.
- O erro da atualização do agendamento era ignorado.
- Assim, a OS podia ser criada com sucesso enquanto a agenda continuava mostrando o agendamento como ativo, sem aviso ao operador. Isso poderia levar a uma segunda tentativa de conversão.

Correção:
- A atualização do agendamento agora captura e registra o erro.
- Se a OS foi criada, mas a atualização do agendamento falhou, a tela informa explicitamente que a OS existe e que o agendamento precisa ser conferido antes de abrir outra OS.
- Se ambas as operações concluírem, a mensagem confirma a conversão.
- A agenda é invalidada após a tentativa, para buscar o estado atualizado.

Limite:
- A criação da OS e a atualização do agendamento continuam sendo duas operações separadas no cliente, não uma transação atômica no banco. O aviso reduz o risco operacional, mas uma solução transacional exigiria uma RPC/migração e validação específica em ambiente de teste.

## Outros pontos observados

### Financeiro
- A tela restringe o acesso ao administrador, consulta pagamentos e despesas paginados em lotes e diferencia recebimento efetivo de aprovação de orçamento.
- O formulário limita o pagamento ao saldo calculado na interface; a proteção definitiva permanece na validação do banco.
- O saldo exibido é saldo do período (recebimentos menos despesas), não lucro líquido.

### Estoque
- A tela limita o acesso ao administrador e gera chave idempotente para cada tentativa de movimentação.
- O banco permanece responsável pelo bloqueio de saldo negativo e pela integridade concorrente.
- O cadastro de item e fornecedor usa inserções diretas; duplicidade por repetição do envio ainda depende das restrições do banco e da experiência de erro.
- O formulário de movimentação consulta o usuário autenticado antes de inserir e envia a chave idempotente exigida pelo schema.

### Recebimento
- A tela restringe a operação a admin/secretaria, exige OS, nome de quem entregou/recebeu, confirmação, hodômetro/horímetro e condição externa.
- Fotos são opcionais e, nesta versão, apenas URLs já hospedadas são aceitas; não há upload direto de arquivos.
- A confirmação por nome e checkbox é um registro operacional, não assinatura certificada nem comprovação independente da identidade.

### Desempenho dos mecânicos
- O relatório conta registros de conclusão por mecânico, usa paginação e filtro de datas e não calcula comissões ou faturamento.
- Os nomes são carregados a partir dos convites aceitos; quando não há nome correspondente, a interface usa “Mecânico não identificado”.

### Agenda e atribuição
- A agenda oferece confirmação, chegada, falta, cancelamento, lembrete manual por WhatsApp e abertura explícita de OS.
- A atribuição de mecânico usa RPC e atualiza as consultas da ordem.
- A conversão de agendamento em OS agora apresenta falha parcial em vez de ocultá-la.

### Garantia e portal
- A tela de garantia preserva histórico e encaminha retornos pela RPC específica.
- O portal gera token individual, permite copiar/compartilhar e revogar acesso.
- A posse do link continua sendo o mecanismo de acesso; não é prova independente da identidade de quem o utiliza.

## Validação pendente

- Executar testes de integração em ambiente de teste para a falha parcial entre criação de OS e atualização do agendamento.
- Testar repetição rápida/duplo clique na conversão e verificar restrições de unicidade no banco.
- Testar os fluxos com perfis reais de admin, secretaria e mecânico, incluindo chamadas diretas à API.
- Executar os testes de banco/RLS e uma instalação limpa com a ordem documentada das migrações.

Nenhum banco foi acessado. Nenhuma migração foi aplicada. Nenhum deploy foi realizado. A alteração está somente na branch/PR de integração.
