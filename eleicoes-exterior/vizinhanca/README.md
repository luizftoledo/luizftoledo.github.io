# Mapa de proximidade dos locais de votação — 2026

Aplicação estática: index.html + map.js. Cadastro de 5.571 municípios, 94.087 locais com seções principais ativas e 497.897 seções principais. Fonte do cadastro: ZIP oficial `eleitorado_local_votacao_2026.zip`, geração 04/10/2026 às 06:27:35. Somente turno 1; exterior excluído. Coordenadas de locais públicos, nunca endereços de eleitores.

Os boletins são consultados sob demanda no domínio oficial do TSE. O parser valida pleito 3220, eleição 6257, cargo presidente, data eleitoral, município, zona, seção, natureza oficial e contagens. A seção agregada é atribuída exclusivamente à seção principal. Identificadores zona+seção são únicos dentro do município. Consultas limitadas globalmente a aproximadamente 33 por segundo e oito trabalhadores. Quatro respostas 404 interrompem a leitura para evitar insistência em URLs indisponíveis.

Aparecida (SP) possui uma semente com 86 boletins verificados; é reconsultada ao abrir o mapa. Outras cidades são lidas ao selecionar. Cobertura não equivale a apuração final: as somas por candidato são comparadas com o resultado municipal. Divergências são exibidas.

Voronoi calculado em projeção local equiretangular com correção de longitude pelo cosseno da latitude média; recortado pelo limite municipal IBGE (malha simplificada). Pontos de coordenadas coincidentes (6 casas decimais) são agrupados. Coordenadas ausentes, inválidas ou externas ao município não recebem polígonos, mas seus boletins continuam na conferência municipal e na exportação CSV. Cada ponto completo recebe a cor do candidato com mais votos válidos; empates/outros candidatos têm cor específica. Áreas incompletas ficam cinza. Percentual sobre todos os votos dos candidatos de destinação Válido no resultado municipal.

Estas áreas são aproximações de proximidade dos locais, não limites de bairros ou regiões de domicílio de eleitores. Método inspirado no código aberto do Estadão: https://github.com/estadao/como-votou-sua-vizinhanca .

Verificações iniciais: Aparecida SP (86/86, somas dos 12 candidatos iguais ao TSE), Aparecida PB (25/25, somas dos 12 candidatos iguais ao TSE); clique e tooltip; formato móvel de 390 px; auditoria nacional sem duplicações de seção principal.

## Correção de carregamento
Busca adicional por bairro, nome da escola e endereço cadastrado do local. Clique/seleção inicia a leitura dos boletins daquele ponto; carga municipal completa é opcional. Ausência de leitura aparece como indisponível, nunca como zero votos (inclusive CSV). Boletins lidos são preservados em IndexedDB por cidade. Erros ficam explícitos. Links aceitam municipio e local para abrir diretamente uma escola.

Busca principal por rua/número/cidade/UF (ou CEP), com geocodificação temporária pela Esri: `forStorage=false`, sem guardar endereço ou coordenada pesquisada no cache/URL. Mostra candidato de endereço, indica aproximação quando não há correspondência por número, identifica município, calcula o local mais próximo com a mesma projeção do Voronoi e abre sua votação. Geocodificador configurável via config.json. Teste público: Avenida Paulista 1578, São Paulo (MASP), correspondência PointAddress, encaminha ao Colégio Dante Alighieri a 315 m.
