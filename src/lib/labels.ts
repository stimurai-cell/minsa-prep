export const getDifficultyLabel = (difficulty?: string) => {
  switch (difficulty) {
    case 'mixed':
      return 'Misto';
    case 'easy':
      return 'Facil';
    case 'medium':
      return 'Normal';
    case 'hard':
      return 'Dificil';
    default:
      return 'Nao definida';
  }
};

export const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'admin':
      return 'Administrador (MAX)';
    case 'elite':
      return 'Elite (Aprovação)';
    case 'premium':
      return 'Premium (Preparação Real)';
    case 'basic':
      return 'Basic (Estudante)';
    case 'free':
      return 'Gratuito';
    default:
      return 'Utilizador';
  }
};
