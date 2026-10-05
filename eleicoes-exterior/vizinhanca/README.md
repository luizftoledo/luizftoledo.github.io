# Votação nos colégios próximos ao endereço — 2026

O mapa apresenta pontos dos locais de votação. A busca por endereço ordena os cinco pontos mais próximos no município, pela distância geodésica em linha reta. O endereço é localizado temporariamente pela Esri (`forStorage=false`); não é salvo no cache nem na URL do mapa. Coordenadas coincidentes, arredondadas a seis casas, aparecem juntas. Limites municipais: IBGE. Locais sem coordenadas utilizáveis ou fora do limite não entram no cálculo da proximidade, mas continuam na conferência dos votos da cidade.

**As cores descrevem os votos nas urnas do local, não como votaram os moradores das ruas próximas.** Um eleitor pode votar longe de casa. O endereço somente seleciona locais próximos; não identifica a seção do eleitor nem votos individuais.

## Fontes e cadastro

Cadastro oficial do TSE: https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip . Primeiro turno; exterior excluído. São 5.571 municípios, 94.087 locais e 497.897 seções principais. A conferência com os arquivos oficiais EA16 das 27 UFs encontrou exatamente as mesmas 497.897 seções, sem faltantes ou excedentes. Seções agregadas são contadas somente no boletim da principal.

Boletins oficiais: pleito 3220, eleição 6257, cargo presidente, em https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/ . O parser confere natureza oficial, identidade da eleição, município, zona, seção, data e contagens. A cor só é exibida quando todos os boletins esperados do ponto foram lidos. Percentuais usam todos os votos dos candidatos com destinação Válido, incluindo os demais candidatos. Empates e outro candidato têm uma cor própria. Cinza significa cobertura incompleta; não se presume zero.

## Conferência e carregamento

A base pré-carregada está em `boletins/<municipio>.json`, em formato compacto. Cada cidade só é publicada depois de reconciliar todos os candidatos, comparecimento, votos brancos e votos nulos com o JSON municipal do TSE. Nulos incluem os nulos técnicos decorrentes da totalização; votos de números ausentes da lista municipal são conferidos contra o total oficial de nulos técnicos. Ao abrir, o navegador verifica novamente as somas da base pré-carregada contra o resultado municipal atual. Se divergirem, não usa aquela base e consulta os arquivos oficiais.

`cobertura-boletins.json` informa a quantidade já conferida no mapa, separada dos 100% da apuração nacional. Onde não houver base pré-carregada, a busca carrega automaticamente os cinco locais próximos. O botão Carregar toda a cidade consulta os restantes, com oito conexões simultâneas e limitação de taxa. Resultados ficam em IndexedDB. Falhas são explícitas e preservam as lacunas.

A fonte de cada número pode ser aberta no popup. A exportação CSV deixa votos não carregados em branco e indica a cobertura. Parâmetros públicos `municipio` e `local` permitem abrir uma escola; não contêm endereços residenciais pesquisados.
