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
      return 'Administrador';
    case 'premium':
      return 'Premium';
    case 'free':
      return 'Estudante';
    default:
      return 'Utilizador';
  }
};
