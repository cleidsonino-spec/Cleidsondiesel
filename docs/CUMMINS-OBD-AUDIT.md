# Auditoria do catálogo Cummins OBD

Auditoria **somente leitura** dos 532 DTCs do motor Cummins ISB6.7 CM2350 B101 em `public.technical_fault_codes`.

## Verificações
- Colunas esperadas da tabela.
- Quantidade de registros para engine/document configurados.
- Códigos duplicados.
- Valores permitidos de `information_status`.
- Campos `fault_name` e `source_section` preenchidos.
- Relatórios JSON e Markdown publicados como artefatos do GitHub Actions.

## Segurança
- Transação PostgreSQL `READ ONLY`.
- Nenhum INSERT, UPDATE ou DELETE.
- Nenhuma alteração dos registros existentes.
- Não marca códigos como tecnicamente validados.
- Não utiliza a service-role key do Supabase.

## Configuração
Em GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
Crie o secret `SUPABASE_DB_URL` com a connection string PostgreSQL do Supabase. Prefira usuário de leitura dedicado, com SELECT apenas em `public.technical_fault_codes`.

Nunca coloque a connection string em arquivos, commits, issues ou mensagens. Sem o secret, o workflow falha explicitamente sem tocar no banco.

## Execução
Manual: **Actions → Cummins OBD catalog audit → Run workflow**.
Agendada: semanalmente às segundas-feiras às 11:00 UTC.

## Limite desta etapa
Esta rotina verifica integridade estrutural, não valida tecnicamente os 532 diagnósticos. Isso exige evidência rastreável no manual Cummins (página/seção e conteúdo correspondente) e revisão antes de alterar o status de qualquer código.
