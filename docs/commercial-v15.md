# PROXITI V15 · Operação comercial vinculada aos chamados

Este módulo é **administrativo e interno**. O painel existente continua responsável por autenticação, chamados, conversa, agenda, equipe, relatórios técnicos e UNIPROXITI. A V15 adiciona a cadeia catálogo → proposta → confirmação documentada → recebimento/estorno manual → repasse planejado/registrado, vinculada ao mesmo chamado.

## Como usar

1. Ative e confirme **MFA (verificação em duas etapas)** na conta de administrador. As RPCs que alteram valores, propostas, lançamentos ou repasses exigem sessão AAL2 no Supabase. Sem MFA, a leitura administrativa pode funcionar, mas qualquer gravação é recusada no servidor.
2. Acesse **Comercial** pela barra lateral ou, ao abrir um chamado, use **Orçar chamado**. O módulo está oculto para técnicos e outros perfis. Não existe preço padrão inventado.
3. Em **Catálogo**, cadastre código, escopo, unidade, duração estimada, preço de referência, custo interno estimado e previsão de repasse, todos em BRL. Os valores são armazenados em **centavos inteiros**. Marque o serviço como ativo somente quando estiver pronto para novas propostas.
4. Selecione o chamado e crie um **rascunho** com validade e condições destinadas ao cliente. Adicione itens do catálogo, quantidade inteira e eventual ajuste unitário com justificativa. O servidor copia os campos financeiros para o orçamento. Mudanças futuras de preço do catálogo **não alteram o orçamento existente**.
5. Revise e imprima o documento. Enquanto o orçamento estiver em rascunho, a prévia exibirá **RASCUNHO INTERNO · NÃO ENVIAR**. O documento impresso não inclui custos internos, previsão de repasse, observações privadas, comprovantes ou dados pessoais desnecessários.
6. Envie ao cliente pelo canal autorizado **fora do módulo**. Só depois registre **Registrar envio**, informando o canal e referência verificável. O sistema não envia propostas sozinho.
7. Apenas após receber resposta real do cliente, use **Registrar aceite** ou **Registrar recusa**, com referência. Não invente uma autorização ou registre uma aceitação apenas porque a proposta foi aberta. O aceite de proposta vencida é bloqueado. Uma proposta enviada não pode ter seus itens alterados; se o cliente pedir serviço adicional, crie um **aditivo** associado ao orçamento aceito.
8. Com proposta aceita, registre um **recebimento ou estorno** efetivamente ocorrido, informando valor, meio e referência de comprovante. O servidor rejeita recebimento acumulado superior ao orçamento e estorno superior ao saldo líquido. Referências repetidas para o mesmo orçamento, tipo e meio são bloqueadas.
9. Para planejar o repasse, o parceiro precisa estar ativo e atribuído ao chamado. Informe o valor realmente acordado e a referência do acordo. **Planejado não é pago.** Só marque como pago após realizar a transferência e conferir o comprovante.
10. Em **Relatórios**, a administração pode consultar valores globais aceitos, recebidos e repassados, além dos indicadores de chamados já existentes. Não trate esses valores como saldo bancário ou lucro líquido contábil.

## Estrutura e proteção

Arquivos: \`assets/commercial-core.js\`, \`assets/commercial-v15.js\`, \`assets/commercial-v15.css\`, \`supabase/commercial_operations_v15.sql\`, \`supabase/commercial_hardening_v15_1.sql\` e testes dedicados. O esquema foi aplicado ao Supabase por migração aditiva, **sem apagar ou transformar registros anteriores**.

Tabelas privadas: \`commercial_services\`, \`commercial_quotes\`, \`commercial_quote_items\`, \`commercial_quote_events\`, \`commercial_payments\`, \`commercial_partner_payouts\` e \`commercial_service_audit\`. Todas têm RLS e leitura administrativa. \`anon\` não recebe leitura, e usuários autenticados não recebem INSERT/UPDATE/DELETE direto. Escritas passam por RPCs de administração com MFA. O catálogo mantém trilha de alterações de valores.

A versão dos itens emitidos não depende de preço atual do catálogo. O log de orçamento registra criação, inclusão/exclusão de itens, envio, aceite, recusa, cancelamento, recebimentos, estornos e alterações de repasse. Dados monetários não são enviados a provedores de IA nem armazenados em \`localStorage\`.

## O que o módulo **não** faz

- **Não** envia mensagem ou proposta automaticamente ao cliente. A confirmação registrada pelo administrador documenta um aceite ocorrido por outro canal; **não é assinatura eletrônica do próprio cliente**.
- **Não** recebe pagamento, concilia extrato, realiza transferência, cobra cartão, gera link de cobrança, emite nota fiscal nem calcula tributos. As tabelas guardam **lançamentos manuais**; a confirmação bancária ou fiscal exige processo separado.
- **Não** define preços, taxas, percentuais de repasse, prazo de pagamento ou modalidade jurídica de parceria. Essas condições precisam ser preenchidas e combinadas pelo responsável antes do serviço.
- **Não** libera automaticamente a execução do técnico ao aprovar o orçamento. A Central continua exigindo o fluxo próprio de autorização do chamado, diagnóstico e registros técnicos.
- **Não** substitui contrato, documento fiscal ou controles de obrigações legais. O registro de valores é operacional, não aconselhamento jurídico ou contábil.

## Homologação antes do uso financeiro real

- Administrador com MFA: cadastrar serviço real, editar preço após emitir orçamento e confirmar que o valor antigo permanece.
- Conta de técnico comum: conferir ausência do menu e bloqueio de leitura e execução de RPC comercial.
- Dois navegadores: orçamento criado no primeiro deve aparecer no segundo sem dados de outra conta.
- Cliente real autorizado: confirmar envio, escopo e resposta por canal verificável antes de registrar aceite no painel.
- Recebimentos: registrar pagamento parcial, impedir duplicidade e valor acima do orçamento; testar estorno parcial documentado.
- Parceiros: conferir atribuição, acordo de repasse, comprovante antes de marcar como pago e proibição de alterações no pagamento registrado.
- Falha de rede no momento de gravar: conferir histórico no servidor **antes** de tentar de novo, para evitar lançamentos duplicados.
- Backup: configurar exportação privada e restauração testada do catálogo, itens versionados, eventos e lançamentos. **O GitHub não é backup dos valores do Supabase**.
- Desktop e mobile: verificar layout com usuário autenticado e tema claro/escuro. O teste automatizado usa dados sintéticos e não substitui contas reais.

## Próximas integrações para uma operação ponta a ponta

Uma fase posterior pode criar envio transacional, aceite eletrônico do próprio cliente e integração com provedor de pagamento que ofereça webhooks assinados e reconciliação idempotente. Também faltam consolidar um cadastro de clientes com gestão de consentimento, regras de despacho por especialidade/disponibilidade, alertas fora do navegador, portfólio individual e rotinas regulares de backup e restauração. **Não considerar esses itens implantados a partir da existência do módulo Comercial.**
