import names from './candidates.json';
export type SummaryCountry={country:string;electorate:number|null;turnout:number|null;abstention:number|null;coveredElectorate:number|null;pendingElectorate:number|null;blank:number|null;nullVotes:number|null;received:number;buExpected:number;complete:boolean;buComplete:boolean;stale:boolean;source:string;votes:{number?:string;name:string;party?:string;votes:number}[]};
const format=(v:number|null)=>v===null?'—':v.toLocaleString('pt-BR');
const pct=(v:number|null)=>v===null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
export function summarize(countries:SummaryCountry[]){
 const withVotes=countries.filter(c=>c.votes.length),hasVotes=withVotes.length>0;
 const sum=(rows:SummaryCountry[],field:'electorate'|'turnout'|'abstention'|'pendingElectorate'|'blank'|'nullVotes')=>rows.length&&rows.every(c=>typeof c[field]==='number'&&Number.isFinite(c[field]))?rows.reduce((s,c)=>s+c[field]!,0):null;
 const votes=new Map<string,{number:string;name:string;party?:string;votes:number}>();
 if(hasVotes)for(const c of names)votes.set(c.number,{...c,votes:0});
 for(const c of withVotes)for(const v of c.votes){if(!v.number)continue;const old=votes.get(v.number);votes.set(v.number,{...v,number:v.number,votes:(old?.votes??0)+v.votes});}
 const candidates=[...votes.values()].sort((a,b)=>b.votes-a.votes||Number(a.number)-Number(b.number));
 return {hasVotes,candidates,nominal:hasVotes?candidates.reduce((s,v)=>s+v.votes,0):null,
 turnout:sum(withVotes,'turnout'),abstention:sum(withVotes,'abstention'),blank:sum(withVotes,'blank'),nullVotes:sum(withVotes,'nullVotes'),
 electorate:sum(countries,'electorate'),pendingElectorate:sum(countries,'pendingElectorate'),
 received:countries.reduce((s,c)=>s+(c.received??0),0),expected:countries.reduce((s,c)=>s+(c.buExpected??0),0),
 complete:countries.filter(c=>c.complete).length,buComplete:countries.filter(c=>c.buComplete).length,
 stale:withVotes.some(c=>c.stale),allComplete:!!countries.length&&countries.every(c=>c.complete),
 source:withVotes.every(c=>c.source==='BU TSE')?'Boletins de urna do TSE':withVotes.every(c=>c.source==='TSE')?'Totalização do TSE':'Totalização e boletins do TSE, sem duplicar municípios'};
}
export default function Overview({countries,loaded}:{countries:SummaryCountry[];loaded:boolean}){
 const s=summarize(countries),coverage=loaded&&s.expected&&s.received?100*s.received/s.expected:null;
 const missing=loaded&&s.expected?Math.max(0,s.expected-s.received):null;
 return <section className="overview" aria-labelledby="overview-title">
  <div className="overview-heading"><div><div className="eyebrow">PRESIDENTE · VOTOS NO EXTERIOR</div><h2 id="overview-title">Resumo até agora</h2></div><span className={'overview-status '+(s.stale?'old':s.allComplete?'done':'')}>{!loaded?'CONSULTANDO TSE':s.stale?'LEITURA ANTIGA':s.allComplete?'TOTALIZAÇÃO CONCLUÍDA':'RESULTADO PARCIAL'}</span></div>
  <div className="overview-coverage"><div><span>Urnas com boletim disponível</span><strong>{pct(coverage)}</strong></div><div className="coverage-bar" role="progressbar" aria-label="Urnas do exterior com boletim" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage??undefined} aria-valuetext={coverage===null?'Aguardando dados':pct(coverage)}><div style={{width:Math.min(100,coverage??0)+'%'}}/></div><p>{loaded&&s.expected?<><b>{format(s.received)} de {format(s.expected)} seções</b> · faltam {format(missing)} boletins</>:'Consultando cobertura nas fontes oficiais…'}</p></div>
  <div className="overview-numbers">
   <div><span>Já votaram · nos dados disponíveis</span><strong>{loaded?format(s.turnout):'—'}</strong><small>Comparecimento registrado nas urnas</small></div>
   <div><span>Eleitores aguardando dados</span><strong>{loaded?format(s.pendingElectorate):'—'}</strong><small>Eleitorado das seções ainda sem dados</small></div>
   <div><span>Abstenções já registradas</span><strong>{loaded?format(s.abstention):'—'}</strong><small>Ausências nas urnas com dados</small></div>
   <div><span>Eleitorado acompanhado</span><strong>{loaded?format(s.electorate):'—'}</strong><small>Cadastro TSE dos locais acompanhados</small></div>
  </div>
  <p className="overview-note">Quem aguarda dados pode já ter votado. Ainda não há como saber quantos brasileiros faltam votar. Comparecimento e abstenções só abrangem as urnas disponíveis.</p>
  <div className="overview-candidates">{[{number:'13',name:'Lula',party:'PT',tone:'lula'},{number:'22',name:'Flávio Bolsonaro',party:'PL',tone:'bolsonaro'}].map(c=>{const v=s.candidates.find(v=>v.number===c.number);const value=loaded&&s.hasVotes?(v?.votes??0):null;return <div key={c.number} className={'overview-candidate '+c.tone}><span>{c.name} <small>{c.number} · {c.party}</small></span><strong>{format(value)}</strong><div><span>votos registrados</span><b>{pct(value!==null&&s.nominal?100*value/s.nominal:null)}</b></div></div>;})}</div>
  <div className="overview-foot"><span><b>{loaded?format(s.nominal):'—'}</b> votos em candidatos</span><span><b>{loaded?format(s.blank):'—'}</b> brancos</span><span><b>{loaded?format(s.nullVotes):'—'}</b> nulos</span><span><b>{loaded?s.buComplete:'—'}</b> países com todos os BUs</span><span><b>{loaded?s.complete:'—'}</b> países com totalização concluída</span></div>
  <p className="overview-note">{loaded?s.source:'Fonte: TSE.'} Percentuais dos candidatos sobre os votos nominais disponíveis. Cobertura parcial não representa todo o eleitorado. Todos os BUs disponíveis não significam totalização concluída.</p>
  <details className="overview-all" open><summary>Total de votos de cada candidato</summary>{!loaded||!s.hasVotes?<p>Consultando votos nas fontes do TSE…</p>:<div className="overview-table"><table><thead><tr><th>Candidato / partido</th><th>Votos</th><th>% dos nominais</th></tr></thead><tbody>{s.candidates.map(c=><tr key={c.number}><td><span className={'candidate-dot '+(c.number==='13'?'lula':c.number==='22'?'bolsonaro':'')}/><b>{c.number}</b> · {c.name} <small>{c.party}</small></td><td>{format(c.votes)}</td><td>{pct(s.nominal?100*c.votes/s.nominal:null)}</td></tr>)}</tbody></table></div>}</details>
 </section>;
}
