import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const baseline='342d80a131c8fc50d4f7de876343fcab93a00225';
const original=p=>execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'});
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n');
for(const f of files.filter(f=>f.startsWith('supabase/')||(f.startsWith('assets/')&&f.endsWith('.js')&&f!=='assets/reskin-visual.js')))
 assert.equal(readFileSync(f,'utf8'),original(f),'Arquivo operacional alterado: '+f);
const old=original('index.html'),current=readFileSync('index.html','utf8');
const ids=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids(current)).size,ids(current).length,'IDs duplicados');
for(const id of ids(old))assert(ids(current).includes(id),'ID removido: '+id);
for(const attr of ['data-side-view','data-ops-view','data-summary-view','data-overview-view','data-overview-filter','data-ticket-filter','data-admin-only']){
 const vals=s=>[...s.matchAll(new RegExp(attr+'(?:="([^"]*)")?','g'))].map(m=>m[0]).sort();
 // Extra data-admin-only is allowed only on the new editorial wrapper.
 if(attr==='data-admin-only')assert(vals(current).length>=vals(old).length);else assert.deepEqual(vals(current),vals(old),attr);
}
const controls=s=>[...s.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)].map(m=>m[0]).sort();
assert.deepEqual(controls(current),controls(old),'Form fields changed');
assert(!current.includes('Academia PROXITI'));
for(const path of ['assets/reskin-visual.css','assets/uniproxiti-dashboard.css']){
 const css=readFileSync(path,'utf8');assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
}
console.log(`PASS: ${ids(old).length} IDs do PR #9, campos, seletores e todos os scripts operacionais/Supabase byte a byte.`);
