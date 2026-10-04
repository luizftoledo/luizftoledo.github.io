import localidades from './localidades.json';
import fallback from './fallback.json';
import {updateBoletins,boletinsFor} from './bu-server';

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026/6257';
const INDEX = BASE + '/dados/zz/zz-e006257-ab.json';
type Candidate = { n: string; nm: string; nmu?: string; vap: string; pvap: string };
type Tse = { f: string; ele: string; dg: string; hg: string; dt: string; ht: string; and: string; cdabr: string; tpabr: string; s: Record<string,string>; e?: Record<string,string>; carg?: {cd:string; agr:{par:{sg:string; cand:Candidate[]}[]}[]}[]; abr?: Tse[] };
export type Vote = {name: string; votes:number; pct:number|null; party?:string; number?:string};
const n = (s: unknown) => Number(String(s ?? 0).replaceAll('.','')) || 0;
type SourceValue = {body:string; checkedAt:string; retryAt?:number; etag?:string; modified?:string};
// Sites dispatch does not expose the default Cache API. Keep a bounded,
// isolate-local cache; cold starts still consult sources and retain the fallback.
const sourceCache = new Map<string, SourceValue>();
function remember(key:string, value:SourceValue) {
  sourceCache.delete(key);
  sourceCache.set(key,value);
  while(sourceCache.size>256 || [...sourceCache.values()].reduce((sum,v)=>sum+v.body.length,0)>12_000_000) {
    sourceCache.delete(sourceCache.keys().next().value!);
  }
}

async function limitedText(response: Response, max = 4_000_000) {
  if (!response.body) throw new Error('Resposta vazia');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const r = await reader.read(); if (r.done) break; size += r.value.byteLength; if (size > max) {await reader.cancel();throw new Error('Fonte excedeu o tamanho permitido');} chunks.push(r.value); }
  const bytes = new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(bytes);
}

async function cachedSource(url: string, request: Request, ttl: number, errors: string[], signature = '', throttle?:()=>Promise<void>) {
  const key = url + signature;
  const old = sourceCache.get(key) ?? null;
  if (old && (Date.now() - Date.parse(old.checkedAt) < ttl || (old.retryAt ?? 0) > Date.now())) {
    if(old.retryAt) errors.push('Fonte em espera após falha: '+ new URL(url).hostname);
    return {...old, stale:!!old.retryAt};
  }
  try {
    const headers: Record<string,string> = {'User-Agent':'Mesa-live-eleicoes/1.0'};
    if(old?.etag) headers['If-None-Match']=old.etag;
    else if(old?.modified) headers['If-Modified-Since']=old.modified;
    if(throttle)await throttle();
    const upstream=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
    if(upstream.status!==304&&!upstream.ok) throw new Error('HTTP '+upstream.status);
    const body=upstream.status===304&&old?old.body:await limitedText(upstream);
    const value={body,checkedAt:new Date().toISOString(),etag:upstream.headers.get('ETag')??old?.etag,modified:upstream.headers.get('Last-Modified')??old?.modified};
    remember(key,value);
    return {...value,stale:false};
  } catch(error) {
    errors.push(new URL(url).hostname + ': '+ (error instanceof Error ? error.message : 'falha'));
    if(old){remember(key,{...old,retryAt:Date.now()+(String(error).includes('HTTP 403')||String(error).includes('HTTP 404')?660000:5000)});return {...old,stale:true};}
    return null;
  }
}

function candidates(data:Tse):Vote[]{
  return (data.carg??[]).filter(c=>c.cd==='1').flatMap(c=>c.agr.flatMap(a=>a.par.flatMap(p=>p.cand.map(v=>({name:v.nmu??v.nm,votes:n(v.vap),number:v.n,party:p.sg,pct:null})))));
}

function publicationTime(stamp:string):string|null {
  const match=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(stamp);
  if(!match)return null;
  const [,day,month,year,hour,minute,second]=match;
  return new Date(Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour)+3,Number(minute),Number(second))).toISOString();
}

