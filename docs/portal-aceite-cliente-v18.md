# PROXITI V18 · Resposta direta ao orçamento no portal do cliente

## Jornada

1. A administração cria o orçamento associado ao chamado, adiciona os itens do catálogo e registra o envio real pelo canal combinado. Um rascunho nunca aparece ao cliente.
2. O titular do **acesso privado do chamado**, conservado no navegador em que abriu o atendimento, entra em `proxiti.com.br/atendimento/` e consulta a proposta emitida. O portal mostra apenas os itens e valores destinados ao cliente, a validade, condições e situação.
3. Para aceitar **ou** recusar, o cliente confirma que leu o escopo e confirma explicitamente sua decisão. A chamada pública envia token, ID do chamado, ID da proposta e decisão à Edge Function; nenhum segredo entra na URL.
4. A Edge Function valida o token do chamado, aplica limite por hora, calcula o hash de acesso e chama uma RPC privada. O banco revalida o mesmo hash, bloqueia a proposta, verifica vínculo com o chamado, emissão anterior, status e validade e registra decisão e evento em uma transação. Repetir uma decisão idêntica já gravada retorna sucesso idempotente, sem novo evento.
5. A Central Técnica mostra a mudança de status após atualização e distingue, no histórico administrativo, `Cliente aceitou pelo portal` e `Cliente recusou pelo portal`. A proposta aceita continua exigindo autorização de intervenção nos fluxos técnicos que já existiam. O aceite não cria pagamento nem repasse.

## Privacidade e limites

As RPCs `proxiti_customer_quote_list` e `proxiti_customer_quote_decide` **não** são executáveis por `anon` ou `authenticated`; somente `service_role` pode chamá-las pelo servidor. Ambas verificam a existência de um chamado com hash de acesso compatível. O portal não recebe notas internas, custos, margens, gabaritos, documentos, repasses ou detalhes de outros chamados. Valores são snapshots dos itens emitidos, nunca o preço atual do catálogo.

O token privado do chamado funciona como uma credencial de portador. A decisão é uma **confirmação operacional pelo titular do acesso**, com horário e evento, não é identificação civil de alta confiança, assinatura eletrônica formal, nota fiscal nem pagamento. Contestações precisam de revisão humana. O cliente pode perder o token ao apagar o navegador, por isso o portal orienta usar os canais de suporte.

O código continua permitindo registro administrativo de respostas realmente recebidas por outros canais, com evidência verificável. O novo portal não envia e-mail ou WhatsApp automaticamente; a Edge Function só tenta alertar administradores por e-mail se a chave do serviço transacional estiver configurada.

## Implantação e recuperação

A migração `supabase/customer_quote_portal_v18.sql` é aditiva. Não exclui nem altera propostas, itens, notas, pagamentos, repasses ou clientes existentes. A Edge Function `proxiti-support` deve ser implantada mantendo `verify_jwt=false` **porque este endpoint público utiliza token privado de chamado e validação explícita no servidor**, além da autenticação MFA existente para o fluxo administrativo de convite. Nunca expor a chave de serviço no site.

Ordem obrigatória: CI em ambos os repositórios → migração V18 → deploy versionado da Edge Function → publicar a Central e o portal. Se o deploy falhar, não publicar a interface de resposta. A migração sem a função não altera o fluxo anterior. O rollback da interface é independente; nunca apagar eventos ou reverter o status de proposta aceita sem análise administrativa.

## Testes

- `tests/customer-quote-v18-integrity.mjs` protege o contrato da RPC, campos autorizados, revalidação, ACLs, idempotência e trilha de auditoria.
- `tests/customer-quote-functional.mjs` (repositório institucional) simula consulta, consentimento, resposta, token inválido, esquecimento de acesso e layout móvel. Os testes não chamam a API real nem modificam produção.
- Homologação com uma conta cliente real, uma conta administrativa com MFA, proposta real de valor acordado, revisão das respostas e inspeção de privacidade ainda exige a participação autorizada do responsável. Não criar aceites fictícios em chamados reais.
