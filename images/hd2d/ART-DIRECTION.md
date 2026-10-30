# Arte dos jogos — 30/10/2026

Imagens criadas com a ferramenta integrada ImageGen. Originais PNG preservados nesta pasta; WebP são os arquivos usados no navegador. Código em scripts/hd2d-art.js recorta as células em resolução nativa e mantém as coordenadas lógicas dos jogos, sem ampliar os sprites antigos. Transparência original preservada.

## Conjunto de prompts de produção

Direção comum: stylized-concept, HD2D com pintura detalhada inspirada em pixel art, materiais legíveis, câmera RPG ortográfica vista de cima a 35 graus. Sem texto, marcas, legendas ou linhas de grade. Personagens compactos; nunca retratos grandes andando frontalmente.

- stardewActor: fazendeiro jornalista, chapéu de palha, camisa verde, bolsa marrom, calças escuras, botas. Grade 4×4 transparente; linhas baixo/esquerda/direita/cima; colunas parado/passo esquerdo/passagem/passo direito.
- pokemonActor: treinador repórter inspirado em FireRed, boné vermelho, jaqueta azul, camisa branca, mochila bege, tênis. Mesma grade direcional 4×4 e câmera.
- personaActor: ladrão jornalista, cabelo preto, máscara branca, sobretudo preto e luvas vermelhas. Mesma grade 4×4, movimentos de pernas, braços e casaco.
- personaGuard: segurança de máscara azul, terno escuro, gravata vermelha, sapatos pretos. Mesma grade 4×4.
- stardewTerrain: atlas 6×4, ordem: grama, variante, árvore, água, variante, flores, variante, placa, cerca, terra, arada, molhada, telhado, parede, janela, porta, caixa de correio, penhasco, caverna, parede subterrânea, chão subterrâneo, loja, escada, grama.
- pokemonTerrain: atlas 4×3, ordem: grama, variante, grama alta, caminho, árvore, água, variante, flores, variante, placa, cerca, grama.
- personaTerrain: atlas 4×3, ordem: mármore, tapete, parede, coluna, cofre, vaso, porta fechada, aberta, pedestal, saída, mármore, tapete.
- stardewObjects: atlas transparente 5×5, ordem: pedra, galho, rocha mineral, documento, café, envelope, fotografia, cogumelo, minério, sementes, barra de energia, caneta, fertilizante, sementes plantadas, broto, planta, colheita com jornal, enxada, regador, picareta, foice, pacote de sementes, caixa, espantalho, jornal.
- pokemonCreatures: atlas transparente 3×3, ordem: fantasma de papel BADSCAN, documento censurado REDACTOR, parede dourada PAYWALL, megafone roxo PRESSSEC, máscara digital DEEPFAKE, réptil com maleta LOBBYIST, robô triturador SHREDDER, robôs azuis BOTFARM, bola de captura.
- personaObjects: atlas transparente 3×2, ordem: distintivo dourado, planta do cofre, passe amarelo, dossiê vermelho, baú com documentos, cartão branco/vermelho.
- stardewTitle: fazenda ao entardecer, casa de telhado vermelho, horta, cercas, flores, caixa de correio, floresta e jornalista pequeno; área superior livre para título.
- pokemonTitle: rota ao anoitecer, árvores, grama alta, caminho, redação com telhado vermelho, lago e treinador pequeno de costas; área superior livre para título.
- personaTitle: salão de mármore preto, tapete vermelho, colunas douradas, cofre, luz pelas janelas e ladrão pequeno de costas; área superior livre para título.
- pokemonBuilding: redação isolada transparente, telhado vermelho, paredes creme, janelas azuis e porta marrom central no limite inferior, câmera RPG de cima.
- pokemonBattleTrainer: treinador de costas em três quartos, boné vermelho, jaqueta azul, mochila bege, braço pronto para lançar bola; fundo transparente.

Cada folha é um arquivo raster gerado separado; cada célula usada no jogo é recortada com sua escala lógica e canal alpha. As células extras de terreno são preenchimento do atlas. Objetos decorativos extras não são inseridos aleatoriamente no mapa.
- pokemonBattleBackground: clareira vazia com grama, árvores nas bordas, colinas distantes e céu azul, câmera baixa de batalha; espaços livres para treinador e inimigo.

Fonte Press Start 2P hospedada localmente para não bloquear a abertura dos jogos por dependências externas. Licença em fonts/OFL.txt.
- grassSeamless: grama fina uniforme para repetição, sem bordas, caminhos, vinheta ou objetos.
- soilSeamless: terra marrom uniforme com grãos e pedrinhas, sem vegetação nem bordas.
- pathSeamless: areia bege compactada uniforme, sem grama nem contorno de caminho.
- stardewHouse: casa rural inteira transparente, telhado vermelho contínuo, madeira e reboco creme, porta na frente, câmera RPG de cima.
- worldProps: atlas transparente 4×2 de árvore arredondada, flores, placa, cerca de madeira, caixa de correio, banca com toldo, grama alta e cerca branca; sem quadrados de chão sob os objetos.

## Animações adicionais de rosto e corpo

14 novas folhas geradas com ImageGen integrado, preservando os personagens por imagens de referência. Prompts integrais em `animation-prompts-v2.json`; originais PNG e versões WebP com sufixo `-v2` nesta pasta.

- 9 inimigos, incluindo LAIDENY: 8 poses por inimigo (4 de repouso com respiração/piscada, preparação de ataque, ataque, dano e recuperação).
- Protagonistas dos três jogos e guardas de Persona: 4 poses de repouso por direção, com pés fixos e movimento de olhos, cabeça, ombros e roupa. As quatro direções de caminhada continuam disponíveis.
- Treinador de batalha: 8 poses de repouso, olhar lateral, preparação, lançamento, dano e recuperação.
- 144 quadros novos. Seleção dos inimigos por ID, corrigindo a correspondência entre nomes e imagens. Escala e linha dos pés uniformizadas dentro de cada folha; ataques e danos usam os temporizadores reais da batalha. Inimigos também se animam no caderno e no final do jogo.

## Proporções e cenário — v3

Objetos no mundo têm medidas próprias em relação ao personagem de 14×18: café 4×4, pedra pequena 6×4,5, rocha mineral 9×6,5 e galho 8×3,5. Os ícones de inventário mantêm a área de leitura da interface. Árvores 23×30, com raiz fixa, deformação suave da copa em faixas e ordenação à frente/atrás do personagem. Cercas, placas, caixa de correio, flores e grama alta usam proporções específicas.

Dois novos arquivos ImageGen: environmentGrass-v3 (grama com menos contraste) e environmentWater-v3 (oito quadros de água). Prompts exatos em environment-prompts-v3.json. Água com interpolação entre quadros e textura contínua por lago; margens discretas junto à terra. Sulcos de terra arada contínuos. Chaves e baú do mapa de Persona reduzidos; música preservada.
