import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const w={};const code=read("assets/commercial-core.js");
new Script(code,{filename:"commercial-core.js"});
runInNewContext(code,{window:w,Intl,Number,Error,String,Object,RegExp,Math});
const core=w.PROXITI_COMMERCIAL_CORE;
for(const [input,basis] of [["0",0],["0,5",50],["2,75",275],["12,50",1250],
 ["99,99",9999]])assert.equal(core.parsePercent(input),basis);
for(const bad of ["","-1","100","100,00","2.5","0,005","1e2","02","0,",
 "1.000,00","R$ 10"])assert.throws(()=>core.parsePercent(bad));
const input={minutes:90,hourlyCents:4000,travelCents:1200,
 materialsCents:800,otherCents:0,partnerCents:6000,feeBasis:350,
 marginBasis:2000};
const estimate=core.pricingEstimate(input);
assert.equal(estimate.laborCents,6000);
assert.equal(estimate.internalCents,8000);
assert.equal(estimate.baseCents,14000);
assert.equal(estimate.priceCents,18301);
assert(estimate.contributionBasis>=2000);
assert.equal(estimate.contributionCents,
 estimate.priceCents-estimate.baseCents-estimate.feeCents);
assert.equal(core.pricingEstimate({...input,feeBasis:0,marginBasis:0}).priceCents,14000);
for(const invalid of [{minutes:0},{minutes:10081},{partnerCents:-1},
 {feeBasis:8000,marginBasis:2000},{hourlyCents:1.5},
 {hourlyCents:0,travelCents:0,materialsCents:0,otherCents:0,partnerCents:0}])
 assert.throws(()=>core.pricingEstimate({...input,...invalid}));
const html=read("index.html"),ui=read("assets/commercial-v15.js"),
css=read("assets/commercial-v15.css");
for(const id of ["commercial-pricing-form","commercial-pricing-suggested",
 "commercial-pricing-internal","commercial-pricing-payout","commercial-pricing-apply",
 "commercial-pricing-feedback"]){
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 assert(ui.includes(id),"Campo desconectado: "+id);
}
assert(html.includes('id="ops-commercial" class="ops-view px-panel" hidden data-admin-only'));
assert(ui.includes("if(!ok()||!pricingPreview)return"));
assert(ui.includes('pricingPreview=null;el("commercial-pricing-result").hidden=true;'));
assert(!/localStorage|sessionStorage|fetch\(/.test(code),
 "A simulação de preços não deve armazenar ou transmitir valores.");
assert(css.includes(".commercial-price-lab")&&css.includes("@media(max-width:720px)"));
console.log("PASS: precificação em centavos, margem, validação, UI local e restrição administrativa V17.");
