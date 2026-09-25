# Fluxo técnico PROXITI V7 — operação, privacidade e validação

Atualização de 25/09/2026. A migração `supabase/ticket_workflow_v7.sql` foi aplicada ao projeto Supabase da Central sem alterar chamados anteriores.

## Fluxo por atendimento

1. Abra a fila e selecione um chamado. Chamados encerrados ficam fora das pendências acionáveis, mas permanecem no histórico.
2. Administrador ou profissional designado pode registrar notas **internas**; um profissional que só visualiza a fila não pode escrevê-las.
3. Para atendimento ativo, escolha um roteiro geral, computador, redes, backup ou segurança preventiva. A escolha cria as etapas uma vez por chamado. Cada etapa pode ser pendente, concluída ou não aplicável com justificativa.
4. Envie anexos de até 5 MB, somente PDF, PNG, JPG ou WebP, quando indispensáveis ao serviço. O arquivo fica em bucket privado; o cliente não tem acesso pela rota pública.
5. Preencha diagnóstico, serviço executado/encaminhamento e orientações no relatório; revise os campos e imprima ou salve em PDF no navegador. O relatório **não** inclui notas internas, conversa, histórico de auditoria nem anexos. Não é enviado automaticamente.

## Regras de acesso implementadas no banco

- Um administrador com sessão autorizada pode consultar e trabalhar nos chamados.
- Técnico ativo com `tickets_view` pode consultar um chamado designado a ele ou ainda sem responsável. Escrita técnica exige a designação para sua conta ou perfil administrativo.
- Chamados encerrados e perfis sem permissão não admitem novas notas, checklist ou anexos.
- `ticket_internal_notes`, `ticket_tasks` e `ticket_attachments` têm RLS de leitura. Escrita de metadados ocorre apenas por RPCs que verificam perfil, chamado e situação.
- `proxiti-ticket-files` é um bucket privado, com políticas de leitura, inclusão e limpeza restritas. Nome e caminho dos arquivos são aleatórios; a pasta corresponde ao UUID do chamado.
- Auditoria registra **a ação e o autor**, não o texto de notas nem o conteúdo dos anexos.
- Nenhuma nova função recebe permissão para `anon`. Não armazenar senhas, códigos TOTP, senhas de clientes ou material pago em anexos de chamados.

## Operação e limites

A área técnica depende do Supabase existente. O botão de download lê o blob sob a sessão autorizada e inicia download local; não gera URL pública duradoura. Não há antimalware ou verificação automática de PDFs: só aceite evidências necessárias, de origem conhecida e dentro do escopo. A exclusão geral e retenção de arquivos ainda exigem política operacional definida.

A impressão do relatório é uma exportação **local** para revisão; não representa assinatura, aceite do cliente nem publicação. O sistema não envia anexos ou relatório ao visitante de forma automática.

O programa de parceiros, cadastro de cursos reais, catálogo de ferramentas, agenda de visitas, histórico consolidado de equipamentos entre clientes e e-mail confiável com a Central fechada não são ativados por esta migração. Não publicar conteúdo ou datas fictícias para simular essas funções.

## Teste manual antes de escalar

- Verificar a interface de 320 a 760 px e desktop, temas claro/escuro, zoom 200%, teclado e estados com e sem permissão.
- Administrador deve ativar TOTP **pessoalmente** em Meu perfil e testar o novo login. Não compartilhar QR, chave secreta ou códigos.
- Validar com uma segunda conta de técnico real autorizada: abertura de chamado, designação, leitura, nota, checklist, anexo e tentativas de acesso por técnico não designado.
- Confirmar que cliente consegue acompanhar apenas as mensagens de seu chamado, não notas, checklists ou anexos privados.
- Testar tamanho/tipo de arquivo inválidos, falha de rede e download após suspensão de permissão.
- Conferir o novo histórico de auditoria. Eventos anteriores à ativação da auditoria não são inventados retroativamente.
- Verificar conclusão dos checks de integridade e do GitHub Pages depois do merge.

Os testes estáticos de CI **não substituem** esse roteiro. Não usar registros reais de clientes como massa de teste.
