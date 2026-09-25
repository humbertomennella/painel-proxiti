# Central Técnica PROXITI | Operação e ativação

Atualização de setembro/2026. Este documento não contém credenciais ou dados reais de clientes.

## Recursos aplicados no ambiente existente

- Caixa de entrada dividida: lista de chamados à esquerda e atendimento à direita, com o chamado, rascunho e scroll preservados em sessão.
- Leitura por profissional sincronizada na tabela `public.ticket_read_receipts`, protegida por RLS. A escrita é feita pela função `proxiti_mark_ticket_read`, após validar acesso ao chamado.
- Histórico operacional em `public.ticket_audit`: criação, designação, aceite, mudança de situação e mensagens, **sem copiar o corpo das mensagens**.
- Avisos sonoros e notificações do navegador quando a Central estiver aberta. O usuário deve permitir os avisos no navegador. Navegador completamente fechado não recebe avisos desta versão.
- Perfil com autenticação em duas etapas por TOTP. Ao cadastrar um fator verificado, as sessões seguintes exigem um código. Convites e alterações de permissões de técnicos exigem sessão AAL2 validada no servidor.
- O acesso ao site público continua separado da Central; perfis, mensagens e arquivos permanecem protegidos pelo Supabase.

## Ativação que depende de uma ação pessoal

### Administrador: cadastrar o segundo fator

Entre na Central → **Meu perfil → Verificação em duas etapas**. Use um aplicativo autenticador e confirme o código. Guarde o acesso ao autenticador e configure um segundo fator quando possível. O Supabase TOTP não fornece códigos de recuperação nesta implantação. Após habilitar, encerre a sessão, entre novamente e confirme o novo código. Depois, use Técnicos → Convidar técnico.

A verificação em duas etapas precisa ser ativada por quem possui a conta. Nunca envie QR, chave secreta ou código de autenticação ao suporte.

### Avisos fora da aba e e-mail

Clique em **Notificações → Ativar notificações do navegador**. Os avisos aparecem quando a Central está aberta em outra aba, conforme as permissões do sistema operacional. Para e-mail confiável quando a Central está fechada, é preciso conectar um serviço transacional (por exemplo Resend), verificar o domínio de envio, configurar um remetente autorizado e definir a regra para chamado sem atendimento. Nenhum e-mail automatizado foi habilitado sem esse serviço.

### Proteção anti-bot

O formulário público já utiliza honeypot, limites no servidor e validação dos campos. Um desafio Turnstile com validação no servidor exige um widget e a chave secreta do proprietário do domínio. **Não foi ativado sem essas credenciais.** A validação de Turnstile só deve ser ativada quando o widget público e o segredo do servidor estiverem configurados em conjunto.

### Endereço central.proxiti.com.br, sem interromper o login existente

O site institucional já usa `proxiti.com.br` no GitHub Pages. O endereço atual da Central funciona em `https://humbertomennella.github.io/painel-proxiti/`.

Os registros históricos indicam gestão DNS pelo Registro.br, mas confirme no painel do domínio os nameservers atuais antes de alterar a zona. Não modifique os registros `@` ou `www` do site institucional.

1. Verifique a propriedade de `proxiti.com.br` nas configurações do GitHub Pages, quando solicitado.
2. No repositório `humbertomennella/painel-proxiti`, em **Settings → Pages → Custom domain**, adicione `central.proxiti.com.br`. Essa alteração pode criar `CNAME` no repositório.
3. Na zona DNS **efetivamente autoritativa**, crie somente o registro **CNAME `central` → `humbertomennella.github.io.`**, sem caminho `/painel-proxiti`. Não configure um curinga.
4. Aguarde a propagação e verifique HTTPS e acesso à Central nesse endereço antes de alterar os redirecionamentos de autenticação.
5. No Supabase, **Authentication → URL Configuration**, inclua `https://central.proxiti.com.br/` em Redirect URLs; mantenha a URL antiga durante a migração. Após comprovar o novo login e a recuperação de senha, configure Site URL e, se aplicável, a variável `PROXITI_PANEL_URL` na Edge Function.

**Não inserir CNAME antes de combinar GitHub, DNS e Auth:** a mudança prematura pode redirecionar a Central para um endereço ainda indisponível. A configuração do domínio próprio está preparada, mas não concluída.

## Teste funcional com duas contas reais

Ainda requer uma conta de técnico secundária autorizada. Não crie usuários de produção inventados.

- Administrador com TOTP ativado convida um segundo e-mail autorizado.
- Novo profissional fica pendente até a aprovação e recebe apenas as permissões necessárias.
- Visitante abre chamado e envia mensagem em um navegador separado.
- Técnico recebe aviso, assume o chamado, responde e muda a situação; o cliente recebe a mensagem.
- Abra a mesma conta técnica em outro dispositivo e confira o estado de leitura sincronizado.
- Transfira o chamado para outro profissional e confirme a visibilidade segundo as permissões.
- Revogue ou suspenda o técnico e confirme a perda de acesso aos dados.
- Confira `ticket_audit` para aceite, movimentações e respostas sem conteúdos de mensagens.

Não trate esse roteiro como executado enquanto não forem realizados os testes com as duas contas.
