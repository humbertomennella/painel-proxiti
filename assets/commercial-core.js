/* PROXITI | Valores em centavos; prévias locais nunca substituem o servidor. */
(()=>{
"use strict";
const statusLabels=Object.freeze({
 draft:"Rascunho",issued:"Enviado / aguardando resposta",
 accepted:"Aceito, com confirmação registrada",declined:"Recusado",cancelled:"Cancelado"
});
function parseMoney(input,{positive=false}={}){
 const value=String(input??"").trim();
 if(!/^(?:0|[1-9]\d{0,7})(?:,\d{1,2})?$/.test(value))
   throw new Error("Informe um valor em reais sem pontos de milhar. Ex.: 150,00.");
 const [real,cent=""]=value.split(",");
 const cents=Number(real)*100+Number(cent.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents>1000000000||(positive&&cents===0))
   throw new Error("Valor fora do limite permitido.");
 return cents;
}
function asMoney(cents){
 const value=Number(cents);
 if(!Number.isSafeInteger(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)
   throw new Error("Valor monetário inválido.");
 return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);
}
function lineCents(quantity,unitCents){
 const q=Number(quantity),unit=Number(unitCents);
 if(!Number.isSafeInteger(q)||q<1||q>1000||
   !Number.isSafeInteger(unit)||unit<0||unit>1000000000)
   throw new Error("Quantidade ou preço inválido.");
 return q*unit;
}
function paymentNet(rows){
 let net=0;
 for(const item of rows||[]){
   const amount=Number(item.amount_cents);
   if(!Number.isSafeInteger(amount)||amount<1)throw new Error("Movimento inválido");
   if(item.kind!=="received"&&item.kind!=="refunded")throw new Error("Movimento desconhecido");
   net+=item.kind==="received"?amount:-amount;
 }
 return net;
}
window.PROXITI_COMMERCIAL_CORE=Object.freeze({parseMoney,asMoney,lineCents,paymentNet,statusLabels});
})();
