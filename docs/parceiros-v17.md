# PROXITI V17 · Operação de parceiros

A V17 adiciona uma camada operacional para parceiros técnicos sem transformar disponibilidade, cursos ou certificados em aceite automático de serviço.

## Parceiro

Cada técnico ativo pode registrar:
- apresentação profissional e resumo;
- estágio de experiência;
- áreas de interesse/atuação;
- atendimento remoto e/ou presencial;
- regiões para atendimento presencial;
- disponibilidade atual e observação;
- capacidade simultânea declarada.

O parceiro controla sua própria disponibilidade. Alterá-la não cria obrigação de aceitar chamados.

## Administração

A área Técnicos mostra disponibilidade, especialidades, modalidade, regiões, capacidade declarada e quantidade atual de chamados abertos. O administrador pode registrar uma revisão operacional separada.

**Aprovação administrativa não atribui chamados.** Ela apenas indica que o perfil passou pela revisão interna para ser considerado na seleção. A atribuição continua sendo uma ação específica no chamado.

Certificados da UNIPROXITI não modificam `approved_for_assignment`, permissões ou responsáveis de chamados.

## Segurança

`partner_operational_profiles` permite leitura ao próprio técnico e à administração. `partner_operational_audit` segue a mesma regra. O técnico grava somente via `proxiti_partner_save_self`; revisão administrativa usa `proxiti_partner_admin_review` e exige administrador com MFA/AAL2.

Não há campos para CPF, CNPJ, documentos, dados bancários ou credenciais. Essas informações, quando juridicamente necessárias em outra etapa, não devem ser misturadas ao perfil operacional.

## Observação sobre despacho

A V17 é deliberadamente **assistiva e não automática**. Especialidade, região, disponibilidade e certificação podem apoiar a escolha humana, mas não definem sozinhas competência, autorização jurídica, segurança ou adequação para um atendimento. Antes do serviço, condições, escopo e responsabilidades continuam precisando ser acordados.

## Homologação

Validar com uma conta de técnico ativo e uma administrativa com MFA: editar disponibilidade, conferir isolamento de dados, revisar o perfil, filtrar por especialidade/modalidade e confirmar que nenhum chamado muda de responsável apenas por alterar perfil ou certificado.
