(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const forms = {login:el("login-form"),forgot:el("forgot-form"),reset:el("reset-form")};
  const buttons = ["login-button","forgot-button","reset-button"].map(el);
  const auth = el("auth-screen"), panel = el("panel"), feedback = el("feedback");
  let client = null, busy = false, generation = 0;
  let activeUserId = null, lastProfileKey = null;
  let recovering = ["recovery","invite"].includes(new URLSearchParams(location.hash.replace(/^#/,"")).get("type"));
  function message(value="",kind="") {
    feedback.textContent=value; feedback.className="message"+(kind?" "+kind:""); feedback.hidden=!value;
  }
  function view(name) {
    Object.entries(forms).forEach(([key,form])=>form.hidden=key!==name);
    message("");
  }
  function setBusy(value) {
    busy=value; buttons.forEach(button=>button.disabled=value||!client);
  }
  function showAuth(name="login") {
    try{sessionStorage.setItem("proxiti-force-overview","1")}catch{}
    activeUserId=null;lastProfileKey=null;
    window.PROXITI_ACTIVE_SESSION=null;
    document.dispatchEvent(new Event("proxiti-session-ended"));
    document.body.classList.remove("workspace-mode");
    el("app-sidebar").hidden=true;
    panel.hidden=true;auth.hidden=false;view(name);
  }
  function blocked(title,description) {
    activeUserId=null;lastProfileKey=null;
    window.PROXITI_ACTIVE_SESSION=null;
    document.dispatchEvent(new Event("proxiti-session-ended"));
    document.body.classList.remove("workspace-mode");
    el("app-sidebar").hidden=true;
    auth.hidden=true;panel.hidden=false;el("blocked").hidden=false;el("workspace").hidden=true;
    el("blocked-title").textContent=title;el("blocked-text").textContent=description;
    el("welcome").textContent="Identidade verificada. Os recursos permanecem restritos até a liberação.";
  }
  async function refresh(session) {
    const current=++generation;
    if(recovering){showAuth("reset");return;}
    if(!session?.user){showAuth();return;}
    const sameSession=activeUserId===session.user.id && !!window.PROXITI_ACTIVE_SESSION && !panel.hidden && !el("workspace").hidden;
    if (!sameSession) blocked("Verificando suas permissões…","Consultando seu perfil autorizado.");
    try {
      const {data,error}=await client.from("profiles").select("display_name,role,status,permissions,avatar_path").eq("id",session.user.id).maybeSingle();
      if(current!==generation||recovering)return;
      if(error){blocked("Não foi possível validar o acesso.","Revise a configuração do banco ou tente novamente.");return;}
      if(!data){blocked("Perfil não cadastrado.","A conta existe, mas não há um perfil PROXITI vinculado.");return;}
      if(data.status!=="active"){blocked(data.status==="suspended"?"Acesso suspenso.":"Acesso pendente.",data.status==="suspended"?"Seu acesso foi suspenso pela administração.":"A administração precisa autorizar sua conta antes do uso.");return;}
      if(!["administrator","technician"].includes(data.role)){blocked("Permissões inválidas.","Contate a administração da PROXITI.");return;}
      const fingerprint=JSON.stringify([data.role,data.status,data.permissions,data.display_name,data.avatar_path]);
      const previous=lastProfileKey;
      activeUserId=session.user.id;lastProfileKey=fingerprint;
      auth.hidden=true;panel.hidden=false;el("blocked").hidden=true;el("workspace").hidden=false;
      document.body.classList.add("workspace-mode");el("app-sidebar").hidden=false;
      const role=data.role==="administrator"?"Administrador":"Técnico parceiro";
      const name=String(data.display_name||session.user.email?.split("@")[0]||"Profissional").trim();
      const givenName=name.split(/[.\s_-]+/).filter(Boolean)[0]||"Profissional";
      const displayName=givenName.charAt(0).toLocaleUpperCase("pt-BR")+givenName.slice(1);
      const hour=new Date().getHours();
      el("welcome").textContent=(hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite")+", "+displayName;
      el("person-name").textContent=name;
      el("person-email").textContent=session.user.email||"";
      el("person-role").textContent=role;
      const notifySession=!sameSession || previous!==fingerprint;
      window.PROXITI_ACTIVE_SESSION={client,user:session.user,profile:data};
      if (notifySession) document.dispatchEvent(new CustomEvent("proxiti-session-ready",{detail:window.PROXITI_ACTIVE_SESSION}));
    }catch{if(current===generation && !sameSession)blocked("Erro de conexão.","Não foi possível verificar seu perfil agora.");}
  }
  el("forgot-link").addEventListener("click",()=>view("forgot"));
  el("forgot-form").querySelector("[data-back]").addEventListener("click",()=>view("login"));
  forms.login.addEventListener("submit",async event=>{
    event.preventDefault();if(!client||busy)return;
    if(!el("email").checkValidity()||!el("password").value){message("Informe seu e-mail e senha.","error");return;}
    setBusy(true);message("Verificando suas credenciais…");
    try {
      const {error}=await client.auth.signInWithPassword({email:el("email").value.trim(),password:el("password").value});
      if(error)message("Não foi possível entrar. Confira os dados ou recupere a senha.","error");
    }catch{message("Serviço de autenticação indisponível. Tente novamente.","error");}
    finally{el("password").value="";setBusy(false);}
  });
  forms.forgot.addEventListener("submit",async event=>{
    event.preventDefault();if(!client||busy)return;
    if(!el("forgot-email").checkValidity()){message("Informe um e-mail válido.","error");return;}
    setBusy(true);
    try {
      const {error}=await client.auth.resetPasswordForEmail(el("forgot-email").value.trim(),{redirectTo:location.origin+location.pathname});
      message(error?"Não foi possível solicitar a recuperação agora.":"Se houver uma conta cadastrada, as instruções serão enviadas por e-mail.",error?"error":"success");
    }catch{message("Não foi possível enviar as instruções. Tente novamente.","error");}
    finally{setBusy(false);}
  });
  forms.reset.addEventListener("submit",async event=>{
    event.preventDefault();if(!client||busy||!recovering)return;
    const password=el("new-password").value;
    if(password.length<12){message("Use pelo menos 12 caracteres.","error");return;}
    if(password!==el("confirm-password").value){message("As senhas não coincidem.","error");return;}
    setBusy(true);
    try {
      const {error}=await client.auth.updateUser({password});
      if(error){message("Não foi possível alterar a senha. Solicite outro link.","error");return;}
      recovering=false;el("new-password").value="";el("confirm-password").value="";
      const {error:out}=await client.auth.signOut();
      if(out){message("Senha alterada. Encerre a sessão e entre novamente.","success");return;}
      showAuth();message("Senha atualizada. Entre novamente.","success");
      history.replaceState(null,"",location.pathname+location.search);
    }catch{message("Erro ao redefinir a senha. Tente novamente.","error");}
    finally{setBusy(false);}
  });
  el("logout").addEventListener("click",async()=>{
    if(!client)return;el("logout").disabled=true;
    try {
      const {error}=await client.auth.signOut();if(error)throw error;
      recovering=false;showAuth();message("Sessão encerrada.","success");
    }catch{el("welcome").textContent="Não foi possível encerrar a sessão. Tente novamente.";}
    finally{el("logout").disabled=false;}
  });
  const config=window.PROXITI_PUBLIC_CONFIG||{};
  const url=String(config.url||"").trim(),key=String(config.publishableKey||"").trim();
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)||!key||!window.supabase?.createClient){
    el("setup").hidden=false;
    buttons.forEach(button=>button.disabled=true);
    return;
  }
  try {
    client=window.supabase.createClient(url.replace(/\/$/,""),key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"proxiti-central-session"}});
  }catch{el("setup").hidden=false;buttons.forEach(button=>button.disabled=true);return;}
  client.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY")recovering=true;
    if (event==="TOKEN_REFRESHED" && activeUserId===session?.user?.id && window.PROXITI_ACTIVE_SESSION) return;
    queueMicrotask(()=>{if(recovering)showAuth("reset");else void refresh(session);});
  });
  setBusy(false);
})();
