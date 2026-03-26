# Templates de Email - MINSA Prep

Use estes textos no painel do Supabase para deixar a comunicacao mais humana, clara e com a marca do produto.

## Onde alterar

No painel do Supabase:

1. Abra o projeto do MINSA Prep.
2. Entre em `Authentication`.
3. Abra `Email Templates`.
4. Edite o assunto e o corpo do template desejado.

Se quiser personalizar o nome do aluno, aproveite `full_name` que ja e enviado no cadastro.

Exemplo:

```txt
{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}Estudante{{ end }}
```

## Recuperacao de senha

### Assunto

```txt
MINSA Prep | Redefina a sua senha com seguranca
```

### Corpo HTML

```html
<h2 style="margin:0 0 12px;color:#0f172a;">MINSA Prep</h2>
<p>Ola, {{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}Estudante{{ end }}.</p>
<p>Recebemos um pedido para redefinir a senha da sua conta.</p>
<p>Se foi voce, toque no botao abaixo para criar uma nova senha com seguranca.</p>
<p style="margin:24px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;">
    Redefinir minha senha
  </a>
</p>
<p>Se nao foi voce, pode ignorar esta mensagem. A sua conta continua protegida.</p>
<p style="margin-top:24px;color:#475569;">Equipe MINSA Prep</p>
```

## Confirmacao de conta

### Assunto

```txt
MINSA Prep | Confirme o seu email e comece a estudar
```

### Corpo HTML

```html
<h2 style="margin:0 0 12px;color:#0f172a;">Bem-vindo ao MINSA Prep</h2>
<p>Ola, {{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}Estudante{{ end }}.</p>
<p>A sua conta esta quase pronta. Falta apenas confirmar este email.</p>
<p style="margin:24px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
    Confirmar email
  </a>
</p>
<p>Depois disso, voce entra no MINSA Prep e segue direto para o inicio dos estudos.</p>
<p style="margin-top:24px;color:#475569;">Conte conosco na sua preparacao.</p>
```

## Magic Link / Login sem senha

### Assunto

```txt
MINSA Prep | O seu acesso rapido esta pronto
```

### Corpo HTML

```html
<h2 style="margin:0 0 12px;color:#0f172a;">Acesso rapido ao MINSA Prep</h2>
<p>Ola, {{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}Estudante{{ end }}.</p>
<p>Use o botao abaixo para entrar na sua conta sem digitar a senha.</p>
<p style="margin:24px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">
    Entrar agora
  </a>
</p>
<p>Se voce nao pediu este acesso, ignore esta mensagem.</p>
```

## Alteracao de email

### Assunto

```txt
MINSA Prep | Confirme o seu novo email
```

### Corpo HTML

```html
<h2 style="margin:0 0 12px;color:#0f172a;">Confirmacao de novo email</h2>
<p>Recebemos um pedido para trocar o email associado a sua conta MINSA Prep.</p>
<p>Se foi voce, confirme o novo endereco clicando no botao abaixo.</p>
<p style="margin:24px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;">
    Confirmar novo email
  </a>
</p>
<p>Se nao reconhece este pedido, ignore a mensagem e revise a seguranca da sua conta.</p>
```

## Convite

### Assunto

```txt
MINSA Prep | Voce foi convidado para entrar
```

### Corpo HTML

```html
<h2 style="margin:0 0 12px;color:#0f172a;">Convite para o MINSA Prep</h2>
<p>Voce recebeu um convite para entrar na plataforma.</p>
<p>Ao aceitar, tera acesso ao ambiente de estudo, revisao e treino do MINSA Prep.</p>
<p style="margin:24px 0;">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:700;">
    Aceitar convite
  </a>
</p>
<p>Se este convite nao faz sentido para voce, pode ignorar com tranquilidade.</p>
```

## Nota pratica

Se quiser que eu tente aplicar estes templates diretamente no projeto do Supabase, o caminho tecnico mais seguro e usar acesso de gestao do Supabase com `SUPABASE_ACCESS_TOKEN` e rede liberada para essa operacao.
