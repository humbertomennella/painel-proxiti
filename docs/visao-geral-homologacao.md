# Visão Geral · critérios de entrega e operação

A primeira área da Central recebe validação própria. Este documento descreve o comportamento verificável do código. Não é declaração de homologação de uma sessão real com credenciais do titular.

## Contrato dos indicadores

- **Pendências não lidas:** quantidade de *chamados distintos* entre até 100 registros recentes acessíveis, excluindo encerrados. Conta chamados novos/triagem não vistos e, quando o perfil autoriza Chat e a sincronização está íntegra, mensagens do cliente posteriores à última leitura.
- Um chamado simultaneamente novo e com mensagem não lida representa **uma** pendência, tanto no card quanto no aviso do topo. A caixa de notificações não duplica o atendimento.
- **Novos e em triagem, Em atendimento, Aguardando cliente:** contagem dos registros com a situação correspondente. **Ativos:** novos, triagem, em atendimento e aguardando cliente. Resolvidos e encerrados não entram nesse total.
- O limite de 100 chamados está explícito na interface; nenhum dos cartões se apresenta como um total histórico global. São permitidos até 250 registros recentes de mensagens para a conferência. Quando há mais registros do que o limite, o total de pendências é apresentado como **desconhecido**, não como um número possivelmente falso.
- Quem possui acesso à fila, mas não ao chat, vê a contagem de *novos chamados não lidos*. O indicador não simula mensagens não autorizadas.

## Estados observáveis

- **Carregando:** números ainda não confirmados aparecem como travessões, nunca como zero implícito.
- **Atualizado:** consulta de chamados, recibos de leitura e, quando autorizado, mensagens concluídas; mostra hora da última consulta.
- **Parcial:** mensagens, recibos ou volume acima do limite impedem uma contagem completa. O card de pendências indica desconhecido e o botão de atualização fica visível.
- **Erro:** mantém dados da última consulta confirmada com aviso de desatualização ou, se nenhuma consulta passou, mostra a indisponibilidade sem criar indicadores fictícios. Atualizar agora tenta novamente.
- **Acesso restrito/encerramento de sessão:** cartões de chamados, dados anteriores em tela e resumo temporário em memória são eliminados. Consultas iniciadas antes de mudança de permissão não podem repopular o painel.
- **Fila vazia confirmada:** indica 0, com texto de fila vazia. Diferente de falha de sincronização.

## Navegação e preferências

As ações levam à mesma fila e filtro que os indicadores representam. O cartão de retomada aparece apenas para um chamado já aberto e ainda em acompanhamento. Modo de foco mantém o atendimento, mas oculta recursos secundários; a leitura ampliada é salva por conta. O guia informa atalhos sem expor módulos bloqueados.

## Testes automatizados executáveis

- `node tests/central-integrity.mjs`: verifica sintaxe, IDs, contratos e o modelo puro (contagem dupla, encerrados, acesso restrito e dados incompletos).
- `node tests/browser-smoke.mjs`: Chrome/Chromium em 320, 375, 430, 768 e 1366 pixels; sem rolagem horizontal e com alvos de toque adequados.
- `node tests/overview-functional.mjs`: usa **sessões e dados simulados apenas no navegador**, sem credenciais ou dados reais, para exercitar duplicidade, erros, recuperação, filtros, permissões, mudança de acesso, retomada e layout carregado nos dois temas. Grava capturas de revisão em 375 e 1366 pixels.

## Etapa de validação com a conta do titular

Abra a Central no celular e no computador com sua própria conta, confirme os dois temas, teste os botões de leitura/foco/ajuda, abra um chamado permitido e retorne à Visão Geral. Compare os indicadores com a fila autorizada e confirme que as mensagens realmente lidas deixam de contar. Esta validação usa a sessão legítima e não exige compartilhar senhas, códigos MFA nem dados de clientes. A homologação de ambiente real deve ser registrada separadamente antes de declarar a área universalmente concluída.

**Escopo desta etapa:** não altera históricos de atendimento, configuração do Supabase, permissões concedidas ou conteúdo de outras áreas. A próxima área funcional é Chamados.
