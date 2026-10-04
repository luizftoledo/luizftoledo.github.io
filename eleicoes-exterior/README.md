# Eleições no exterior

Painel público estático para GitHub Pages. Consulta diretamente resultados.tse.jus.br no navegador, a cada cinco segundos com verificação de boletins em rodízio.

Fontes: eleição 6257, pleito 3220, primeiro turno de 2026. Boletins completos e totalização concluída são estados distintos. Seções agregadas não são contadas duas vezes. Arquivos inválidos ou indisponíveis preservam a última leitura com aviso.

Os arquivos em src são o código de origem. O arquivo app.js é o bundle para publicação e style.css mantém o visual do painel. Os snapshots são leituras iniciais do TSE, identificadas como antigas se não puderem ser atualizadas.

Leonardo Avalanche (28, PRTB) foi identificado na lista oficial do TSE de planos de governo de 2026, complementando os nomes do arquivo municipal de resultados.

O resumo agrega cada país uma vez usando a mesma fonte dos votos exibidos. Comparecimento e eleitorado coberto vêm dos campos oficiais qtdComparecimento / qtdEleitoresAptos do BU, ou e.c / e.est da totalização EA20. Abstenção nos BUs é aptos menos comparecimento. Eleitores aguardando dados são o eleitorado cadastrado menos o eleitorado das seções já cobertas, nunca uma estimativa de quem ainda vai votar. Campos ausentes ficam indisponíveis até a próxima leitura válida.

Barras: amarelo para parcial, azul para todos os BUs disponíveis, verde apenas para totalização concluída e vermelho suave para leitura antiga. O snapshot preserva versões anteriores em falhas de consulta, com horários individuais de verificação; a leitura antiga fica explícita.


## Resultados nacionais e planilha municipal
A página `nacional/` consulta diretamente a totalização de presidente (eleição 6257, primeiro turno) e os índices nacional/UF do TSE 2026. O índice municipal guia a leitura dos resultados de municípios alterados, sem somar abrangências Brasil, UF e município. Arquivos anteriores a 04/10/2026, sem divulgação ou com eleição/fase/abrangência diferente ficam indisponíveis; votos ausentes não viram zero. Resultados municipais defasados do índice são identificados e consultados novamente. São 5.571 municípios nacionais na configuração oficial EA12, com código TSE e código IBGE `cdi`.

A planilha Google Sheets vinculada é uma fotografia da extração, com aba própria do Censo 2022 (amostra, pessoas de 10 anos ou mais, sexo total, idade total), tabela SIDRA 9537, variável 140. Os percentuais de religião são contagem / população 10+, e a comparação independente por código IBGE verificou 5.570 municípios e as dez contagens (total + nove categorias), além de nove percentuais. Fonte independente por UF: `https://servicodados.ibge.gov.br/api/v3/agregados/9537/periodos/2022/variaveis/140|13495?localidades=N6[N3[<codigoUFIBGE>]]&classificacao=133[all]|2[6794]|58[95253]`. A aba principal da referência Thais coincide integralmente. Na aba Aparecida, 65 percentuais foram arredondados a duas casas na fração; não houve divergência em contagens. Boa Esperança do Norte, MT (IBGE 5101837), não tem dado municipal próprio de religião em 2022. A referência original não foi alterada. Não há inferência de voto individual por religião.

O script de reprodução `scripts/extract-national.py` baixa os índices e os municípios com totalização atual e os dados do IBGE, mantendo separadas as fontes e horários de geração. A extração independente inclui a referência Excel apenas quando seu caminho é fornecido; a referência não é distribuída no site público.
