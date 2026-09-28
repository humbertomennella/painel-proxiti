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
/* Simulação local: não substitui preço contratado, tributos ou cálculo contábil. */
function parsePercent(input){
 const value=String(input??"").trim();
 if(!/^(?:0|[1-9]\d?)(?:,\d{1,2})?$/.test(value))
   throw new Error("Informe uma porcentagem de 0 a 99,99. Ex.: 12,50.");
 const [whole,fraction=""]=value.split(",");
 const basis=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(basis)||basis>9999)
   throw new Error("Porcentagem fora do limite.");
 return basis;
}
function pricingEstimate({minutes,hourlyCents,travelCents,materialsCents,otherCents,
 partnerCents,feeBasis,marginBasis}){
 const time=Number(minutes);
 if(!Number.isSafeInteger(time)||time<1||time>10080)
   throw new Error("Informe duração de 1 a 10080 minutos.");
 for(const n of [hourlyCents,travelCents,materialsCents,otherCents,partnerCents]){
   if(!Number.isSafeInteger(n)||n<0||n>1000000000)
     throw new Error("Custo fora do limite.");
 }
 for(const n of [feeBasis,marginBasis]){
   if(!Number.isSafeInteger(n)||n<0||n>9999)
     throw new Error("Percentual inválido.");
 }
 if(feeBasis+marginBasis>=10000)
   throw new Error("A soma das taxas e da margem desejada deve ser menor que 100%.");
 const laborCents=Math.ceil(hourlyCents*time/60);
 const internalCents=laborCents+travelCents+materialsCents+otherCents;
 const baseCents=internalCents+partnerCents;
 if(baseCents===0)throw new Error("Informe ao menos um custo real para simular.");
 const denominator=10000-feeBasis-marginBasis;
 let priceCents=Math.ceil(baseCents*10000/denominator);
 if(priceCents>1000000000)throw new Error("Preço simulado acima do limite de cadastro.");
 let feeCents=Math.ceil(priceCents*feeBasis/10000);
 let contributionCents=priceCents-baseCents-feeCents;
 while(contributionCents*10000<priceCents*marginBasis){
   priceCents++;
   if(priceCents>1000000000)throw new Error("Preço simulado acima do limite de cadastro.");
   feeCents=Math.ceil(priceCents*feeBasis/10000);
   contributionCents=priceCents-baseCents-feeCents;
 }
 return Object.freeze({laborCents,internalCents,partnerCents,baseCents,
  feeCents,contributionCents,priceCents,
  contributionBasis:Math.floor(contributionCents*10000/priceCents)});
}
window.PROXITI_COMMERCIAL_CORE=Object.freeze({parseMoney,parsePercent,pricingEstimate,asMoney,lineCents,paymentNet,statusLabels});
})();
