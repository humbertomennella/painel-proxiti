# PROXITI Central V8 · Entrega operacional e instruções por área

**Data de implantação:** 25/09/2026. Documento sobre a estrutura publicada, não certificação de atendimento real. Nenhuma conta, serviço, cliente ou equipamento fictício é criado.

## Acesso e Visão geral
A Central mantém os dois temas do site institucional, leitura ajustável por conta, modo de foco e navegação compacta. Os indicadores só devem refletir chamados que exigem ação; os encerrados continuam disponíveis na fila completa e não devem figurar como pendência. No primeiro acesso de uma conta técnica, a interface exibe apenas módulos concedidos no perfil.

## Chamados
Cada chamado integra conversa com o cliente, notas internas, checklist por área, anexos privados de até 5 MB, identificação mínima do equipamento, compromissos, relatórios versionados e histórico de auditoria. Técnicos sem designação não podem escrever informações técnicas no chamado; administradores autorizados podem. Dados internos não são enviados ao cliente nem incluídos automaticamente no relatório. Relatório impresso/salvo em PDF é uma cópia revisada pelo técnico, **não** aceite do cliente nem assinatura.

## Agenda
A aba Agenda exibe compromissos de chamados acessíveis. Um técnico designado pode planejar retorno, ligação ou visita, depois marcar como confirmado **após combinar com o cliente** e finalmente concluí-lo ou cancelá-lo. A criação do registro não envia convite, e a plataforma não deve afirmar confirmação sem validação humana. Data/hora da tela é local; o banco armazena instante UTC.

## Academia
Foram publicados **10 procedimentos internos originais**, em Atendimento, Computadores, Redes, Backup, Segurança e Infraestrutura. Conteúdo inicial fica no banco privado, com pesquisa por texto, categoria e data de revisão, além de referência técnica quando aplicável. Revisões pelo administrador preservam a chave editorial dos materiais seed. A opção "Consultado neste navegador" é preferência local; **não é avaliação, certificado ou progresso sincronizado**. Um administrador também pode publicar textos ou PDFs/imagens privados de até 10 MB. Não inserir material sujeito a licenciamento ou dados de cliente sem permissão.

## Ferramentas
A área mantém inventário verdadeiro com responsável/identificação e fornece calculadora IPv4/CIDR e SHA-256. Os cálculos são locais no navegador; nenhum arquivo selecionado pela ferramenta SHA-256 é enviado ao servidor. Para /31, usa os dois endereços ponto a ponto; /32 representa um host único. Um hash idêntico não certifica procedência por si só. O inventário começa vazio até receber equipamento real e autorização.

## Técnicos e permissões
Convite, liberação e mudanças de permissões continuam exclusivos do administrador com verificação exigida para ações privilegiadas. Só cadastrar pessoas reais após autorização. Realizar teste de isolamento com duas contas próprias antes de abrir a operação a parceiros.

## Conteúdo do site
O módulo edita apenas chaves editoriais autorizadas em `site_content`. As alterações publicadas aparecem no site institucional após nova leitura da página; não alteram arquivos, checkout da Kiwify, contratos ou DNS.

## Meu perfil e segurança
Nome, foto privada, senha e matrícula TOTP são recursos do próprio usuário. **O titular deve pessoalmente ativar TOTP**, guardar o fator de recuperação em local separado e validar login após encerramento da sessão. Nenhum agente remoto pode inserir o código pelo usuário ou declarar fator ativo sem ele ter sido verificado.

## Notificações
Alertas sonoros e do navegador dependem de sessão aberta e permissões do dispositivo. O domínio de envio transacional possui configuração verificada no provedor de e-mail, mas a presença da chave no Supabase e a entrega real precisam de teste explícito antes de prometer alertas fora da Central. Não usar e-mail como única fonte de notificações urgentes.

## Verificações realizadas sem dados artificiais
- Migrações V7 e V8 e seed editorial aplicadas, mantendo os cinco chamados existentes.
- Tabelas novas com RLS; acesso anônimo e escrita direta por usuários autenticados não concedidos.
- Teste estático e calculadora com /0, /24, /31, /32 e entradas inválidas.
- Teste automatizado em Chromium de cinco larguras, temas claro/escuro e ausência de rolagem horizontal deve constar como **aprovado** antes da integração. Conferir log do workflow.
- Os relatórios, equipamentos e agendas permanecem sem registros até haver um serviço real.

## Ações que não devem ser simuladas
1. Ativar o fator TOTP da conta administrativa no perfil. Confirmar também recuperação da conta.
2. Testar convite, permissão, nota, anexo e relatório com outra conta de técnico real, em chamado de teste explicitamente autorizado, sem dados de cliente.
3. Confirmar entrega de e-mail de um chamado de teste autorizado (e-mail de destino próprio).
4. Definir retenção e procedimento de eliminação de anexos e relatórios, conforme orientação jurídica e necessidade operacional.
5. Configurar eventual domínio `central.proxiti.com.br` somente após alinhar GitHub Pages, DNS e redirecionamentos de autenticação, preservando a URL anterior.

**Não há trabalho assíncrono invisível:** todo ajuste concluído deve aparecer em commit, migração ou workflow verificável. Não declarar validação funcional sem o respectivo teste.