export async function liveData(request:Request){
  const errors:string[]=[];
  errors.push(...await updateBoletins());
  const indexSource=await cachedSource(INDEX,request,5000,errors);
  let index:Tse[]=[];let tseAt=fallback.checkedAt;let tseStale=true;let generated='';
  if(indexSource){try{const d=JSON.parse(indexSource.body) as Tse;if(d.f!=='o'||d.ele!=='6257'||!d.abr)throw new Error('Configuração inesperada');index=d.abr.filter(a=>a.tpabr==='mun');tseAt=indexSource.checkedAt;tseStale=indexSource.stale;generated=d.dg+' '+d.hg;}catch{errors.push('Arquivo TSE não validado; última leitura preservada');}}
  if(!index.length)index=fallback.index as unknown as Tse[];
  const byCode=new Map(index.map(x=>[x.cdabr,x]));
  const rows=localidades.map(l=>({...l,progress:byCode.get(l.codigo),result:null as Tse|null,stale:true,url:BASE+'/dados/zz/zz'+l.codigo+'-c0001-e006257-u.json'}));
  const ready=rows.filter(x=>!x.dispensada&&n(x.progress?.s?.st)>0);
  // Somente municípios alterados no índice provocam novo download.
  let nextRequest=Date.now();
  const throttle=async()=>{const delay=Math.max(0,nextRequest-Date.now());nextRequest=Math.max(nextRequest,Date.now())+15;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));};
  for(let offset=0;offset<ready.length;offset+=24){await Promise.all(ready.slice(offset,offset+24).map(async row=>{const source=await cachedSource(row.url,request,86400000,errors,JSON.stringify([row.progress?.dt,row.progress?.ht,row.progress?.s?.st,row.progress?.and]),throttle);if(!source)return;try{const d=JSON.parse(source.body) as Tse;if(d.f!=='o'||d.ele!=='6257'||d.cdabr!==row.codigo)throw new Error('Abrangência inesperada');row.result=d;row.stale=source.stale||d.dt!==row.progress?.dt||d.ht!==row.progress?.ht||n(d.s.st)!==n(row.progress?.s.st)||d.and!==row.progress?.and;}catch{errors.push('Resultado municipal não validado: '+row.cidade);}}));}
  const countries=[...new Set(rows.map(r=>r.pais))].map(country=>{
    const cities=rows.filter(r=>r.pais===country);const active=cities.filter(r=>!r.dispensada);
    const buCities=active.map(c=>({...c,bu:boletinsFor(c.codigo)}));
    const hasTotalized=active.some(c=>c.result&&n(c.result.s.st)>0);
    const publishedAt=buCities.flatMap(c=>hasTotalized?(c.result?[publicationTime(c.result.dg+' '+c.result.hg)]:[]):c.bu.files.map(f=>publicationTime(f.auxGenerated))).filter((v):v is string=>v!==null).sort().at(-1)??null;
    const received=buCities.reduce((s,c)=>s+c.bu.received,0),buExpected=buCities.reduce((s,c)=>s+c.bu.expected,0);
    const voteMap=new Map<string,Vote>();
    for(const city of buCities){const list=hasTotalized?(city.result?candidates(city.result):[]):city.bu.votes;for(const v of list){const old=voteMap.get(v.number!);voteMap.set(v.number!,{...v,votes:v.votes+(old?.votes??0)});}}
    const votes=[...voteMap.values()].sort((a,b)=>b.votes-a.votes);const total=votes.reduce((s,v)=>s+v.votes,0);votes.forEach(v=>v.pct=total?100*v.votes/total:0);
    const processed=active.reduce((s,c)=>s+n(c.progress?.s?.st),0);const expected=active.reduce((s,c)=>s+n(c.progress?.s?.ts),0);
    const complete=!!active.length&&!tseStale&&active.every(c=>c.result&&!c.stale&&c.result.and==='f'&&c.result.dt&&n(c.result.s.snt)===0&&n(c.result.s.st)>0);
    const official=hasTotalized&&total>0;const shownVotes=votes;const tie=shownVotes.length>1&&shownVotes[0].votes===shownVotes[1].votes;
    const closes=active.map(c=>c.fecha_utc).sort();const opens=active.map(c=>c.primeiro_fecha_utc).sort();
    return {country,active:active.length>0,cities:buCities.map(c=>({name:c.cidade,code:c.codigo,url:c.url,processed:n(c.progress?.s?.st),expected:n(c.progress?.s?.ts),received:c.bu.received,buExpected:c.bu.expected,files:c.bu.files})),closeAt:closes.at(-1)??null,firstCloseAt:opens[0]??null,
      electorate:active.every(c=>c.progress?.e?.te!==undefined)?active.reduce((sum,c)=>sum+n(c.progress?.e?.te),0):null,publishedAt,received,buExpected,buPct:buExpected&&received?received/buExpected*100:null,buComplete:buExpected>0&&received===buExpected&&!buCities.some(c=>c.bu.stale),processed,expected,pct:expected?processed/expected*100:null,votes:shownVotes,officialVotes:votes,complete,tie,
      source:hasTotalized?'TSE':'BU TSE',status:!active.length?'Votação dispensada':complete?(tie?'Empate confirmado':'Mais votado · TSE concluído'):official?'Apuração parcial · TSE':received?(received===buExpected?'Todos os boletins disponíveis · aguardando totalização':'Boletins parciais · TSE'):'Aguardando boletins / totalização',
      stale:hasTotalized?tseStale||active.some(c=>c.stale):received?buCities.some(c=>c.bu.stale):false,
      checkedAt:hasTotalized?tseAt:buCities.map(c=>c.bu.checkedAt).filter(Boolean).sort().at(-1)??tseAt,warnings:[...(country.startsWith('Bélgica')?['Bruxelas reúne Bélgica e Luxemburgo. Não há separação dos países no arquivo municipal.']:[])]};
  });
  return {totalizationAvailable:index.some(r=>r.dt==='04/10/2026'&&n(r.s?.st)>0),checkedAt:new Date().toISOString(),tseAt,tseStale,generated,countries,errors:[...new Set(errors)],indexUrl:INDEX};
}
