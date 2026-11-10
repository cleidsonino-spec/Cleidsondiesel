# Login Google no aplicativo Android

O aplicativo usa o broker OAuth do Lovable e, no Android, abre o fluxo no navegador do sistema. O retorno usa um Android App Link HTTPS verificado para evitar entregar tokens a um esquema de URL personalizado.

## Alterações

- O login web continua usando `@lovable.dev/cloud-auth-js`.
- No Android, o app inicia `/~oauth/initiate` no navegador do sistema, com `state` aleatório salvo localmente.
- O app recebe o retorno em `https://cleidsondiesel.lovable.app/auth`, valida o `state` e grava a sessão no Supabase.
- O Android só deve abrir automaticamente o link depois que o domínio publicar o arquivo de associação.

## Etapa obrigatória: publicar o arquivo de associação

O workflow **Build Cleidson Diesel official Android release** agora inclui `assetlinks.json` nos artefatos, calculado a partir do certificado de assinatura real do APK.

1. Execute o workflow na branch `fix/android-google-oauth-deeplink`.
2. Baixe o artefato `cleidson-diesel-official-android` e extraia o arquivo `assetlinks.json`.
3. Adicione esse arquivo ao repositório em `public/.well-known/assetlinks.json` (crie as pastas, se necessário) e publique o site.
4. Confirme que `https://cleidsondiesel.lovable.app/.well-known/assetlinks.json` abre o JSON sem redirecionamento nem autenticação.
5. Gere/instale o APK assinado depois que a associação estiver publicada.

O fingerprint SHA-256 é público e corresponde ao certificado do APK; não compartilhe o arquivo JKS nem as senhas.

## Configuração de autenticação

O URL de retorno usado é `https://cleidsondiesel.lovable.app/auth`. Ele precisa continuar permitido na lista de Redirect URLs do backend Lovable. Não altere o callback autorizado do Google: o Google continua retornando ao broker Lovable, e o broker retorna ao app.

## Teste

1. Abra o app instalado.
2. Entre em **Continuar com o Google**.
3. Escolha a conta no navegador.
4. O Android deve reabrir Cleidson Diesel e encaminhar ao painel.

A associação do domínio e a publicação do site são pré-requisitos; sem eles, o navegador continuará abrindo a página web.
