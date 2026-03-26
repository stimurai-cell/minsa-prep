type AuthErrorLike = {
  message?: string | null;
  code?: string | number | null;
};

const normalizeMessage = (message: string) => message.trim().toLowerCase();

export function translateAuthError(
  error: unknown,
  fallback = 'Nao foi possivel concluir esta acao agora. Tente novamente.'
) {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as AuthErrorLike | null | undefined)?.message === 'string'
          ? String((error as AuthErrorLike).message)
          : '';

  const message = normalizeMessage(rawMessage);

  if (!message) {
    return fallback;
  }

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha incorretos. Confira os dados e tente novamente.';
  }

  if (message.includes('email not confirmed')) {
    return 'O seu email ainda nao foi confirmado. Verifique a caixa de entrada e tente novamente.';
  }

  if (
    message.includes('user already registered') ||
    message.includes('already been registered')
  ) {
    return 'Ja existe uma conta com este email. Entre na plataforma ou recupere a sua senha.';
  }

  if (
    message.includes('password should be at least') ||
    message.includes('password is too short')
  ) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (
    message.includes('auth session missing') ||
    message.includes('session missing')
  ) {
    return 'A sessao de recuperacao nao foi encontrada ou expirou. Peca um novo link de recuperacao.';
  }

  if (
    message.includes('token has expired') ||
    message.includes('link is invalid or has expired') ||
    message.includes('otp expired') ||
    message.includes('expired')
  ) {
    return 'O link enviado expirou ou ja foi usado. Peca um novo email de recuperacao.';
  }

  if (
    message.includes('same password') ||
    message.includes('different from the old password')
  ) {
    return 'Escolha uma senha diferente da atual.';
  }

  if (
    message.includes('unable to validate email address') ||
    message.includes('invalid email')
  ) {
    return 'Informe um email valido.';
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Foram feitas muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.';
  }

  if (message.includes('database error saving new user')) {
    return 'Nao foi possivel criar a conta agora. Tente novamente em instantes.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network request failed')
  ) {
    return 'Falha de ligacao. Verifique a internet e tente novamente.';
  }

  if (message.includes('signup is disabled')) {
    return 'O cadastro esta temporariamente indisponivel.';
  }

  if (message.includes('email rate limit exceeded')) {
    return 'Aguarde um pouco antes de pedir outro email.';
  }

  return rawMessage || fallback;
}
