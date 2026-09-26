# UniProxiti · operação editorial e homologação

Quarta área funcional da Central, após a conclusão da Visão Geral, Chamados e Agenda. Esta entrega aproveita os **dez procedimentos internos existentes**. Nenhum material publicado foi substituído para compor a interface e nenhum registro de cliente ou certificado de curso foi criado.

## O que está disponível

A UniProxiti reúne artigos e arquivos privados por especialidade. A pesquisa percorre título, descrição e corpo técnico no banco com indexação em português; o resultado pode ser filtrado por especialidade. O administrador também filtra **publicados e rascunhos**. A consulta usa páginas de 40 registros. O indicador mostra somente a quantidade carregada e sinaliza quando existem mais páginas, sem apresentá-la como total histórico absoluto.

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

## Capacitação interna · currículo V13

A biblioteca de procedimentos e a capacitação são experiências separadas. O currículo `assets/academy-curriculum.js` contém **16 aulas originais em oito trilhas**, com 15 minutos estimados por aula, objetivos, explicações por etapa, um estudo de caso com conduta de referência, checklist e, quando aplicável, links a fontes institucionais. As oito ilustrações vetoriais em `assets/academy-visuals/` são originais, independem de banco de imagens e usam a identidade grafite/azul PROXITI.

| Trilha | Aulas |
|---|---|
| Atendimento e conduta | Primeiro contato e autorização; Comunicação, prazos e orientação final |
| Computadores e notebooks | Diagnóstico de lentidão e travamentos; Manutenção preventiva e atualizações |
| Redes e Wi-Fi | Diagnóstico de internet e Wi-Fi; Roteadores e rede de pequenos negócios |
| Segurança digital preventiva | Phishing, senhas e MFA; Proteção de dispositivos e resposta inicial |
| Backup e continuidade | Cópias de segurança que realmente recuperam; Teste de restauração e continuidade |
| Infraestrutura e instalações | Instalações, cabos e segurança física; Inventário e continuidade de pequeno escritório |
| Privacidade e autorização | LGPD, minimização e autorização prática; Suporte remoto seguro e incidentes de dados |
| Operação residencial e empresarial | Chamados, agenda e relatórios PROXITI; Residências, microempresas e pós-atendimento |

Aulas e estudos de caso não prometem serviços que a PROXITI não oferece: perícia forense, intervenções elétricas sem qualificação, disponibilidade 24 horas ou cumprimento jurídico automático.

## Avaliações, pontuação e emissão

O servidor Supabase guarda **64 questões de aula (quatro por curso)** e **24 questões de prova final**, com gabaritos protegidos. O frontend recebe enunciado, quatro alternativas e identificação; a alternativa correta não é enviada antes da correção. O gabarito foi cadastrado em migrações **privadas do projeto**, não em um arquivo público do GitHub. Alterar a resposta ou o contador no navegador não grava aprovação.

- Cada questão de aula vale 25 pontos; três acertos em quatro (75/100) aprovam aquela aula. A maior nota válida fica registrada por curso, individualmente e na versão do currículo. Nova tentativa não apaga aprovação obtida anteriormente.
- A prova final só é disponibilizada quando **as 16 aulas** estiverem aprovadas. São 24 questões, distribuídas igualmente pelas oito trilhas, com quatro críticas em segurança e privacidade.
- A nota final é calculada pelo banco como `0,60 × média dos 16 melhores questionários + 0,40 × nota da prova`. A nota mínima da prova é **75/100** e a nota final mínima é **80/100**. Além disso, as quatro questões críticas devem estar corretas.
- O certificado **interno/institucional** é emitido pelo banco somente após todos os critérios e com nome do perfil. Usa um código de verificação aleatório, data de emissão e notas da avaliação concluída. A interface permite imprimir ou salvar pelo navegador em PDF; não fabrica um documento assinado por terceiros.
- Tentativas, progresso e certificados são privados do usuário autenticado. Os papéis `anon` e `authenticated` não recebem gravação direta nas tabelas de nota. A correção e a emissão usam RPCs autenticadas que verificam permissão e as respostas contra o gabarito do servidor.
- A consulta de um artigo da biblioteca, inclusive o botão “Consultado neste navegador”, **não concede pontos nem certificado**.

**Limites do certificado:** é uma declaração institucional de aproveitamento interno no currículo V13; não equivale a diploma reconhecido, registro profissional, certificação de fabricante ou habilitação técnica regulada. Uma hora estimada de conteúdo não equivale a controle de presença ou de tempo real de estudo. A prova admite novas tentativas; as notas são avaliação do conhecimento apresentado neste currículo, não garantia de desempenho em qualquer atendimento.

## Testes adicionais e responsabilidade editorial

A migração `supabase/academy_learning_v13.sql` criou o esquema de cursos, perguntas privadas, progresso, tentativas e certificado. O banco de questões contém 16 cursos ativos, 64 itens de questionário, 24 itens de prova e quatro críticos, sem notas ou certificados fictícios cadastrados para pessoas reais.

`node tests/academy-learning-functional.mjs` exercita o currículo, a correção de quiz, o bloqueio da prova, nota ponderada, reprovação por erro crítico, geração e impressão de certificado e layout mobile/desktop nos dois temas, com sessão e banco **simulados no navegador**. `node tests/central-integrity.mjs` valida currículo, imagens e contratos de segurança das RPCs. Esses testes não substituem ensaio com uma conta legítima e a revisão dos conteúdos por profissional responsável.

Fontes de consulta, não endosso do certificado: [CISA · Secure Our World](https://www.cisa.gov/secure-our-world), [Microsoft Learn · Diagnóstico de redes sem fio](https://learn.microsoft.com/pt-br/troubleshoot/windows-client/networking/wireless-network-connectivity-issues-troubleshooting) e [ANPD · Publicações de segurança e privacidade](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes).
