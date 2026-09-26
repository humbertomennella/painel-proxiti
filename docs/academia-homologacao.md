# Academia PROXITI · operação editorial e homologação

Terceira área de conteúdo técnico da Central, após a conclusão da Visão Geral, Chamados e Agenda. Esta entrega aproveita os **dez procedimentos internos existentes**. Nenhum material publicado foi substituído para compor a interface e nenhum registro de cliente ou certificado de curso foi criado.

## O que está disponível

A Academia reúne artigos e arquivos privados por especialidade. A pesquisa percorre título, descrição e corpo técnico no banco com indexação em português; o resultado pode ser filtrado por especialidade. O administrador também filtra **publicados e rascunhos**. A consulta usa páginas de 40 registros. O indicador mostra somente a quantidade carregada e sinaliza quando existem mais páginas, sem apresentá-la como total histórico absoluto.

Artigos usam títulos e etapas em texto seguro, sem injeção de HTML. O administrador pode editar os metadados, revisar o conteúdo e publicar após confirmar sua própria revisão técnica. PDF e imagens ficam no bucket privado e são abertos com autorização temporária de 90 segundos. O bucket não se torna público.

## Revisão, versões e arquivamento

1. O administrador pode salvar material novo como rascunho, sem declará-lo pronto para a equipe. Para publicar material novo ou uma edição de conteúdo, deve marcar expressamente a confirmação de revisão técnica.
2. A alteração de um registro salva a **versão anterior** no histórico privado `training_material_versions`. O editor usa a data/hora da última versão confirmada para evitar sobrescrever uma edição concorrente; em caso de conflito, mantém o formulário para revisão.
3. No histórico, administradores podem consultar textos anteriores. Uma versão de artigo pode ser carregada de volta ao editor **como rascunho** e deverá ser revisada antes de publicação. Arquivos anteriores continuam privados, acessíveis ao administrador quando o objeto ainda existir no armazenamento.
4. Arquivar retira o material da biblioteca dos técnicos, mas preserva a versão atual e o histórico. A API autenticada não tem permissão para exclusão definitiva de materiais. O administrador deve usar o procedimento de retenção aprovado antes de qualquer remoção excepcional fora da Central.
5. Na substituição de PDF ou imagem, a versão anterior permanece no armazenamento privado e no histórico editorial; a interface nunca apaga o arquivo anterior por simples atualização. Em erro ambíguo após upload, verifica-se o registro antes de tentar limpar o novo objeto.

A data de revisão é uma declaração **editorial** do responsável, não evidência de curso realizado. Revisões de metadados sem mudança do conteúdo podem manter a data anterior. Uma nova versão de conteúdo precisa de confirmação para seguir publicada pela interface.

## Papéis e privacidade

- **Técnico autorizado:** vê apenas materiais publicados, lê os artigos, abre arquivos publicados quando autorizado pelo Supabase e marca a consulta no próprio navegador.
- **Administrador:** consulta publicados e rascunhos, cria e revisa conteúdo, arquiva e acessa o histórico editorial e arquivos históricos privados.
- **Conta sem permissão:** não vê a biblioteca. Ao perder o acesso, a interface limpa os dados da tela e descarta respostas de consultas iniciadas na sessão anterior.

A preferência “Consultado neste navegador” é local, individual por conta e versão do material. Não é sincronizada entre aparelhos, não comprova leitura, treinamento, avaliação ou certificação. Não inserir nomes de clientes, senhas, tokens ou outras informações pessoais desnecessárias nos procedimentos.

## Segurança no banco

A migração `supabase/academy_integrity_v12.sql` mantém os materiais existentes, adiciona a busca `search_index`, histórico privado com RLS para administradores e gatilhos que preservam snapshots antes de cada alteração relevante. O campo `content_key` existente não pode ser alterado em procedimentos identificados editorialmente. A permissão `DELETE` foi revogada do papel autenticado em `training_materials`.

A política de leitura do bucket `proxiti-training` exige, para técnicos, um material **publicado** apontando para o arquivo. Administradores mantêm acesso aos documentos de rascunhos e versões antigas. Um link assinado antes do arquivamento pode continuar válido até expirar, por no máximo 90 segundos no fluxo da interface.

## Testes e homologação

`node tests/central-integrity.mjs` verifica contratos, ID dos controles, sintaxe e regras de segurança; `node tests/academy-functional.mjs` simula técnico e administrador no Chromium para exercitar publicação, pesquisa, versões, arquivamento, concorrência, upload ambíguo, recuperação de falha, permissão revogada e responsividade nos temas claro e escuro. Os testes existentes da Visão Geral, Chamados e Agenda também precisam continuar passando.

**Ainda depende de validação humana:** a navegação real com duas contas legítimas, a conferência editorial dos materiais por um profissional responsável e o teste de um arquivo privado autorizado. Os testes automatizados não acessam credenciais reais, não criam materiais de produção nem validam a precisão clínica, jurídica ou universal de cada procedimento técnico. Os dez artigos permanecem como orientação operacional a ser contextualizada pelo responsável.
