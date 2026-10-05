export type ArticleRow={uf:string;name:string;region:string;oldLulaPct:number;lulaPct:number|null;lulaDelta:number|null;processed:number|null;total:number|null;coverage:number|null;generated:string;stale:boolean};
const format=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const list=(xs:string[])=>xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' e '+xs.at(-1);
export function lulaArticle(rows:ArticleRow[]):string|null{
 if(rows.length!==27||rows.some(r=>r.lulaPct===null||r.lulaDelta===null||r.processed===null||r.total===null))return null;
 const get=(uf:string)=>rows.find(r=>r.uf===uf)!,rank=(group:ArticleRow[])=>group.filter(r=>(r.lulaDelta??0)<-.005).sort((a,b)=>(a.lulaDelta??0)-(b.lulaDelta??0));
 const lost=rank(rows),gains=rows.filter(r=>(r.lulaDelta??0)>=.005),top=lost[0],st=rows.reduce((v,r)=>v+(r.processed??0),0),ts=rows.reduce((v,r)=>v+(r.total??0),0),stamps=rows.map(r=>r.generated).sort();
 const detail=(r:ArticleRow)=>`${r.name} (de ${format(r.oldLulaPct)}% para ${format(r.lulaPct!)}%, queda de ${format(-r.lulaDelta!)} pontos percentuais)`;
 const group=(region:string)=>rows.filter(r=>r.region===region),ne=rank(group('Nordeste')).slice(0,3),se=rank(group('Sudeste')).slice(0,2),north=rank(group('Norte')).slice(0,3);
 const full=(uf:string)=>{const r=get(uf);return `Em ${r.name}, Lula passou de ${format(r.oldLulaPct)}% para ${format(r.lulaPct!)}%, queda de ${format(-r.lulaDelta!)} pontos percentuais, com ${format(r.coverage??0)}% das seções totalizadas.`;};
 return [
 `O presidente Luiz Inácio Lula da Silva (PT) perdeu participação nos votos válidos em ${lost.length} das 27 unidades da Federação em 2026, em relação a 2022, segundo os resultados parciais do TSE, com ${format(st/ts*100)}% das seções no Brasil totalizadas, sem incluir o exterior.`,
 `As únicas exceções foram ${list(gains.map(r=>r.name).sort((a,b)=>a.localeCompare(b,'pt-BR')))}, onde o petista teve participação ligeiramente maior entre as duas eleições.`,
 `${top.name} foi o Estado onde Lula teve maior perda de participação entre as duas eleições, passando de ${format(top.oldLulaPct)}% para ${format(top.lulaPct!)}% dos votos válidos, queda de ${format(-top.lulaDelta!)} pontos percentuais. O Estado estava com ${format(top.coverage??0)}% das seções totalizadas.`,
 `No Nordeste, reduto eleitoral histórico do PT, Lula perdeu participação em ${rank(group('Nordeste')).length===9?'todos os Estados':rank(group('Nordeste')).length+' Estados'}. As maiores perdas foram no ${list(ne.map(detail))}.`,
 `No Sudeste, que concentra a maior parcela do eleitorado brasileiro, as maiores perdas foram em ${list(se.map(r=>r.name))}. ${se.map(r=>full(r.uf)).join(' ')} Mas ${list(group('Sudeste').filter(r=>!se.includes(r)&&(r.lulaDelta??0)<-.005).map(r=>r.name))} também registraram participação menor para o petista.`,
 `No Sul, Lula perdeu participação em todos os Estados: Rio Grande do Sul, Paraná e Santa Catarina. As quedas foram de ${list(['RS','PR','SC'].map(uf=>format(-get(uf).lulaDelta!)))} pontos percentuais, respectivamente. A apuração estava em ${list(['RS','PR','SC'].map(uf=>format(get(uf).coverage??0)+'%'))}.`,
 `No Centro-Oeste, além de Goiás, ele também perdeu participação em Mato Grosso e Mato Grosso do Sul. As quedas foram de ${format(-get('MT').lulaDelta!)} e ${format(-get('MS').lulaDelta!)} pontos percentuais, com ${format(get('MT').coverage??0)}% e ${format(get('MS').coverage??0)}% das seções totalizadas, respectivamente.`,
 `Na região Norte, as maiores perdas foram em ${list(north.map(detail))}. ${north.map(r=>`${r.name}: ${format(r.coverage??0)}% das seções totalizadas${r.processed===r.total?' (apuração concluída)':''}`).join('; ')}.`,
 `A comparação considera o primeiro turno das duas eleições. Os resultados de 2022 estão completos, enquanto os de 2026 ainda são parciais em parte dos Estados.`,
 `Arquivos do TSE gerados de ${stamps[0]} a ${stamps.at(-1)}, nos horários registrados pela fonte.${rows.some(r=>r.stale)?' Há leituras antigas preservadas após falha de atualização, identificadas na tabela.':''}`
 ,`Quanto Lula perdeu de participação nos votos em cada Estado:\n\n${rows.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(r=>`${r.name}: ${format(r.lulaPct!)}% em 2026, ante ${format(r.oldLulaPct)}% em 2022, ${r.lulaDelta!>=0?'alta':'queda'} de ${format(Math.abs(r.lulaDelta!))} pontos percentuais.`).join('\n')}`
 ].join('\n\n');
}
