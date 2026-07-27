"use strict";
class DatabaseManager{
  constructor(){this.name="FinanceFlowPro";this.version=1;this.db=null;this.stores=["lancamentos","contas","empresas","tiposCusto","centrosCusto","tiposMovimentacao","configuracoes","backupHistorico","auditLogs","anexos","lixeira","filtrosSalvos","periodosFechados","metadata"]}
  open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(this.name,this.version);r.onupgradeneeded=e=>{const d=e.target.result;this.stores.forEach(n=>{if(!d.objectStoreNames.contains(n)){const s=d.createObjectStore(n,{keyPath:"id"});if(n==="lancamentos"){["data","competencia","vencimento","empresa","conta","centroCusto","tipoCusto","tipoMov","status","natureza","ativo","updatedAt"].forEach(k=>s.createIndex(k,k,{unique:false}))}}})};r.onsuccess=()=>{this.db=r.result;resolve(this)};r.onerror=()=>reject(r.error)})}
  store(name,mode="readonly"){return this.db.transaction(name,mode).objectStore(name)}
  all(name){return new Promise((res,rej)=>{const r=this.store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  get(name,id){return new Promise((res,rej)=>{const r=this.store(name).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  put(name,value){return new Promise((res,rej)=>{const r=this.store(name,"readwrite").put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
  bulkPut(name,values){return new Promise((res,rej)=>{const tx=this.db.transaction(name,"readwrite");values.forEach(v=>tx.objectStore(name).put(v));tx.oncomplete=()=>res(values.length);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}
  remove(name,id){return new Promise((res,rej)=>{const r=this.store(name,"readwrite").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
  clear(name){return new Promise((res,rej)=>{const r=this.store(name,"readwrite").clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
}
const DB=new DatabaseManager();
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const LegacyMigration={
  key:"financeflow_db",
  async run(){
    if(await DB.get("metadata","legacy-migration-v1")) return {status:"already"};
    const raw=localStorage.getItem(this.key);if(!raw)return {status:"none"};
    let old;try{old=JSON.parse(raw)}catch(e){return {status:"invalid",error:e.message}}
    localStorage.setItem("financeflow_legacy_backup_v1",raw);
    const map={contas:"contas",empresas:"empresas",tipoCusto:"tiposCusto",centroCusto:"centrosCusto",tipoMov:"tiposMovimentacao"};
    const counts={};
    for(const [legacy,store] of Object.entries(map)){const items=(old[legacy]||[]).map(v=>typeof v==="string"?{id:uid(),nome:v,ativo:true,createdAt:now(),updatedAt:now()}:{id:v.id||uid(),nome:v.nome||v.descricao||"Sem nome",ativo:v.ativo!==false,...v,updatedAt:v.updatedAt||now()});await DB.bulkPut(store,items);counts[store]=items.length}
    const entries=(old.lancamentos||[]).map(l=>({id:l.id||uid(),descricao:l.descricao||"Sem descrição",data:l.data||new Date().toISOString().slice(0,10),competencia:(l.competencia||l.data||"").slice(0,7),vencimento:l.vencimento||"",empresa:l.empresa||"",conta:l.conta||"",centroCusto:l.centroCusto||"",tipoCusto:l.tipoCusto||"",tipoMov:l.tipoMov||"",entrada:Number(l.entrada)||0,saida:Number(l.saida)||0,natureza:Number(l.entrada)>0?"entrada":"saida",status:l.status||"pago",observacoes:l.observacoes||"",ativo:true,createdAt:l.createdAt||now(),updatedAt:now()}));
    await DB.bulkPut("lancamentos",entries);counts.lancamentos=entries.length;
    await DB.put("metadata",{id:"legacy-migration-v1",migrationVersion:1,migratedAt:now(),source:"localStorage",validated:true,counts});
    await DB.put("auditLogs",{id:uid(),acao:"MIGRACAO_LEGADA",createdAt:now(),detalhes:counts});
    return {status:"migrated",counts}
  }
};
