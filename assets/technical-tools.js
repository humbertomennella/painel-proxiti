(() => {
 "use strict";
 const el=id=>document.getElementById(id);
 const line=(label,value)=>label+": "+value;
 el("subnet-form").addEventListener("submit",event=>{
   event.preventDefault();
   const output=el("subnet-result");
   try{
     const result=window.PROXITI_TOOL_CORE.subnet(el("subnet-ip").value,el("subnet-cidr").value);
     output.textContent=[
       line("IP",result.address+"/"+result.prefix),
       line("Máscara",result.mask),
       line("Rede",result.network+"/"+result.prefix),
       line("Broadcast",result.broadcast),
       line("Primeiro endereço útil",result.first),
       line("Último endereço útil",result.last),
       line("Endereços utilizáveis",result.hosts.toLocaleString("pt-BR")),
       result.note
     ].filter(Boolean).join("\n");
   }catch(error){output.textContent=error.message||"Não foi possível calcular a rede.";}
 });
 el("hash-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const form=event.currentTarget,send=form.querySelector('[type="submit"]');
   const output=el("hash-result"),file=el("hash-file").files?.[0];
   if(!file)return;
   if(file.size>52428800||file.size===0){output.textContent="Escolha arquivo não vazio de até 50 MB.";return;}
   const reference=el("hash-reference").value.trim().toLowerCase();
   if(reference&&!/^[a-f0-9]{64}$/.test(reference)){
     output.textContent="O hash de referência deve ter exatamente 64 caracteres hexadecimais.";return;
   }
   if(!window.crypto?.subtle){output.textContent="Este navegador não permite SHA-256 seguro nesta página.";return;}
   send.disabled=true;output.textContent="Calculando localmente. O arquivo não é enviado…";
   try{
     const bytes=await file.arrayBuffer();
     const digest=await crypto.subtle.digest("SHA-256",bytes);
     const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
     output.textContent="SHA-256: "+hash+
       (reference?"\nComparação: "+(reference===hash?"igual ao valor informado":"DIFERENTE do valor informado"):"")+
       "\nO hash, por si só, não comprova a procedência do arquivo.";
   }catch{output.textContent="Não foi possível ler o arquivo neste navegador.";}
   finally{send.disabled=false;}
 });
 document.addEventListener("proxiti-session-ended",()=>{
   el("hash-form").reset();el("hash-result").textContent="Nenhum arquivo processado.";
   el("subnet-form").reset();el("subnet-result").textContent="Informe os valores para calcular.";
 });
})();
