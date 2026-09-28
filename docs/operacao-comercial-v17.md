# PROXITI V17 · Precificação e acompanhamento comercial

Este incremento utiliza a operação Comercial V15, o cadastro Clientes V16 e os chamados existentes. Não cria um segundo catálogo, não altera a estrutura do Supabase e não modifica valores já registrados.

## O que foi adicionado

- **Formação de preço:** simulador administrativo que considera custo da hora técnica, minutos previstos, deslocamento, materiais, outras despesas, repasse previsto do parceiro, taxa percentual do recebimento e margem de contribuição desejada. Entradas em reais e percentuais usam vírgula decimal, sem ponto de milhar; o motor calcula exclusivamente com centavos inteiros e pontos-base.
- **Preço de referência:** o cálculo incorpora taxa e margem sobre o preço final, com arredondamento conservador em centavos. O resultado mostra mão de obra, custo interno total, repasse previsto, taxa estimada e contribuição antes de demais despesas e tributos.
- **Controle explícito:** preencher o formulário do catálogo exige clique específico; gravar o serviço continua exigindo confirmação administrativa e MFA no servidor. Alterar um custo invalida a simulação anterior. A prévia não usa `localStorage`, não chama IA e não envia dados a terceiros.
- **Próximas ações comerciais:** cartões administrativos para propostas vencidas, aguardando resposta, em rascunho e aceitas. A lista abre o orçamento existente e nunca altera status automaticamente. Os números referem-se **somente às propostas carregadas**; o módulo oferece paginação e avisa quando há mais histórico.

## Limites importantes

A margem estimada não é lucro líquido. Ela não substitui apuração de impostos, despesas fixas não informadas, conciliação bancária, documentação fiscal ou análise jurídica/contábil. O sistema não inventa preço, percentual ou prazo de repasse. O valor definitivo é cadastrado pelo administrador e copiado como snapshot imutável para cada orçamento.

**O que já existia antes da V17:** cadastro privado de serviços, orçamento com aditivo, envio e aceite documentados manualmente, registro de recebimento e estorno, repasses planejados e pagos e CRM com vínculo explícito ao chamado. Esses recursos foram preservados.

## Pendências reais para operar de ponta a ponta

A consulta ao Supabase em 28/09/2026 encontrou **zero** serviços, orçamentos, lançamentos, repasses e clientes consolidados cadastrados. Isto não é defeito do formulário: o responsável precisa cadastrar serviços e condições comerciais verdadeiros e homologar o fluxo com contas autorizadas. Não criar entradas fictícias no ambiente de produção.

1. **Ativação comercial:** administrador com MFA revisa escopo, preço, custos, forma de recebimento e acordo de repasse; cadastra os primeiros serviços reais e testa um atendimento autorizado.
2. **Aceite direto do cliente:** o módulo atual registra no painel um aceite real recebido por outro canal, mas não fornece assinatura eletrônica ou botão autenticado do cliente. Uma integração futura precisa de identidade do destinatário, evidência de consentimento, proteção contra repetição e trilha auditável.
3. **Cobrança e conciliação:** provedor de pagamentos, conta recebedora, modalidade fiscal e contratos precisam ser definidos pelo responsável; nenhuma cobrança ou transferência foi habilitada automaticamente. Integrações futuras precisam de webhooks autenticados, registros idempotentes e reversão.
4. **Notificações quando a Central está fechada:** dependem da ativação de serviço transacional e do domínio remetente; não são equivalentes a alertas do navegador com a Central aberta.
5. **Parceiros e despacho:** definir critérios de disponibilidade, especialidade, região e autorização antes de automatizar distribuição. Certificação UNIPROXITI não concede automaticamente permissão ou vínculo contratual.
6. **Recuperação e privacidade:** backup privado, restauração ensaiada, política de retenção, auditoria administrativa e testes com conta de cliente, técnico e administrador reais antes de produção financeira.

## Homologação automatizada

`tests/commercial-v17-integrity.mjs` verifica arredondamento, margens, entradas inválidas, IDs e isolamento da simulação. `tests/commercial-functional.mjs` verifica que simular não cadastra, que alterações invalidam a prévia, que aplicar exige clique explícito, que o acompanhamento muda quando a proposta é enviada/aceita, que o estado é limpo no logout e que os cartões cabem nas larguras móveis testadas. Os testes existentes V15 e das demais áreas continuam obrigatórios.

Verificações por navegador usam dados sintéticos e não substituem os testes de produção com autorização real. Não declarar a plataforma 100% operacional até concluir esses itens.
