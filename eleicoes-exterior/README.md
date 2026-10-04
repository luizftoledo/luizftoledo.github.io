# Eleições no exterior

Painel público estático para GitHub Pages. Consulta diretamente resultados.tse.jus.br no navegador, a cada cinco segundos com verificação de boletins em rodízio. Não depende de API do ChatGPT, senha, g1 ou credencial privada.

Fontes: eleição 6257, pleito 3220, primeiro turno de 2026. Boletins completos e totalização concluída são estados distintos. Seções agregadas não são contadas duas vezes. Arquivos inválidos ou indisponíveis preservam a última leitura com aviso.

Os arquivos em src são o código de origem. O arquivo app.js é o bundle para publicação e style.css mantém o visual do painel. Os snapshots são leituras iniciais do TSE, identificadas como antigas se não puderem ser atualizadas.

Leonardo Avalanche (28, PRTB) foi identificado na lista oficial do TSE de planos de governo de 2026, complementando os nomes do arquivo municipal de resultados.

O resumo agrega cada país uma vez usando a mesma fonte dos votos exibidos. Comparecimento e eleitorado coberto vêm dos campos oficiais qtdComparecimento / qtdEleitoresAptos do BU, ou e.c / e.est da totalização EA20. Abstenção nos BUs é aptos menos comparecimento. Eleitores aguardando dados são o eleitorado cadastrado menos o eleitorado das seções já cobertas, nunca uma estimativa de quem ainda vai votar. Campos ausentes ficam indisponíveis até a próxima leitura válida.

Barras: amarelo para parcial, azul para todos os BUs disponíveis, verde apenas para totalização concluída e vermelho suave para leitura antiga. O snapshot preserva versões anteriores em falhas de consulta, com horários individuais de verificação; a leitura antiga fica explícita.
