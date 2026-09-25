# PROXITI | Central Técnica

Primeira entrega: login por e-mail e senha, recuperação de acesso e perfil com autorização no banco. Os módulos de chamados, cursos, apostilas e ferramentas ainda são apenas prévias. O repositório é **público**: nunca publique dados de clientes, senhas ou documentos internos nele.

## Ativação do login

1. Crie ou selecione seu projeto Supabase e execute o arquivo `supabase/schema.sql` no SQL Editor. Ele cria `public.profiles`, ativa Row Level Security (RLS) e deixa novas contas como `pending`.
2. No Supabase, em Authentication → Providers → Email, desabilite cadastro público. Crie técnicos por convite ou pelo console administrativo. Configure confirmação de e-mail e as políticas de senha adequadas.
3. Em Authentication → URL Configuration, configure a Site URL e a Redirect URL exata do painel (na fase inicial: `https://humbertomennella.github.io/painel-proxiti/`). Para o domínio futuro, adicione `https://painel.proxiti.com.br/`.
4. Em Project Settings / API, copie APENAS o Project URL e a chave pública `publishable` (ou `anon` legada) para `assets/config.js`. **NUNCA** publique `service_role`, `sb_secret_`, tokens privados ou senhas. A chave pública depende das políticas RLS aplicadas ao banco.
5. Crie sua conta em Authentication → Users. Depois execute, apenas no SQL Editor privado, substituindo o endereço no comando abaixo:

```sql
update public.profiles
set role='administrator', status='active'
where id=(select id from auth.users where lower(email)=lower('SEU_EMAIL_AQUI'));
```

Confirme que exatamente uma conta recebeu a permissão. O primeiro técnico criado ficará pendente, sem acesso operacional. Para ativar um técnico, execute o mesmo `update` com `status='active'` e o e-mail dele, **sem** alterar o papel de administrador.

6. Em GitHub → painel-proxiti → Settings → Pages, escolha `Deploy from a branch`, branch `main`, pasta `/(root)`, e salve. A publicação estática não ativa a autenticação enquanto o Supabase não estiver configurado.
7. Teste login, recuperação e três cenários: técnico pendente, técnico ativo e conta administradora. A aplicação consulta somente o próprio perfil; o banco não permite que alguém se promova a administrador pelo navegador.

## Como está construído

- `index.html` e `assets/style.css`: interface responsiva e identidade PROXITI.
- `assets/app.js`: autenticação real com Supabase Auth; nenhum formulário de cadastro público.
- `assets/config.js`: exclusivamente valores públicos do projeto.
- `supabase/schema.sql`: perfis protegidos por RLS; sem permissão de escrita ao navegador.

## Limites desta etapa

O sistema ainda não cria ou administra contas pelo painel, nem distribui tickets ou arquivos. Cada futuro módulo terá que ter RLS própria e regras de acesso a arquivos. O GitHub Pages hospeda apenas o frontend; nunca coloque apostilas privadas, dados dos clientes ou currículos não autorizados nos arquivos públicos.

O subdomínio `painel.proxiti.com.br` é o endereço planejado e deverá ser configurado no DNS e nas configurações Pages **após** a validação da autenticação. Esta alteração não mexe no site institucional da PROXITI nem altera DNS.
