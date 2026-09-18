# Raspagem do SIGSIF (MAPA) — guia para apuração

Dados do Serviço de Inspeção Federal: quem são os ~3,2 mil frigoríficos e
laticínios fiscalizados pelo governo federal, para quais países estão
habilitados a exportar, quando perderam essa habilitação e quantas carcaças
foram condenadas.

Duas fontes, que **não são equivalentes**:

| Fonte | O que tem | Custo |
|---|---|---|
| [Portal de dados abertos](https://dados.agricultura.gov.br/dataset/servico-de-inspecao-federal-sif) (CKAN) | 11 CSVs, incluindo 2,2 mi de linhas de condenação | segundos |
| [Consulta pública SIGSIF](https://extranet.agricultura.gov.br/sigsif_cons/!ap_estabelec_nacional_cons) | ficha por estabelecimento, com histórico de ocorrências | ~1h |

Números conferidos em 18/09/2026: **3.166 estabelecimentos ativos** no site,
3.147 SIFs distintos no CSV aberto.

## Uso

```bash
python3 sigsif_scraper.py bulk      # baixa os CSVs do portal
python3 sigsif_scraper.py lista     # varre os ~3,2 mil estabelecimentos
python3 sigsif_scraper.py detalhe   # abre a ficha de cada um (retomável)
python3 analise_pautas.py           # recortes de interesse jornalístico
```

## O que foi preciso descobrir para raspar

**1. User-Agent é obrigatório.** Sem ele o SIGSIF derruba a conexão sem
resposta (`curl: (52)`) e o portal de dados abertos devolve 403. Não é
bloqueio de política: é filtro de cliente.

**2. A trava de busca é só do navegador.** O formulário exige preencher SIF,
CNPJ ou razão social — mas isso é `validarFormulario()`, JavaScript no cliente.
O servidor aceita busca vazia e devolve a base inteira, paginada. O POST vai
para `!ap_estabelec_nacional_lista`, não para a página do formulário.

**3. `p_linha_inicial` é 0-based.** Começar em 1 pula o primeiro
estabelecimento (o SIF 1, da BRF). São 15 registros por página, janela
deslizante — `0, 15, 30...`. Buscas filtradas devolvem no máximo 15
resultados, então o offset só serve para a varredura completa.

**4. O dado mais valioso não está no HTML.** A ficha do estabelecimento tem 4
abas. Os campos cadastrais estão em `<INPUT DISABLED VALUE=...>`, mas as áreas
de atuação, as classes e **todo o histórico de ocorrências** são injetados por
chamadas JavaScript no fim da página:

```javascript
incluirOcorrenciaHab("23/02/2018", "Informamos que devido à nova padronização...")
incluirAreaAtuacao("CARNE")
incluirClasse("ABATEDOURO FRIGORÍFICO - C15 / MSD")
```

Quem remove as tags `<script>` antes de parsear — o reflexo normal — perde
exatamente o histórico de habilitações e suspensões. A BRF/SIF 1 tem 99
ocorrências que só aparecem assim.

## Armadilhas nos dados

**Uma linha ≠ um estabelecimento.** `sigsifestabelecimentosregistradosnosif.csv`
tem 24.174 linhas, mas só **3.147 SIFs distintos**: é uma linha por
*ocorrência*. Contar linhas infla o número de plantas em ~8x e faz a Seara
parecer ter 2.645 unidades, quando tem 42. A chave real é SIF + CNPJ.

**Categorias duplicadas por grafia.** A base de condenação mistura
`Contaminacao`, `Contaminação Gastrointestinal E Biliar` e
`CONTAMINAÇÃO GASTROINTESTINAL E BILIAR`; `Aves`/`Frango`/`Galinha`;
`Suinos`/`Suíno`. Sem normalizar, "condenação parcial" aparece partida em
3,3 bi + 2,6 bi em vez de 5,9 bi. `analise_pautas.py` normaliza antes de somar.

**A consulta pública só mostra ativos.** Os 3.166 registros do site têm
situação "Ativo", sem exceção. Estabelecimento cancelado ou com registro
cassado não aparece — some do ar sem rastro público. Para obter os
cancelados, só por LAI.

**CPF mascarado no CSV, completo no site.** Ver "Ganchos de pauta". Se for
cruzar titulares de plantas, a fonte utilizável é o site — com a
responsabilidade que isso implica.

**O dado aberto está atrasado em relação ao site.** Cruzando as duas fontes:
**22 estabelecimentos aparecem na consulta pública e não constam do CSV** de
dados abertos — entre eles Conservas Oderich, Três Corações e Alibem, além de
vários armazéns frigoríficos. Os SIFs mais altos (7472 a 7477) indicam
registros recentes que a exportação do portal ainda não pegou. Outros 3 estão
no CSV e sumiram do site. Se a apuração depende de estar completa, varra o
site; o CSV sozinho deixa buracos.

**A base de condenação não identifica a planta.** Só traz UF de procedência.
Serve para tendência e comparação entre estados — nunca para apontar um
frigorífico específico.

**Há registro administrativo misturado à produção.** O "SIF 9999" é a
Coordenação de Suporte à Gestão (CSG/DIPO), em Brasília, com 4 suspensões
lançadas. Filtre antes de contar.

## Ganchos de pauta

**Suspensões dispararam — mas conte plantas, não linhas.** Cada linha é um
par planta+país: uma unidade descredenciada de 20 mercados vira 20 linhas. Em
linhas, a série vai de 13 (2024) para 57 (2025) e 111 (2026). Em **plantas
distintas**, vira 5 → 44 → 38: o salto real foi de 2024 para 2025 (9x), e 2026
está *abaixo* de 2025. Quem contar linhas publica a manchete errada. Em 2026 as
suspensões se concentram em maio (47 linhas) e agosto (35), sem nenhuma data
futura — o movimento é real. Vale perguntar ao MAPA o que houve em 2025.

**Irã lidera as suspensões** (41), à frente de Hong Kong (21) e da União
Econômica Eurasiática (14) — um recorte geopolítico pouco explorado, já que a
cobertura costuma focar em China e União Europeia.

**Duas plantas concentram um terço de tudo:** LSI Brasil (SIF 13, Três Rios/RJ)
com 39 linhas de suspensão e Golden Imex (SIF 2863, MS) com 29, de 218 no total.
São empresas fora do radar das grandes — e, por serem poucas plantas atingindo
muitos mercados, explicam boa parte do volume de 2026. Ao todo, só **97 plantas**
já tiveram alguma habilitação suspensa.

**1.282 ocorrências citam suspensão e 1.253 citam exclusão**, quase sempre com
o número do processo SEI no texto — cada um é um pedido de LAI pronto, com
protocolo em mãos.

**O governo protege o CPF em uma ponta e entrega na outra.** No portal de
dados abertos os CPFs vêm mascarados (`***.***.453-**`), aparentemente por
LGPD. Na consulta pública do SIGSIF, o mesmo produtor aparece com o **CPF
completo**, sem login. Confirmei em três casos: o CSV mostra a máscara, o site
mostra os 11 dígitos. A incoerência é, em si, uma pauta — e um cuidado: não
publique os números.

**267 plantas com inspeção federal estão em nome de pessoa física**, não de
empresa — concentradas em ES (58), MG (58) e PR (54), e quase todas de **ovos**
(209), leite (37) e mel (20). Só uma é de carne. Cruzar com sócios de empresas
sancionadas e com doações eleitorais.

**Concentração:** os 10 maiores grupos (por raiz de CNPJ) somam 246 das 2.880
plantas com CNPJ — 8,5%. JBS (50), Seara (42) e BRF (31) lideram. O número contraria
a leitura de mercado ultraconcentrado *em número de plantas*; a concentração
real está no volume abatido, que é outro CSV.

## Ética e limites

Tudo aqui é informação pública, sem login nem contorno de autenticação. Ainda
assim: os CSVs trazem e-mail e telefone de contato dos estabelecimentos —
muitos de pessoas físicas. São dado de apuração, não de publicação.

O scraper usa pausa de 0,3s entre requisições e retentativa exponencial. O
SIGSIF é um sistema antigo e instável; não aumente a cadência.

## Fazendas que abastecem a Friboi: como montar a apuração

O objetivo — saber de quais fazendas sai a carne da Friboi, para investigar
desmatamento — esbarra numa realidade que vale conhecer antes de investir tempo.

### O que a página realmente devolve

Lendo o componente que desenha o resultado, a API responde uma lista de:

| campo | na tela |
|---|---|
| `date` | Data do abate |
| `plot` | Lote |
| `ranch` | **Fazenda** |
| `city` | Município |

É um array: **uma consulta (SIF + data) devolve vários lotes/fazendas**, então
o rendimento por consulta é bom.

Não vem coordenada, não vem CAR, não vem CPF do produtor. A JBS
[retirou as coordenadas das fazendas em 2019](https://oeco.org.br/reportagens/jbs-reduz-transparencia-sobre-fazendas-de-pecuaria/)
— antes disso dava para cruzar direto com mapas de desmatamento. Sobrou nome +
município, e nome de fazenda não é identificador: há dezenas de "Fazenda Boa
Esperança" pelo país (13 só entre os embargos ativos do Ibama).

### Por que não existe versão automatizada

A consulta exige `x-recaptcha-token`, validado no servidor:

| requisição | resposta |
|---|---|
| sem header | `403 {"error":"token_required"}` |
| token inválido | `403 {"error":"recaptcha_invalid"}` |

O deeplink `?parm=<SIF>..</SIF><DATA_PROD>..</DATA_PROD>` **preenche os campos,
não dispensa o captcha** — o reCAPTCHA roda igual. Automatizar o clique é
justamente o que esse controle existe para impedir, então aqui o humano
consulta e a ferramenta só recolhe.

### O fluxo que funciona

```bash
# 1. monta a fila de consultas (SIF + data), com link já preenchido
python3 friboi_links.py --datas 2026-03-15 --uf PA,RO,MT

# 2. no navegador: abre os links e consulta.
#    Antes, cole navegador/coletor.js no console (F12).
#    Ele captura cada tabela que aparece e acumula.
#    Ao final:  friboiColetor.baixar()

# 3. cruza as fazendas com os embargos do Ibama
python3 cruza_fazendas.py --entrada friboi_fazendas_2026-03-15.csv
```

O coletor não consulta nada sozinho e não toca no reCAPTCHA: ele lê a tabela
que já está na sua tela, para você não copiar à mão.

### O cruzamento

`cruza_fazendas.py` casa `ranch` + `city` contra `NOME_IMOVEL` + `MUNICIPIO`
dos [embargos do Ibama](https://dadosabertos.ibama.gov.br) (96.575 ativos,
16.779 com nome de imóvel; PA e MT lideram). Traz nome do embargado, CPF/CNPJ,
área, data, nº do TAD e coordenadas do termo.

Duas cautelas embutidas no código:
- **nomes genéricos são descartados** ("ZONA RURAL", "DESCONHECIDO", "ÁREA DE
  X ha") — são 7,6% dos embargos nomeados e casariam com qualquer coisa;
- a comparação ignora "Fazenda/Sítio/da/de" e compara o miolo do nome, então
  "Fazenda Santa Júlia - Retiro São Domingos" e "Santa Julia" se encontram.

Ainda assim **o que sai é pista, não prova**. Todo acerto precisa de
confirmação no CAR, no processo do Ibama e com a empresa.

### Caminhos que rendem mais que a raspagem

1. **Pedir à JBS.** Acesso a dados para apuração é pedido normal de imprensa, e
   a empresa tem compromissos públicos de rastreabilidade. Se recusarem, a
   recusa é matéria — ainda mais depois de terem tirado as coordenadas do ar.
2. **LAI ao MAPA pela GTA** (Guia de Trânsito Animal). É o registro legal do
   deslocamento do gado, do produtor ao frigorífico — melhor que a
   autodeclaração da empresa. Não é dado aberto; é pedido.
3. **[Trase](https://trase.earth/open-data/datasets/supply-chains-brazil-beef)**
   já mapeia a cadeia da carne por frigorífico e município, sob CC BY 4.0.
4. **Prodes/Deter (INPE)** e **CAR/SICAR** para fechar o desmatamento na ponta.

Nenhum desses tem captcha, e os três primeiros dão dado melhor que a página.

## Cruzando com a rastreabilidade da Friboi (JBS)

A [consulta de rastreabilidade da Friboi](https://www.friboi.com.br/qualidade/rastreabilidade/)
pede **SIF + data de produção**. O SIF é exatamente o que o SIGSIF entrega —
as duas bases se encaixam.

```bash
python3 friboi_links.py --datas 2026-03-15 --uf PA,RO,MT
```

Gera um CSV de consultas prontas, com o link já preenchido.

### Até onde dá para automatizar: não dá

A página chama `GET /api/traceability?search=<SIF><ddMMyy>`, com o header
`x-recaptcha-token` (reCAPTCHA v3 invisível, site key
`6LdBnCwsAAAAAIZt7A2rPIEhui0Si4VJ6-9WLzY9`). Testado:

| requisição | resposta |
|---|---|
| sem header | `403 {"error":"token_required"}` |
| token inválido | `403 {"error":"recaptcha_invalid"}` |

A validação é **server-side**. Isso é um controle antiautomação deliberado,
num site privado — categoria diferente do SIGSIF, onde só faltava mandar
User-Agent. O `robots.txt` da Friboi é permissivo (`Allow: /`), mas ele
governa rastreamento de páginas, não a API: quem manda aqui é o reCAPTCHA.

Então o script **prepara** a pesquisa e quem consulta é você, no navegador. O
link sai preenchido porque a própria Friboi aceita um parâmetro para isso:

```
?parm=<SIF>457</SIF><DATA_PROD>15/03/2026</DATA_PROD>
```

Está no código do site (provavelmente para QR code em embalagem). Não é
contorno de nada — é um recurso deles, usado como eles fizeram.

Para volume, o caminho é pedir: à JBS, por assessoria, e ao MAPA, por LAI —
o governo tem os dados de abate e de origem do gado por estabelecimento.

### O recorte que interessa

Dos 3.166 estabelecimentos ativos, **57 são JBS/Friboi**, e **41 têm classe
de abatedouro**. Entre eles, plantas no arco do desmatamento: Marabá (SIF 457),
Redenção (807) e Santana do Araguaia (1110), no PA; São Miguel do Guaporé
(175), em RO; além de Barra do Garças, Pontes e Lacerda e Juara, no MT.

É aí que a rastreabilidade vira pauta: pegar o SIF de uma planta amazônica,
consultar as fazendas fornecedoras que a Friboi declara e cruzar com o
[Prodes/Deter](http://terrabrasilis.dpi.inpe.br), o
[embargo do Ibama](https://servicos.ibama.gov.br/ctf/publico/areasembargadas/ConsultaPublicaAreasEmbargadas.php)
e o CAR. O padrão que a cobertura de triangulação de gado persegue é a
fazenda "limpa" que aparece como fornecedora direta enquanto compra de uma
embargada.
