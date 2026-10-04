"""Extrai fontes oficiais, preservando votos indisponíveis como None.
Uso: python extract-national.py --output ./extracao [--thais arquivo.xlsx]
--thais é opcional e exige pandas para a conferência independente.
"""
import argparse, concurrent.futures, datetime, gzip, json, pathlib, urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--thais')
args=parser.parse_args();out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
base='https://resultados.tse.jus.br/oficial/ele2026/6257'
def fetch(url):
 with urllib.request.urlopen(url,timeout=60) as r:b=r.read()
 if b[:2]==b'\x1f\x8b':b=gzip.decompress(b)
 return json.loads(b)
def tse(url):
 d=fetch(url)
 if d['f']!='o' or ('ele' in d and d['ele']!='6257') or ('t' in d and d['t']!='1'):raise ValueError('Fase, eleição ou turno inválido')
 return d
roster=tse(base+'/config/mun-e006257-cm.json')
national=tse(base+'/dados/br/br-c0001-e006257-u.json')
categories=['95278','95263','95277','2826','2827','95274','95275','2836','12890','2837']
ufcodes={'ro':'11','ac':'12','am':'13','rr':'14','pa':'15','ap':'16','to':'17','ma':'21','pi':'22','ce':'23','rn':'24','pb':'25','pe':'26','al':'27','se':'28','ba':'29','mg':'31','es':'32','rj':'33','sp':'35','pr':'41','sc':'42','rs':'43','ms':'50','mt':'51','go':'52','df':'53'}
def extract_uf(area):
 uf=area['cd'];indexurl=f'{base}/dados/{uf}/{uf}-e006257-ab.json';idx=tse(indexurl)
 progress={a['cdabr']:a for a in idx['abr'] if a['tpabr']=='mun'}
 municipal=[]
 for m in area['mu']:
  p=progress[m['cd']];url=f"{base}/dados/{uf}/{uf}{m['cd']}-c0001-e006257-u.json"
  row={'uf':uf,'tse':m['cd'],'ibge':m['cdi'],'municipio':m['nm'],'source':url,'indexSource':indexurl,'indexGenerated':idx['dg']+' '+idx['hg'],'votes':None,'status':'Sem divulgação atual'}
  if idx['dg']=='04/10/2026' and p['dt']=='04/10/2026' and int(p['s']['st'])>0:
   r=tse(url)
   if r['cdabr']!=m['cd'] or r['tpabr'] not in ['mu','mun'] or r['dg']!='04/10/2026' or r['dt']!='04/10/2026' or r['dv']=='n' or int(r['s']['st'])==0:raise ValueError('Resultado municipal inválido')
   row['result']=r;row['votes']=[c for cargo in r['carg'] if cargo['cd']=='1' for ag in cargo['agr'] for par in ag['par'] for c in par['cand']];row['status']='Concluído' if r['and']=='f' and int(r['s']['snt'])==0 else 'Parcial'
  municipal.append(row)
 url=f'https://servicodados.ibge.gov.br/api/v3/agregados/9537/periodos/2022/variaveis/140|13495?localidades=N6[N3[{ufcodes[uf]}]]&classificacao=133[all]|2[6794]|58[95253]'
 source=fetch(url);religion={}
 for variable in source:
  for group in variable['resultados']:
   cat=next(iter(next(c for c in group['classificacoes'] if c['id']=='133')['categoria']))
   for s in group['series']:
    code=s['localidade']['id'];row=religion.setdefault(code,{'ibge':code,'municipio':s['localidade']['nome'],'uf':uf,'counts':{},'pct':{},'source':url})
    value=s['serie']['2022'];row['counts' if variable['id']=='140' else 'pct'][cat]=0 if value=='-' else None if value in ['...','..','X'] else int(value) if variable['id']=='140' else float(value)
 return municipal,list(religion.values())
municipal=[];religion=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for a,b in pool.map(extract_uf,[a for a in roster['abr'] if a['cd']!='zz']):municipal.extend(a);religion.extend(b)
result={'extractedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'national':national,'municipal':municipal,'religion':religion,'ibgeTable':9537,'ibgePeriod':2022,'population':'Pessoas de 10 anos ou mais; amostra; sexo total; idade total'}
if args.thais:
 import pandas as pd
 frame=pd.read_excel(args.thais,sheet_name='Tabela',header=None);reference={}
 for row in frame.itertuples(index=False,name=None):
  try:code=str(int(row[0]));assert len(code)==7
  except (ValueError,TypeError,AssertionError):continue
  if code in reference:raise ValueError('Código duplicado na referência: '+code)
  reference[code]={'counts':list(row[2:12]),'pct':list(row[13:22])}
 differences=[]
 for row in religion:
  code=row['ibge'];ref=reference.get(code)
  if ref is None:differences.append({'ibge':code,'issue':'Ausente na referência'});continue
  for i,c in enumerate(categories):
   if row['counts'][c]!=ref['counts'][i]:differences.append({'ibge':code,'category':c,'ibgeValue':row['counts'][c],'reference':ref['counts'][i]})
  for i,c in enumerate(categories[1:]):
   exact=row['counts'][c]/row['counts'][categories[0]]
   if abs(exact-ref['pct'][i])>1e-10:differences.append({'ibge':code,'category':c,'ibgeFraction':exact,'referenceFraction':ref['pct'][i]})
 result['comparison']={'municipalities':len(religion),'differences':differences,'missingIbge':sorted(set(reference)-{r['ibge'] for r in religion})}
(out/'reviewed.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'municipalities':len(municipal),'religionMunicipalities':len(religion),'currentResults':sum(r['votes'] is not None for r in municipal),'comparisonDifferences':len(result.get('comparison',{}).get('differences',[]))},ensure_ascii=False))
