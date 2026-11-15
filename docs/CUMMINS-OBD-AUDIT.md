# Auditoria do catálogo Cummins OBD

Auditoria **somente leitura** dos 532 DTCs do motor Cummins ISB6.7 CM2350 B101 em `public.technical_fault_codes`.

## Verificações
- Quantidade exata de registros via cabeçalho Content-Range do PostgREST.
- Todos os registros do filtro engine/document foram recuperados.
- Códigos duplicados.
- Valores permitidos de `information_status`.
- Campos `fault_name` e `source_section` preenchidos.
- Relatórios JSON e Markdown publicados como artefatos do GitHub Actions.

## Conexão sem DB URL
A rotina usa HTTPS pela API REST oficial do Supabase (`/rest/v1`). Não usa connection string PostgreSQL, senha de banco, Hyperdrive nem service-role key.

Configure em GitHub **Settings → Secrets and variables → Actions**:
- `SUPABASE_URL`: URL HTTPS do projeto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: chave publishable (ou anon key legada) do projeto.

A chave publishable/anon é destinada a uso público e **não contorna RLS**. A consulta só funcionará se as políticas RLS permitirem SELECT anônimo nessa tabela. Se a tabela exigir usuário autenticado, o workflow falhará de forma segura; não substitua por service-role key. Nesse caso, a alternativa é uma Edge Function autenticada com segredo guardado no Supabase, ou um usuário técnico de leitura autenticado.

## Segurança
- Apenas requisição HTTP GET.
- Nenhum INSERT, UPDATE ou DELETE.
- Nenhuma alteração dos registros existentes.
- Não marca códigos como tecnicamente validados.

## Execução
Manual: **Actions → Cummins OBD catalog audit → Run workflow**.
Agendada: semanalmente às segundas-feiras às 11:00 UTC.

## Limite desta etapa
Esta rotina verifica integridade estrutural, não valida tecnicamente os 532 diagnósticos. Isso exige evidência rastreável no manual Cummins (página/seção e conteúdo correspondente) e revisão antes de alterar o status de qualquer código.
