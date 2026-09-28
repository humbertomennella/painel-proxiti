# Minha PROXITI V19 · Área gratuita do cliente e carteira do parceiro

## O que passa a existir

A nova página pública `https://proxiti.com.br/minha-proxiti/` oferece cadastro gratuito separado da Central Técnica (Auth Supabase), e-mail confirmado, login, recuperação de senha, perfil, equipamentos próprios, histórico de chamados, conversa vinculada à conta, solicitações remotas ou presenciais, pedido de agendamento, preferência de profissional e avaliação após atendimento. **O chat `/atendimento/` segue aberto sem cadastro**.

O cliente pode vincular uma conversa aberta sem login **somente** quando apresenta a chave privada ainda guardada no navegador que criou o chamado e o e-mail confirmado da conta é o mesmo do atendimento. Não vinculamos pessoas apenas por nome, telefone ou e-mail semelhante. O token privado nunca é impresso em URLs, não aparece na área de administração e pode ser apagado do navegador após o vínculo se o cliente quiser.

A Central Técnica mantém os perfis profissionais separados das contas de clientes. Na parte administrativa, é possível consultar contas, vincular a conta ao CRM existente após conferir o e-mail confirmado, revisar preferências e pedidos de horário e oferecer serviços a um parceiro aprovado. A oferta mostra escopo, modalidade, remuneração e referência do acordo; exige orçamento aceito e administrador com MFA. O parceiro **aceita ou recusa** sem designação por simples preferência do cliente. A carteira mostra apenas oportunidades próprias e chamados atribuídos. Ao concluir o serviço, o parceiro pode registrar fatos operacionais objetivos e privados sobre cumprimento de horários e necessidade de esclarecimento. Não há classificação pública de clientes, bloqueio automático nem exportação da carteira.

## Segurança e limites

- `supabase/customer_workspace_v19.sql`: seis tabelas novas com RLS, trigger Auth adaptada para metadados `proxiti_account_type=customer`, RPCs específicas de consulta e escrita, abertura atômica de chamado e mensagem pelo serviço, e-vinculação ao CRM mediante confirmação administrativa. As contas técnicas anteriores permanecem na tabela `profiles` e não ganham permissões pelo cadastro do cliente.
- `supabase/partner_portfolio_v19.sql`: oportunidade e registro operacional privado, RLS por titular/admin e RPCs para oferta/aceite/recusa com validação de orçamento aceito. Preços de custo e margens continuam apenas no Comercial administrativo.
- `supabase/functions/proxiti-support/index.ts`: novas rotas de conta que verificam JWT Supabase com `admin.auth.getUser`, conta ativa/e-mail confirmado e vínculo real entre usuário e chamado antes de consultar conversa ou proposta. O atendimento de visitantes continua autenticado pela chave privada original.
- Para um atendimento presencial, a solicitação de horário **não reserva agenda**: a equipe revisa e confirma o compromisso. A escolha do profissional é apenas preferência, sujeita à especialidade, qualificação, disponibilidade e aceite voluntário.
- Uma avaliação do cliente só é possível após um atendimento concluído e designado a um técnico. O registro do parceiro também exige conclusão e responsabilidade pelo chamado. Apenas a administração pode revisar registros no banco; não há pontuação pública de pessoas.
- Nenhuma assinatura, mensalidade, cobrança, Pix automático, repasse automático ou atendimento humano 24h foi ativado. Os termos e valores de serviços reais seguem o Comercial V15/V17/V18. O certificado UNIPROXITI não concede sozinho acesso a dados ou autorização de atendimento.

## Implantação e homologação

1. Integrar e testar ambos os PRs em branch, com site e Central sem dados reais.
2. Aplicar **primeiro** `customer_workspace_v19.sql`, **depois** `partner_portfolio_v19.sql`. A segunda depende da tabela de avaliação criada na primeira. Ambas são aditivas, sem excluir chamados, notas ou certificados existentes. O trigger adaptado afeta apenas novos usuários.
3. Atualizar a Edge Function `proxiti-support` mantendo os argumentos de origem, JWT customizado `verify_jwt=false` e rotas anônimas já existentes. Nunca publicar a chave de serviço no site.
4. Publicar primeiro Central e backend, depois a Minha PROXITI. Confirmar o deploy de cada GitHub Pages e os testes da `main`.
5. **Conferência necessária em ambiente real** antes de convidar clientes: confirmar que os URLs de confirmação e recuperação `https://proxiti.com.br/minha-proxiti/` estão na lista autorizada do Supabase Auth; cadastrar um cliente de teste autorizado, confirmar e-mail, tentar acesso indevido de outro cliente, abrir chamado remoto, usar conversa e orçamento, avaliar atendimento encerrado, ofertar a parceiro habilitado e testar recusa e aceite. Não inserir clientes fictícios no banco de produção para “simular negócio”.
6. Para atendimento público anônimo, conferir que a área sem login permanece operacional no mesmo navegador, inclusive após sair da conta. Para recuperação, o método de backup e restauração do Supabase continua uma tarefa operacional separada.

## Limitações conhecidas da primeira entrega

A carteira mostra **chamados atualmente atribuídos** ao parceiro. Uma futura versão histórica poderá preservar relações anteriores sob autorizações específicas; não deve disponibilizar dados ou contatos de pessoas após a perda de permissão. A área de benefícios é gratuita e informativa; regras de planos pagos dependem de escopo, preços, capacidade e provedor definido. A confirmação de um orçamento não é confirmação de pagamento e tampouco autoriza intervenção fora do escopo.
