(()=>{
"use strict";
const el=id=>document.getElementById(id);
const selfForm=el("partner-v17-self"),adminRoot=el("partner-v17-admin");
if(!selfForm||!adminRoot)return;
const labels={support:"Atendimento e suporte",computers:"Computadores",networks:"Redes",
 wifi:"Wi-Fi",backup:"Backup",security:"Segurança preventiva",infrastructure:"Infraestrutura",
 privacy:"Privacidade e acessos"};
const availability={available:"Disponível",limited:"Limitada",unavailable:"Indisponível"};
const exp={beginner:"Iniciando",developing:"Em desenvolvimento",experienced:"Experiente"};
const state={epoch:0,client:null,uid:null,own:null,rows:[]};
const session=()=>window.PROXITI_ACTIVE_SESSION||null;
const technician=()=>session()?.profile?.role==="technician"&&session()?.profile?.status==="active";
const admin=()=>session()?.profile?.role==="administrator"&&session()?.profile?.status==="active";
const valid=(c,u,e)=>state.client===c&&state.uid===u&&state.epoch===e&&session()?.user?.id===u;
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const data=result=>{if(result?.error)throw result.error;return result?.data;};
const listInput=value=>String(value||"").split(";").map(v=>v.trim()).filter(Boolean).slice(0,20);
function reset(){
 state.epoch++;state.client=null;state.uid=null;state.own=null;state.rows=[];
 selfForm.hidden=true;adminRoot.hidden=true;el("partner-v17-admin-list").replaceChildren();
 el("partner-v17-admin-status").textContent="";
}
function fillSelf(row){
 state.own=row||null;selfForm.hidden=!technician();if(!technician())return;
 el("partner-v17-headline").value=row?.headline||"";
 el("partner-v17-bio").value=row?.bio||"";
 el("partner-v17-experience").value=row?.experience_level||"beginner";
 const selected=new Set(row?.specialties||[]);
 for(const input of selfForm.querySelectorAll(".partner-v17-specialties input"))input.checked=selected.has(input.value);
 el("partner-v17-remote").checked=row?.accepts_remote??true;
 el("partner-v17-onsite").checked=!!row?.accepts_on_site;
 el("partner-v17-regions").value=(row?.regions||[]).join("; ");
 el("partner-v17-availability").value=row?.availability||"unavailable";
 el("partner-v17-availability-note").value=row?.availability_note||"";
 el("partner-v17-capacity").value=String(row?.max_concurrent||1);
 el("partner-v17-self-review").textContent=row?.approved_for_assignment?
  "Perfil operacional revisado pela administração. A aprovação não aceita novos serviços por você.":
  "Perfil ainda não habilitado administrativamente para seleção operacional. Seus estudos e certificados não substituem essa revisão.";
}
async function loadOwn(){
 const s=session();if(!technician()){selfForm.hidden=true;return;}
 const c=s.client,u=s.user.id,e=state.epoch;if(!valid(c,u,e))return;
 try{
  const row=await data(await c.from("partner_operational_profiles")
   .select("user_id,headline,bio,experience_level,specialties,regions,accepts_remote,accepts_on_site,availability,availability_note,max_concurrent,approved_for_assignment,reviewed_at")
   .eq("user_id",u).maybeSingle());
  if(valid(c,u,e))fillSelf(row);
 }catch(error){if(valid(c,u,e)){fillSelf(null);el("partner-v17-self-review").textContent="Não foi possível consultar a revisão administrativa: "+error.message;}}
}
function badge(text,kind=""){return make("span",text,"partner-v17-badge "+kind);}
function filterRows(){
 const av=el("partner-v17-filter-availability").value,sp=el("partner-v17-filter-specialty").value,
  mode=el("partner-v17-filter-mode").value;
 return state.rows.filter(r=>(!av||r.availability===av)&&(!sp||(r.specialties||[]).includes(sp))&&
  (!mode||(mode==="remote"?r.accepts_remote:r.accepts_on_site)));
}
function renderAdmin(){
 const host=el("partner-v17-admin-list");host.replaceChildren();if(!admin()){adminRoot.hidden=true;return;}
 const rows=filterRows();
 el("partner-v17-admin-status").textContent=rows.length+" de "+state.rows.length+" parceiro(s) nesta visualização.";
 if(!rows.length){host.append(make("p","Nenhum perfil corresponde aos filtros atuais.","partner-v17-empty"));return;}
 for(const row of rows){
  const card=make("article",undefined,"partner-v17-card");
  const head=make("div",undefined,"partner-v17-card-head");
  const title=make("div");title.append(make("strong",row.display_name||"Técnico sem nome"),
   make("small",(exp[row.experience_level]||row.experience_level)+" · "+row.open_tickets+" chamado(s) aberto(s)"));
  head.append(title,badge(availability[row.availability]||row.availability,"availability "+row.availability));
  card.append(head);
  if(row.headline)card.append(make("p",row.headline));
  const chips=make("div",undefined,"partner-v17-chips");
  for(const specialty of row.specialties||[])chips.append(badge(labels[specialty]||specialty));
  if(row.accepts_remote)chips.append(badge("Remoto","mode"));
  if(row.accepts_on_site)chips.append(badge("Presencial","mode"));
  if(row.approved_for_assignment)chips.append(badge("Revisado para seleção","approved"));
  card.append(chips);
  if(row.regions?.length)card.append(make("small","Regiões: "+row.regions.join(", "),"partner-v17-muted"));
  if(row.availability_note)card.append(make("small","Disponibilidade: "+row.availability_note,"partner-v17-muted"));
  card.append(make("small","Capacidade declarada: até "+row.max_concurrent+" atendimento(s) simultâneo(s).","partner-v17-muted"));
  const form=make("form",undefined,"partner-v17-review");
  const approve=make("label");const check=document.createElement("input");check.type="checkbox";check.checked=!!row.approved_for_assignment;
  approve.append(check,document.createTextNode(" Revisado para participar da seleção de atendimentos"));
  const noteLabel=make("label","Observação administrativa");const note=document.createElement("textarea");note.maxLength=800;note.rows=2;note.value=row.admin_note||"";noteLabel.append(note);
  const save=make("button","Salvar revisão","secondary");save.type="submit";
  form.append(approve,noteLabel,save);form.addEventListener("submit",event=>void review(event,row.user_id,check,note));
  card.append(form);host.append(card);
 }
}
async function loadAdmin(){
 const s=session();if(!admin()){adminRoot.hidden=true;return;}
 adminRoot.hidden=false;const c=s.client,u=s.user.id,e=state.epoch;if(!valid(c,u,e))return;
 el("partner-v17-admin-status").textContent="Consultando disponibilidade e revisão dos parceiros…";
 try{
  const rows=await data(await c.rpc("proxiti_partner_admin_list"));
  if(!valid(c,u,e))return;state.rows=Array.isArray(rows)?rows:[];renderAdmin();
 }catch(error){if(valid(c,u,e)){state.rows=[];renderAdmin();el("partner-v17-admin-status").textContent="Consulta indisponível: "+error.message;}}
}
async function saveSelf(event){
 event.preventDefault();const s=session();if(!technician())return;
 const specialties=[...selfForm.querySelectorAll(".partner-v17-specialties input:checked")].map(i=>i.value),
  regions=listInput(el("partner-v17-regions").value),onSite=el("partner-v17-onsite").checked;
 if(onSite&&!regions.length){el("partner-v17-self-review").textContent="Informe ao menos uma região para atendimento presencial.";return;}
 const payload={p_headline:el("partner-v17-headline").value.trim(),p_bio:el("partner-v17-bio").value.trim(),
  p_experience:el("partner-v17-experience").value,p_specialties:specialties,p_regions:regions,
  p_remote:el("partner-v17-remote").checked,p_on_site:onSite,p_availability:el("partner-v17-availability").value,
  p_availability_note:el("partner-v17-availability-note").value.trim(),p_capacity:Number(el("partner-v17-capacity").value)};
 event.submitter.disabled=true;el("partner-v17-self-review").textContent="Salvando disponibilidade…";
 try{await data(await s.client.rpc("proxiti_partner_save_self",payload));await loadOwn();
  el("partner-v17-self-review").textContent=(state.own?.approved_for_assignment?"Perfil atualizado e já revisado.":"Perfil atualizado. A habilitação administrativa continua sendo uma etapa separada.");
 }catch(error){el("partner-v17-self-review").textContent="Não foi possível salvar: "+error.message;}finally{event.submitter.disabled=false;}
}
async function review(event,userId,check,note){
 event.preventDefault();const s=session();if(!admin())return;const button=event.submitter;button.disabled=true;
 try{await data(await s.client.rpc("proxiti_partner_admin_review",{p_user:userId,p_approved:check.checked,p_admin_note:note.value.trim()}));await loadAdmin();}
 catch(error){el("partner-v17-admin-status").textContent="Não foi possível salvar a revisão: "+error.message;}finally{button.disabled=false;}
}
async function start(){
 const s=session();if(!s?.user||!s.client){reset();return;}
 state.epoch++;state.client=s.client;state.uid=s.user.id;
 selfForm.hidden=!technician();adminRoot.hidden=!admin();
 if(technician())void loadOwn();if(admin())void loadAdmin();
}
selfForm.addEventListener("submit",event=>void saveSelf(event));
for(const id of ["partner-v17-filter-availability","partner-v17-filter-specialty","partner-v17-filter-mode"])
 el(id).addEventListener("change",renderAdmin);
el("partner-v17-refresh").addEventListener("click",()=>void loadAdmin());
document.addEventListener("proxiti-session-ready",()=>void start());
document.addEventListener("proxiti-session-ended",reset);
document.addEventListener("proxiti-view-changed",event=>{if(event.detail?.view==="staff"&&admin())void loadAdmin();});
if(window.PROXITI_ACTIVE_SESSION)void start();
window.PROXITI_PARTNERS_V17={loadAdmin,loadOwn};
})();