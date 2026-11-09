# Versão oficial Android — Cleidson Diesel

O workflow `Build Cleidson Diesel official Android release` gera um APK de release assinado e um Android App Bundle (AAB) assinado. O AAB é o formato normalmente enviado ao Google Play.

## 1. Criar a chave de assinatura

Faça isso em um computador confiável com Java instalado. Guarde o arquivo `cleidson-diesel-release.jks` em local seguro e mantenha uma cópia de backup. **Não envie o arquivo .jks ao GitHub, não o coloque no código e não compartilhe as senhas no chat.** Perder essa chave pode impedir atualizações futuras do mesmo aplicativo.

Execute:

```bash
keytool -genkeypair -v -keystore cleidson-diesel-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias cleidson-diesel
```

Converta o arquivo em Base64 para cadastrar o conteúdo como secret:

```bash
base64 -w 0 cleidson-diesel-release.jks
```

No macOS, use `base64 < cleidson-diesel-release.jks | tr -d '\n'`.

## 2. Cadastrar os secrets no GitHub

No repositório, abra **Settings → Secrets and variables → Actions → New repository secret** e crie estes quatro secrets:

- `ANDROID_KEYSTORE_BASE64`: saída Base64 do arquivo JKS.
- `ANDROID_KEYSTORE_PASSWORD`: senha do keystore.
- `ANDROID_KEY_ALIAS`: neste comando, `cleidson-diesel`.
- `ANDROID_KEY_PASSWORD`: senha da chave (pode ser a mesma do keystore, se assim foi definida).

Não coloque valores desses secrets em arquivos, commits, issues ou mensagens.

## 3. Gerar a versão assinada

Depois de cadastrar os quatro secrets, abra **Actions → Build Cleidson Diesel official Android release → Run workflow**. A execução gera:

- APK assinado para instalação direta em Android.
- AAB assinado para envio ao Google Play Console.

Os arquivos ficam em **Artifacts** da execução. A geração não publica automaticamente na Play Store nem cria um lançamento público no GitHub.

## Observações

- Mantenha a mesma chave de assinatura em todas as atualizações futuras.
- Antes de distribuir, teste o APK em um aparelho real e valide login, navegação, agendamentos e orçamentos.
- A versão de teste/debug anterior não substitui a versão release assinada.
