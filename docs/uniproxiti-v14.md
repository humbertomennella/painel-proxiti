# UNIPROXITI V14 · Currículo e certificação individual por trilha

Esta implementação complementa a versão V13 sem alterar o identificador `2026-09-v1` dos registros já emitidos. O fluxo de autenticação, permissões e dados de outras áreas da Central Técnica não é modificado.

## Trilhas e tempo estimado

| Trilha | Categoria | Aulas | Prova final | Tempo orientado |
|---|---|---:|---:|---:|
| Atendimento e conduta | Essencial | 2 × 50 min | 20 min | 120 min |
| Computadores e notebooks | Essencial | 2 × 50 min | 20 min | 120 min |
| Redes e Wi-Fi | Essencial | 2 × 50 min | 20 min | 120 min |
| Segurança digital preventiva | Essencial | 2 × 50 min | 20 min | 120 min |
| Backup e continuidade | Recomendada | 2 × 50 min | 20 min | 120 min |
| Infraestrutura e instalações | Recomendada | 2 × 50 min | 20 min | 120 min |
| Privacidade e autorização | Essencial | 2 × 50 min | 20 min | 120 min |
| Operação residencial e empresarial | Recomendada | 2 × 50 min | 20 min | 120 min |

Cada aula existente conserva teoria, objetivos, estudo de caso, checklist e quatro questões corrigidas no servidor. A versão V14 acrescenta a cada uma um laboratório orientado de 25 minutos, cinco atividades contextualizadas e um registro esperado. Os 50 minutos por aula são **estimativa pedagógica**: leitura15 + laboratório25 + revisão/questionário10. O servidor registra notas e tentativas, não tempo de permanência ou execução física dos exercícios.

Essencial e Recomendada são classificações do programa; nenhuma das oito trilhas é exigida para emitir o certificado **de outra trilha**. O campo `academy_courses.required` da V13 permanece inalterado para preservar o fluxo legado de certificação geral opcional e **não é a categoria da V14**.

## Aprovação e emissão

1. Conclua as duas aulas da trilha com pelo menos 75 pontos em cada questionário.
2. Faça a prova individual de dez questões da **mesma** trilha. São três questões já existentes no banco V13 e sete novas, mantidas apenas no banco privado.
3. A prova exige pelo menos 75 pontos (com dez questões, isso corresponde a **oito acertos = 80 pontos**) e todas as questões críticas corretas.
4. A nota ponderada final deve ser pelo menos 80 pontos: 60% da média das melhores notas das duas aulas + 40% da prova final.
5. Após o resultado aprovado, o Supabase registra, uma única vez, o certificado interno individual por usuário, trilha e versão curricular, com código de verificação próprio. O usuário pode imprimir ou salvar esse registro como PDF pelo navegador.

O certificado não exige completar outras trilhas. A prova geral anterior de 16 aulas e 24 questões permanece disponível **somente como certificação adicional opcional**. Nenhum certificado individual é fabricado localmente por JavaScript, e uma falha de consulta nunca deve ser mostrada como emissão concluída.

O documento é interno/institucional. Não equivale a diploma, habilitação regulada ou certificação profissional externa.

## Migração, segurança e manutenção

Arquivo de esquema: `supabase/academy_track_certification_v14.sql`. Migração aditiva: `academy_track_exam_questions`, `academy_track_exam_attempts`, `academy_track_certificates` e RPCs de consulta, avaliação e verificação. Banco de respostas e explicações V14 não é versionado em repositório público; as 56 questões novas foram incluídas como migrações privadas no Supabase. Conservar um backup privado seguro dessas migrações para recuperação de ambiente.

A tabela de gabaritos não concede `SELECT` a `anon` nem a `authenticated`. As RPCs exigem conta ativa e permissão `training` ou administrador. Tentativas e certificados são acessíveis apenas ao titular autorizado via RLS; nenhum dado de outro usuário deve vazar entre sessões.

Os registros de `academy_course_progress`, `academy_quiz_attempts`, provas e certificados V13 não são apagados, modificados ou migrados artificialmente. As aprovações anteriores podem contar para liberar a prova individual quando ambas as aulas da trilha estiverem aprovadas.

## Imagens e responsividade

Oito capas fotográficas **distintas**, servidas localmente em `assets/photos/`, representam os temas das trilhas. Cinco fotografias originais PROXITI e três fotografias licenciadas Pexels; autoria e licença em `assets/photos/README.md`. Cada aula mantém seu SVG temático original único e recebe uma fotografia de referência pertinente à trilha, acompanhada por uma observação própria da aula. Nenhuma imagem retrata ou endossa clientes/parceiros reais.

O CSS `assets/uniproxiti-course-upgrade.css` reduz o CTA Continuar estudo, padroniza cartões e enquadramentos, melhora leitura e questionários em dispositivos móveis e evita rolagem horizontal por dimensões intrínsecas das fotos ou dos diagramas.

## Homologação

Executar `node tests/central-integrity.mjs`, `node tests/uniproxiti-v14-integrity.mjs`, `node tests/academy-learning-functional.mjs` (Playwright/Chromium) e os demais testes de regressão do workflow. A suíte simula contas, notas, certificado por trilha e certificado geral; não substitui o teste manual em contas reais autorizadas no site publicado.
