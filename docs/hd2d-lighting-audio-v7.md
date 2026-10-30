# Iluminação e áudio dos três RPGs

Atualização de 30/10/2026. Pedido: música funcionando no celular, efeitos gerados no ElevenLabs e mais profundidade, usando Final Fantasy Resonance como referência.

## Referências consultadas

- [Final Fantasy Resonance, Square Enix](https://na.store.square-enix-games.com/final-fantasy-resonance?search_query=resonance&searchid=0): apresentação oficial de arte HD-2D com câmeras dinâmicas e modelos 3D pixelizados.
- [Entrevista com Square Enix/Acquire sobre Octopath Traveler II, Unreal Engine](https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style?lang=en-US): combinação de sprites e cenários 3D, iluminação variável e importância de harmonizar personagens e fundos.
- [Políticas de mídia no iOS, WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/): reprodução audível depende de interação do usuário; play() pode ser recusado.
- [Política de autoplay, Chrome](https://developer.chrome.com/blog/autoplay): Web Audio pode começar suspenso; retomar depois de interação.
- [API de efeitos, ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert): geração por descrição, duração e influência do prompt.

## Aplicação neste projeto

O projeto continua em Canvas 2D, com sprites de alta resolução e coordenadas lógicas fixas. A aplicação da referência é uma adaptação de iluminação e composição: não implementa cenários 3D nem rotação de câmera equivalentes aos jogos de referência.

- Sombras projetadas a partir do canal alfa de cada sprite, na mesma direção, suavizadas e armazenadas em cache. Projeção parte dos pés/raiz do objeto, sem mover a base do personagem.
- Sombra de contato com gradiente nos pés, pedras, vegetação, objetos e fundações. Oclusão de chão nas bordas de paredes e cavernas; contornos de colisão continuam legíveis em Persona.
- Vegetação desenhada em ordem de profundidade antes/depois do personagem. Objetos e atores do palácio ordenados pela base no chão. Props acima de telhados não são renderizados.
- Luz mais quente na fazenda e vila, sombras mais frias, luz local na lâmpada da casa; caverna com gradação fria e luz perto do personagem. Palácio com reflexos discretos no piso e luz suave nas colunas e passagem aberta.
- Água com camadas de profundidade e pequenos reflexos animados; sombras de nuvens e partículas discretas. Efeitos aplicados antes do HUD, mantendo textos e comandos nítidos.

## Áudio

As gravações originais foram mantidas: stardew_theme.m4a; persona_5_life_will_change.mp3; grass_route.m4a, pkost_music.mp3 e vitoria.mp3. Nenhuma música foi gerada ou substituída nesta atualização.

scripts/game-audio.js inicia play() e resume() diretamente em eventos de toque/clique/tecla. Usa um único elemento de reprodução para as mudanças de música de Pokémon, evita sobreposição de faixas e preserva continuidade na fazenda/caverna. Oferece botão de recuperação se a reprodução for bloqueada e respeita volume/mudo persistidos. Pausa música e contexto ao ocultar a página e tenta retomar ao voltar.

18 efeitos originais gerados via ElevenLabs eleven_text_to_sound_v2: interface, passo em grama, passo em pedra, enxada, sementes, regador, picareta/pedra, galho, coleta, recuperação, impacto, câmera, magia, alerta, esconderijo, porta, sucesso e falha. Prompts completos e parâmetros em audio/hd2d-v7/prompts.json; gravações originais em source/ e arquivos preparados ao lado. Volume normalizado com margem para efeitos simultâneos; passos reproduzidos em volume menor, com pequena alternância de velocidade. Osciladores e melodias sintetizadas antigos removidos dos três jogos.

## Validação

Relatórios e imagens em test-results/lighting-audio-2026-10-30/. Testes automatizados de navegador usam Chrome/Android emulado e WebKit/iPhone emulado, além de desktop; não constituem teste em aparelho físico. Conferências de áudio verificam arquivo carregado, avanço do tempo de reprodução, estado do contexto, efeitos decodificados e acionados, volume/mudo e recuperação. O botão de recuperação também é testado com bloqueio simulado de play().
