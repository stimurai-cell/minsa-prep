# Acesso local ao Supabase e testes assistidos

Este projeto ja aceita credenciais locais via `.env.local`.

Preencha estas variaveis quando quiser que o Codex consiga operar com mais profundidade:

```env
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
DATABASE_URL=
E2E_BASE_URL=https://minsa-prep.vercel.app
E2E_EMAIL=
E2E_PASSWORD=
```

## Como obter cada credencial

### 1. `SUPABASE_PROJECT_REF`
- Abra o painel do Supabase.
- Entre no projeto.
- Veja o subdominio do projeto.
- Exemplo: em `https://abcdefg.supabase.co`, o `PROJECT_REF` e `abcdefg`.

### 2. `SUPABASE_ACCESS_TOKEN`
- No painel do Supabase, clique no seu avatar.
- Entre em `Account Settings`.
- Abra `Access Tokens`.
- Crie um novo token pessoal.
- Copie e cole em `SUPABASE_ACCESS_TOKEN`.

### 3. `SUPABASE_DB_PASSWORD`
- No projeto do Supabase, abra `Project Settings`.
- Entre em `Database`.
- Procure a senha da base ou redefina a senha se necessario.
- Guarde esse valor em `SUPABASE_DB_PASSWORD`.

### 4. `DATABASE_URL`
- No projeto do Supabase, abra `Project Settings`.
- Entre em `Database`.
- Copie a `Connection string`.
- Prefira o formato `URI`.
- Cole em `DATABASE_URL`.

### 5. `E2E_EMAIL` e `E2E_PASSWORD`
- Crie uma conta de teste dedicada.
- Dê preferencia a uma conta Elite separada da sua conta pessoal.
- Use essa conta apenas para reproduzir fluxos do app.

## O que isso desbloqueia

Com `DATABASE_URL`:
- aplicar patches `.sql` direto do terminal;
- verificar colunas, indices, RLS e dados reais;
- diagnosticar erros silenciosos do banco.

Com `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`:
- operar o projeto com Supabase CLI;
- validar link do projeto e schema localmente.

Com `E2E_EMAIL` e `E2E_PASSWORD`:
- testar login real com conta de teste;
- reproduzir fluxos de onboarding, Elite e plano;
- automatizar testes depois, se quisermos adicionar Playwright.

## Recomendações de seguranca

- Nao use a sua conta principal para testes.
- Nao envie segredos no chat se puder evitar.
- Guarde tudo em `.env.local`, que ja esta ignorado pelo Git.
- Se algum segredo sensivel tiver sido exposto fora da sua maquina, rode a rotacao dessa chave no fornecedor.

## Comandos que eu poderei usar depois

Aplicar SQL com `psql`:

```powershell
psql "$env:DATABASE_URL" -f .\sql\2026-03-17-elite_plan_workflow_patch.sql
```

Validar conexao:

```powershell
psql "$env:DATABASE_URL" -c "select now();"
```

Quando estas variaveis estiverem preenchidas, eu consigo seguir com testes reais de banco e fluxo.
