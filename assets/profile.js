(() => {
"use strict";
const el=id=>document.getElementById(id);
const initial="./assets/favicon.svg";
let db=null,user=null,avatarPath=null,previewUrl=null,serial=0;
const msg=(s,failed=false)=>{const n=el("profile-feedback");n.hidden=!s;n.textContent=s;n.className="message"+(failed?" error":s?" success":"");};
const namePart=s=>String(s||"").trim().split(/[.\s_-]+/).filter(Boolean)[0]||"Profissional";
function greeting(name){
 const first=namePart(name),h=new Date().getHours();
 return (h<12?"Bom dia":h<18?"Boa tarde":"Boa noite")+", "+first.charAt(0).toLocaleUpperCase("pt-BR")+first.slice(1);
}
async function showAvatar(path){
 const mine=++serial;
 let src=initial;
 if(db&&path){
   const {data,error}=await db.storage.from("proxiti-avatars").createSignedUrl(path,3600);
   if(!error&&data?.signedUrl)src=data.signedUrl;
 }
 if(mine!==serial)return;
 el("avatar-top").src=src;el("profile-avatar-preview").src=src;
}
function applyName(name){
 el("person-name").textContent=name;
 el("welcome").textContent=greeting(name);
 el("profile-name-input").value=name;
 if(window.PROXITI_ACTIVE_SESSION?.profile){
   window.PROXITI_ACTIVE_SESSION.profile.display_name=name;
 }
 document.dispatchEvent(new CustomEvent("proxiti-profile-updated",{detail:{display_name:name,avatar_path:avatarPath}}));
}
function stop(){
 db=null;user=null;avatarPath=null;serial++;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 el("profile-name-form").reset();el("profile-avatar-form").reset();el("profile-password-form").reset();
 el("avatar-top").src=initial;el("profile-avatar-preview").src=initial;msg("");
}
async function start(e){
 const {client,user:person,profile}=e.detail;
 if(db===client&&user?.id===person.id && avatarPath===profile.avatar_path){
   applyName(profile.display_name||person.email?.split("@")[0]||"Profissional");
   return;
 }
 db=client;user=person;avatarPath=profile.avatar_path||null;
 applyName(profile.display_name||person.email?.split("@")[0]||"Profissional");
 await showAvatar(avatarPath);
}
document.addEventListener("proxiti-session-ready",e=>{void start(e);});
document.addEventListener("proxiti-session-ended",stop);
if(window.PROXITI_ACTIVE_SESSION)void start({detail:window.PROXITI_ACTIVE_SESSION});
el("open-profile").addEventListener("click",()=>window.PROXITI_OPEN_VIEW?.("profile"));
el("profile-name-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!db||!user)return;
 const button=e.currentTarget.querySelector('button[type="submit"]'),value=el("profile-name-input").value.trim();
 if(value.length<2||value.length>120){msg("Digite um nome entre 2 e 120 caracteres.",true);return;}
 button.disabled=true;msg("Salvando seu nome…");
 try{
   const {data,error}=await db.rpc("proxiti_update_my_name",{p_name:value});
   if(error)throw error;
   applyName(data||value);msg("Seu nome foi atualizado em toda a Central Técnica.");
 }catch(error){msg(error.message||"Não foi possível atualizar seu nome.",true);}
 finally{button.disabled=false;}
});
el("profile-avatar-input").addEventListener("change",()=>{
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 const file=el("profile-avatar-input").files[0];
 if(file) {previewUrl=URL.createObjectURL(file);el("profile-avatar-preview").src=previewUrl;}
 else void showAvatar(avatarPath);
});
el("profile-avatar-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!db||!user)return;
 const file=el("profile-avatar-input").files[0],button=e.currentTarget.querySelector('button[type="submit"]');
 const mime={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"};
 if(!file||!mime[file.type]||file.size>2097152||file.size===0){
   msg("Escolha uma imagem JPG, PNG ou WebP de até 2 MB.",true);return;
 }
 button.disabled=true;msg("Enviando sua foto privada…");
 let path=null;
 try{
   path=user.id+"/"+crypto.randomUUID()+mime[file.type];
   const {error:uploadError}=await db.storage.from("proxiti-avatars").upload(path,file,
     {upsert:false,contentType:file.type,cacheControl:"3600"});
   if(uploadError)throw uploadError;
   const {error}=await db.rpc("proxiti_set_my_avatar",{p_path:path});
   if(error)throw error;
   const old=avatarPath;avatarPath=path;
   if(window.PROXITI_ACTIVE_SESSION?.profile)window.PROXITI_ACTIVE_SESSION.profile.avatar_path=path;
   await showAvatar(path);
   if(old&&old!==path)void db.storage.from("proxiti-avatars").remove([old]);
   e.currentTarget.reset();
   if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
   msg("Foto atualizada no cabeçalho e no seu perfil.");
 }catch(error){
   if(path&&avatarPath!==path)void db.storage.from("proxiti-avatars").remove([path]);
   msg(error.message||"Não foi possível enviar sua foto.",true);
 }finally{button.disabled=false;}
});
el("profile-avatar-remove").addEventListener("click",async()=>{
 if(!db||!user||!avatarPath)return;
 if(!window.confirm("Remover sua foto do painel?"))return;
 const old=avatarPath,button=el("profile-avatar-remove");button.disabled=true;
 try{
   const {error}=await db.rpc("proxiti_set_my_avatar",{p_path:null});
   if(error)throw error;
   avatarPath=null;
   if(window.PROXITI_ACTIVE_SESSION?.profile)window.PROXITI_ACTIVE_SESSION.profile.avatar_path=null;
   await showAvatar(null);
   void db.storage.from("proxiti-avatars").remove([old]);
   el("profile-avatar-form").reset();msg("Foto removida. O emblema da PROXITI será exibido.");
 }catch(error){msg(error.message||"Não foi possível remover a foto.",true);}
 finally{button.disabled=false;}
});
el("profile-password-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!db)return;
 const first=el("profile-password").value,second=el("profile-password-confirm").value;
 if(first.length<12||first!==second){msg("A senha deve ter pelo menos 12 caracteres e as confirmações devem coincidir.",true);return;}
 const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;msg("Atualizando senha…");
 try{
   const {error}=await db.auth.updateUser({password:first});
   if(error)throw error;
   e.currentTarget.reset();
   const result=await db.auth.signOut();
   if(result.error)throw result.error;
   const feedback=el("feedback");feedback.textContent="Senha atualizada. Entre novamente.";feedback.className="message success";feedback.hidden=false;
 }catch(error){msg(error.message||"A troca de senha não pôde ser concluída.",true);}
 finally{button.disabled=false;}
});
})();