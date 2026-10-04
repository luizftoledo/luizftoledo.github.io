export const BASE='https://resultados.tse.jus.br/oficial/ele2026/6257';
export const RESULT=BASE+'/dados/br/br-c0001-e006257-u.json';
export const INDEX=BASE+'/dados/br/br-e006257-ab.json';
export type Candidate={number:string;name:string;party:string;votes:number|null;pct:number|null};
export type StateResult={data:any;source:string;stale:boolean;error?:string};
export async function refreshStateResults(previous:Record<string,StateResult>,ufs:string[]){const results={...previous};await pool(ufs,async uf=>{const source=BASE+'/dados/'+uf.toLowerCase()+'/'+uf.toLowerCase()+'-c0001-e006257-u.json';try{const data=await get(source);if(data.tpabr!=='uf'||data.cdabr!==uf.toLowerCase())throw new Error('Abrangência da UF inválida');results[uf]={data,source,stale:false};}catch(e){results[uf]={data:previous[uf]?.data??null,source,stale:true,error:(e as Error).message};}});return results;}
export type Municipality={code:string;ibge:string;name:string;uf:string;source:string;indexSource:string;generated:string;status:string;sections:number|null;processed:number|null;electorate:number|null;turnout:number|null;valid:number|null;blank:number|null;nullVotes:number|null;votes:Candidate[];religionAvailable:boolean;stale?:boolean};
export type State={uf:string;name:string;sections:number|null;processed:number|null;electorate:number|null;turnout:number|null;generated:string;status:string};
export type Snapshot={checkedAt:string;national:any;municipal:Municipality[];states:State[];errors:string[];sheetUrl:string;religionSummary:any};
const cache=new Map<string,{value:any;signature:string}>();let next=0;
export function integer(value:unknown):number|null{return typeof value==='string'&&/^\d+$/.test(value)?Number(value):typeof value==='number'&&Number.isInteger(value)?value:null;}
export function published(d:any){return !!d&&d.f==='o'&&d.ele==='6257'&&d.t==='1'&&d.dt==='04/10/2026'&&d.dg==='04/10/2026'&&d.dv!=='n'&&(integer(d.s?.st)??0)>0;}
export function candidates(d:any):Candidate[]{return (d.carg??[]).filter((c:any)=>c.cd==='1').flatMap((c:any)=>c.agr.flatMap((a:any)=>a.par.flatMap((p:any)=>p.cand.map((v:any)=>({number:v.n,name:v.nmu??v.nm,party:p.sg,votes:published(d)?integer(v.vap):null,pct:published(d)&&v.pvapn!==undefined?Number(v.pvapn.replace(',','.'))/100:null})))));}
function valid(d:any){if(d.f!=='o'||d.ele!=='6257'||d.t!=='1')throw new Error('Arquivo de fase, eleição ou turno diferente');return d;}
async function get(url:string){const delay=Math.max(0,next-Date.now());next=Math.max(next,Date.now())+80;if(delay)await new Promise(r=>setTimeout(r,delay));const r=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(16000)});if(!r.ok)throw new Error('HTTP '+r.status);return valid(await r.json());}
async function pool<T>(rows:T[],fn:(row:T)=>Promise<void>){let i=0;await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{while(i<rows.length)await fn(rows[i++]);}));}
function stateFrom(row:any,index:any):State{return {uf:row.cdabr.toUpperCase(),name:row.cdabr.toUpperCase()==='ZZ'?'Exterior':row.cdabr.toUpperCase(),sections:integer(row.s?.ts),processed:index.dg==='04/10/2026'&&['04/10/2026','05/10/2026'].includes(row.dt)?integer(row.s?.st):null,electorate:integer(row.e?.te),turnout:['04/10/2026','05/10/2026'].includes(row.dt)&&(integer(row.s?.st)??0)>0?integer(row.e?.c):null,generated:index.dg+' '+index.hg,status:index.dg==='04/10/2026'&&['04/10/2026','05/10/2026'].includes(row.dt)&&(integer(row.s?.st)??0)>0?(row.and==='f'?'Concluído':'Parcial'):'Sem divulgação atual'};}
export async function refreshNational(previous:Snapshot):Promise<Snapshot>{
 const data:Snapshot={...previous,municipal:previous.municipal.map(m=>({...m,votes:[...m.votes]})),states:[...previous.states],errors:[]};
 let index:any=null;
 await Promise.all([get(RESULT).then(d=>{if(d.cdabr!=='br'||d.tpabr!=='br')throw new Error('Abrangência nacional inválida');data.national=d;}).catch(e=>data.errors.push('Resultado nacional: '+e.message)),get(INDEX).then(d=>{if(!Array.isArray(d.abr))throw new Error('Índice inválido');index=d;data.states=d.abr.filter((a:any)=>a.tpabr==='uf').map((a:any)=>stateFrom(a,d));}).catch(e=>data.errors.push('Índice nacional: '+e.message))]);
 if(index){
 const ready=index.abr.filter((a:any)=>a.tpabr==='uf'&&a.cdabr!=='zz'&&a.dt==='04/10/2026'&&index.dg==='04/10/2026'&&(integer(a.s?.st)??0)>0);
 await pool(ready,async(uf:any)=>{
  const url=BASE+'/dados/'+uf.cdabr+'/'+uf.cdabr+'-e006257-ab.json';const signature=[uf.dt,uf.ht,uf.s?.st,uf.and].join('|');let d:any;
  try{const old=cache.get(url);d=old?.signature===signature?old.value:await get(url);if(d.dg!=='04/10/2026')throw new Error('Índice municipal ainda anterior à votação');cache.set(url,{signature,value:d});}catch(e){data.errors.push(uf.cdabr.toUpperCase()+': '+(e as Error).message);data.municipal.filter(m=>m.uf===uf.cdabr.toUpperCase()).forEach(m=>m.stale=true);return;}
  const progress=new Map<string,any>(d.abr.filter((a:any)=>a.tpabr==='mun').map((a:any)=>[a.cdabr,a]));
  const municipalities=data.municipal.filter(m=>m.uf===uf.cdabr.toUpperCase());
  for(const m of municipalities){const p=progress.get(m.code);if(p){m.sections=integer(p.s?.ts);m.electorate=integer(p.e?.te);if(p.dt!=='04/10/2026'||(integer(p.s?.st)??0)===0){m.status='Sem divulgação atual';m.processed=null;m.votes=[];m.generated=d.dg+' '+d.hg;}}}
  await pool(municipalities.filter(m=>{const p=progress.get(m.code);return p?.dt==='04/10/2026'&&(integer(p.s?.st)??0)>0;}),async(m)=>{
   const p=progress.get(m.code),sig=[p.dt,p.ht,p.s.st,p.and].join('|');
   try{const old=cache.get(m.source);const r=old?.signature===sig?old.value:await get(m.source);if(!published(r)||!['mu','mun'].includes(r.tpabr)||r.cdabr!==m.code)throw new Error('Arquivo municipal sem dados atuais validados');const stale=r.dt!==p.dt||r.ht!==p.ht||r.s.st!==p.s.st||r.and!==p.and;if(!stale)cache.set(m.source,{signature:sig,value:r});
    Object.assign(m,{generated:r.dg+' '+r.hg,status:r.and==='f'&&integer(r.s.snt)===0&&!stale?'Concluído':'Parcial',processed:integer(r.s.st),sections:integer(r.s.ts),electorate:integer(r.e.te),turnout:integer(r.e.c),valid:integer(r.v.vv),blank:integer(r.v.vb),nullVotes:integer(r.v.tvn),votes:candidates(r),stale});
   }catch(e){m.stale=true;data.errors.push(m.name+'/'+m.uf+': '+(e as Error).message);}
  });
 });
 }
 data.checkedAt=new Date().toISOString();return data;
}

export async function refreshHeadline(){const [national,index]=await Promise.all([get(RESULT),get(INDEX)]);if(national.cdabr!=='br'||national.tpabr!=='br')throw new Error('Abrangência nacional inválida');return {national,states:index.abr.filter((a:any)=>a.tpabr==='uf').map((a:any)=>stateFrom(a,index)),checkedAt:new Date().toISOString()};}
