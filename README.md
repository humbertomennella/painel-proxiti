# PROXITI | Central Técnica

Primeira entrega: login por e-mail e senha, recuperação de acesso e perfis autorizados no banco. Os módulos de chamados, cursos, apostilas e ferramentas ainda são prévias.

## Estado da implantação

- **Supabase criado:** projeto **Central Técnica PROXITI**, na organização PROXITI, região São Paulo (`sa-east-1`), plano gratuito (custo informado de 0/mês).
- **Banco preparado:** migração aplicada, tabela `public.profiles`, gatilho para novos usuários, RLS ativa, política que restringe a leitura ao próprio usuário e nenhuma concessão de escrita para `anon` ou `authenticated`.
- **Frontend conectado:** `assets/config.js` contém somente a URL do projeto e sua chave **publishable** pública. Não contém chaves privadas.
- **Ainda não concluído:** habilitar GitHub Pages, configurar URLs de redirecionamento, desabilitar cadastro público, criar conta administrativa pessoal e validar login real com essa conta.

## Publicação no GitHub Pages

No repositório `humbertomennella/painel-proxiti`, acesse **Settings → Pages**. Em **Build and deployment**, selecione **Deploy from a branch**, branch `main`, pasta `/(root)` e salve. A URL prevista é:

`https://humbertomennella.github.io/painel-proxiti/`

Não configure o DNS de `painel.proxiti.com.br` até testar a URL inicial. O GitHub Pages não é uma área privada: o código do frontend é público, mesmo com o login.

## Configurações de autenticação que faltam

No projeto [Central Técnica PROXITI do Supabase](https://supabase.com/dashboard/project/qbqfbrbbsvpftmtfhfab):

1. Em **Authentication → Providers → Email**, mantenha login por e-mail e senha, confirmação de e-mail e **desabilite novos cadastros públicos**. Não há formulário de cadastro no frontend, mas a opção do servidor também precisa ser desativada.
2. Em **Authentication → URL Configuration**, defina **Site URL** como `https://humbertomennella.github.io/painel-proxiti/` e inclua exatamente a mesma URL em **Redirect URLs**. Isso permite que o e-mail de recuperação retorne para a página correta.
3. Em **Authentication → Users**, crie **sua própria conta** com seu e-mail e uma senha exclusiva; não compartilhe senha nem dados de sessão comigo. A nova conta começa como técnica pendente.
4. Depois de criar a conta, abra **SQL Editor** e execute **somente no console privado** o comando abaixo, substituindo `SEU_EMAIL_AQUI` pelo e-mail da conta:

```sql
update public.profiles
set role = 'administrator', status = 'active'
where id = (
  select id from auth.users where lower(email) = lower('SEU_EMAIL_AQUI')
);
```

Verifique se exatamente **uma** linha foi alterada. Nunca publique o seu e-mail administrativo ou a consulta preenchida no repositório.

5. Acesse o painel pelo endereço do GitHub Pages e teste o login, logout e recuperação de senha. Depois crie um técnico de teste. Ele deve permanecer com `status='pending'` até a liberação administrativa.

**Nota:** o plugin de gerenciamento Supabase não oferece, nesta sessão, comandos para alterar a configuração Auth, criar usuários ou definir GitHub Pages. Essas etapas precisam ser confirmadas por você nas interfaces dos serviços. O projeto, a migração e a configuração pública do frontend já foram aplicados.

## Segurança

- Nenhuma chave secreta, senha, currículo ou dado de cliente deve entrar neste repositório **público**.
- O navegador não tem permissão para promover um usuário, alterar `role`/`status` ou consultar perfis de outras contas; essas regras são implementadas no banco com RLS.
- O Supabase Auth faz a verificação das credenciais. Não há autenticação fictícia nem senha armazenada no HTML.
- Cada módulo futuro precisará de autorização no servidor, políticas RLS específicas e regras próprias para arquivos.
- O plano gratuito pode pausar projetos inativos e tem limites de recursos. Faça um plano de backup antes de cadastrar clientes reais.

## Arquivos

- `index.html` e `assets/style.css`: interface responsiva.
- `assets/app.js`: login, recuperação, sessão e verificação do perfil.
- `assets/config.js`: URL e chave pública.
- `supabase/schema.sql`: código da migração aplicada, mantido para revisão e reprodutibilidade.
