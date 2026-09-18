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
