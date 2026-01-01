document.addEventListener('DOMContentLoaded', () => {
    const dialogText = document.getElementById('dialogText');
    const dialogBox = document.getElementById('dialogBox');
    const battleMenu = document.getElementById('battleMenu');
    const enemyImg = document.getElementById('enemyImg');
    const foiaProjectile = document.getElementById('foiaProjectile');
    const flashOverlay = document.getElementById('flashOverlay');
    const enemyHpBar = document.getElementById('enemyHpBar');

    let isTypewriterActive = false;

    // Typewriter effect function
    function typeText(text, callback) {
        dialogText.innerHTML = '';
        isTypewriterActive = true;
        let i = 0;
        const speed = 30; // ms per char

        function type() {
            if (i < text.length) {
                dialogText.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                isTypewriterActive = false;
                if (callback) setTimeout(callback, 500);
            }
        }
        type();
    }

    // Game Sequence
    function startGame() {
        // Simple delay to start
        setTimeout(() => {
            typeText("A wild GOVERNMENT RECORD appeared!", () => {
                setTimeout(() => {
                    typeText("Go! JOURNALIST!");
                }, 1500);
                setTimeout(showBattleMenu, 3000);
            });
        }, 1000);
    }

    function showBattleMenu() {
        dialogBox.style.display = 'none'; 
        battleMenu.style.display = 'flex';
        dialogText.innerHTML = "What will<br>JOURNALIST do?";
    }

    // Menu Interactions
    document.querySelectorAll('.menu-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'fight') {
                handleFight();
            } else if (action === 'bag') {
                battleMenu.style.display = 'none';
                dialogBox.style.display = 'block';
                typeText("You have no items.", () => {
                   setTimeout(showBattleMenu, 2000); 
                });
            } else if (action === 'pokemon') {
                battleMenu.style.display = 'none';
                dialogBox.style.display = 'block';
                typeText("You don't have any Pokémon.", () => {
                   setTimeout(showBattleMenu, 2000); 
                });
            } else if (action === 'run') {
                battleMenu.style.display = 'none';
                dialogBox.style.display = 'block';
                typeText("Can't escape! The truth must be uncovered!", () => {
                   setTimeout(showBattleMenu, 2000); 
                });
            }
        });
    });

    function handleFight() {
        battleMenu.style.display = 'none';
        dialogBox.style.display = 'block';
        
        typeText("JOURNALIST used FOIA REQUEST!", () => {
            performThrowAnimation();
        });
    }

    function performThrowAnimation() {
        // Show projectile
        foiaProjectile.style.display = 'block';
        // Remove and re-add class to restart animation if needed
        foiaProjectile.classList.remove('throw-animation');
        void foiaProjectile.offsetWidth; // Trigger reflow
        foiaProjectile.classList.add('throw-animation');

        // projectile takes 1s to hit
        setTimeout(() => {
            // Impact!
            foiaProjectile.style.display = 'none';
            enemyHitSequence();
        }, 1000);
    }

    function enemyHitSequence() {
        // Flash enemy
        enemyImg.classList.add('shake-enemy');
        
        // Flash Screen
        flashOverlay.style.transition = 'opacity 0.1s';
        flashOverlay.style.opacity = '0.8';
        setTimeout(() => { flashOverlay.style.opacity = '0'; }, 100);

        // Reduce HP (Animation handled by CSS: 1.5s)
        enemyHpBar.style.width = '0%';
        enemyHpBar.style.background = '#f85838'; // Red

        // Wait for 1.5s drain + a small buffer before shrink/capture
        setTimeout(() => {
            // Capture Animation (Shrink)
            enemyImg.classList.remove('shake-enemy'); // stop shaking
            enemyImg.classList.add('shrink-capture');
            
            setTimeout(() => {
                captureSuccess();
                enemyImg.style.display = 'none'; // Ensure it's gone
            }, 1000);
        }, 1600); // 1.5s duration + 100ms buffer
    }

    function captureSuccess() {
        typeText("Gotcha! GOVERNMENT RECORD was captured!", () => {
             // Victory fanfare would play here
             setTimeout(() => {
                 typeText("The truth has been revealed.", () => {
                     setTimeout(() => {
                         // Redirect to the full Pokemon-themed portfolio
                         window.location.href = 'pokemon_index.html'; 
                     }, 1500);
                 });
             }, 2000);
        });
    }

    // Start on load
    startGame();

});
