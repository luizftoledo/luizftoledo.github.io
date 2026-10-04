import sections from './sections.json';
import seed from './bu-snapshot.json';
import names from './candidates.json';
import {parseBu,type ParsedBu} from './bu-parser';
export type BuRecord=ParsedBu & {hash:string;auxUrl:string;url:string;auxGenerated:string;checkedAt:string;verifiedAt:string;stale?:boolean};
const records=new Map<string,BuRecord>((seed.records as BuRecord[]).map(r=>[`${r.code}-${r.zone}-${r.section}`,r]));
const checks=new Map<string,number>();let cursor=0;let running:Promise<void>|null=null;let lastErrors:string[]=[];
const root='https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/dados/zz';
export async function updateBoletins(){
 if(running){await running;return lastErrors;}
 running=(async()=>{lastErrors=[];const eligible=sections.filter(s=>Date.parse(s.closeAt)<=Date.now());if(!eligible.length)return;const batch=[];
 // Completar os novos campos de snapshots antigos sem interromper a busca por novas urnas.
 for(const s of eligible){const key=`${s.code}-${s.zone}-${s.section}`,r=records.get(key);if(batch.length>=12)break;if(!r||Number.isFinite(r.turnout)&&Number.isFinite(r.eligible)||Date.now()-(checks.get(key)??0)<60000)continue;checks.set(key,Date.now());batch.push({...s,key});}
 for(let i=0;i<eligible.length&&batch.length<18;i++){const s=eligible[cursor++%eligible.length],key=`${s.code}-${s.zone}-${s.section}`;if(Date.now()-(checks.get(key)??0)<60000)continue;checks.set(key,Date.now());batch.push({...s,key});}
 await Promise.all(batch.map(async s=>{const old=records.get(s.key);const auxUrl=`${root}/${s.code}/${s.zone}/${s.section}/p003220-zz-m${s.code}-z${s.zone}-s${s.section}-aux.json`;
 try{const response=await fetch(auxUrl,{signal:AbortSignal.timeout(4500)});if(response.status===404&&!old)return;if(!response.ok)throw Error('HTTP '+response.status);const a=await response.json() as {f:string;dg:string;hg:string;hashes:{hash:string;st:string;arq:{nm:string;tp:string}[]}[]};
 if(a.f?.toLowerCase()!=='o'||a.dg!=='04/10/2026')throw Error('Arquivo antigo ou não oficial');const active=a.hashes.filter(h=>['recebido','totalizado'].includes(h.st.toLowerCase()));
 if(active.length!==1){records.delete(s.key);return;}const h=active[0];if(!/^[a-zA-Z0-9]+$/.test(h.hash))throw Error('Hash inválido');
 const file=h.arq.find(f=>f.tp==='bu')?.nm;if(!file||!/^o03220zz\d{13}-bu\.dat$/.test(file))throw Error('BU ausente');
 const stamp=new Date().toISOString();if(old?.hash===h.hash&&Number.isFinite(old.turnout)&&Number.isFinite(old.eligible)){records.set(s.key,{...old,auxGenerated:a.dg+' '+a.hg,verifiedAt:stamp,stale:false});return;}
 const url=`${root}/${s.code}/${s.zone}/${s.section}/${h.hash}/${file}`;const responseBu=await fetch(url,{signal:AbortSignal.timeout(4500)});if(!responseBu.ok)throw Error('BU indisponível');const bytes=new Uint8Array(await responseBu.arrayBuffer());if(bytes.length>1000000)throw Error('BU excede limite');const parsed=parseBu(bytes,s.code,s.zone,s.section);
 records.set(s.key,{...parsed,hash:h.hash,auxUrl,url,auxGenerated:a.dg+' '+a.hg,checkedAt:stamp,verifiedAt:stamp,stale:false});
 }catch(error){lastErrors.push('Boletim TSE '+s.code+'/'+s.section+': '+(error instanceof Error?error.message:'falha'));if(old)records.set(s.key,{...old,stale:true});}}));})();
 try{await running;return lastErrors;}finally{running=null;}
}
export function boletinsFor(code:string){const rows=[...records.values()].filter(r=>r.code===code);const votes=new Map<string,number>();for(const row of rows)for(const v of row.votes)votes.set(v.number,(votes.get(v.number)??0)+v.votes);
 const sum=(field:'eligible'|'turnout'|'abstention'|'blank'|'nullVotes')=>rows.length&&rows.every(r=>Number.isFinite(r[field]))?rows.reduce((s,r)=>s+r[field],0):null;
 return {turnout:sum('turnout'),coveredElectorate:sum('eligible'),abstention:sum('abstention'),blank:sum('blank'),nullVotes:sum('nullVotes'),received:rows.length,expected:sections.filter(s=>s.code===code).length,stale:rows.some(r=>r.stale||Date.now()-Date.parse(r.verifiedAt)>600000),files:rows.map(r=>({url:r.url,auxUrl:r.auxUrl,section:r.section,generated:r.generated,auxGenerated:r.auxGenerated})),votes:(rows.length?[...new Set([...names.map(c=>c.number),...votes.keys()])].map(number=>[number,votes.get(number)??0] as [string,number]):[]).map(([number,votes])=>({number,votes,name:names.find(c=>c.number===number)?.name??'Candidato '+number,party:names.find(c=>c.number===number)?.party,pct:null as number|null})),checkedAt:rows.map(r=>r.verifiedAt).sort().at(-1)??null};
}
