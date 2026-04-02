# Fluxo de Revisao de Questoes

Este fluxo reforca a qualidade das questoes sem desmontar o pipeline atual do MINSA Prep.

## Objetivos

- Bloquear erros tecnicos antes da gravacao.
- Verificar se a questao esta adequada a area e ao topico.
- Permitir que os utilizadores reportem inconsistencias em tempo real.
- Dar ao admin uma fila clara para investigar, corrigir ou remover itens.

## Fluxo atualizado

1. Geracao primaria
- A IA gera o lote no formato habitual.
- Continuam ativas as validacoes estruturais existentes: quantidade, 4 alternativas, 1 correta, duplicidade e semelhanca excessiva.

2. Revisao tecnica por area
- Cada lote passa por uma segunda revisao automatica com persona tecnica orientada pela area.
- O revisor investiga gabarito incorreto, explicacao fraca, inversao de conceitos, desvio da area e desvio do topico.
- Itens inseguros devem ser rejeitados ou reescritos antes de seguir.

3. Base bibliografica minima
- Toda explicacao aprovada deve terminar com uma base bibliografica curta.
- O objetivo e deixar rastreio tecnico contra alucinacao sem pesar a experiencia do aluno.

4. Gravacao
- So entram no banco as questoes que passaram nas validacoes e na revisao tecnica.

5. Curadoria em producao
- O utilizador pode reportar inconsistencia ao final da questao.
- O report guarda snapshot da questao, area, topico e justificacao.
- O admin recebe uma fila dedicada para marcar em revisao, resolver, descartar ou remover a questao do banco.

## O que observar na operacao

- Se uma area gerar muitos reports de "fora da area" ou "fora do topico", rever os prompts dessa area.
- Se uma area gerar muitos reports de "gabarito incorreto", reforcar fontes e exemplos no prompt especialista.
- Em areas de alta especialidade, usar topicos mais especificos sempre que possivel.
