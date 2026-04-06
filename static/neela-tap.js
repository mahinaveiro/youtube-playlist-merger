/**
 * Neela Tap - Premium Mobile-First Mini Game
 * A Codanela Production
 * Pure vanilla JS, no dependencies
 */

(function () {
  'use strict';

  const GRAVITY = 0.5;
  const FLAP_STRENGTH = -9;
  const PIPE_SPEED_BASE = 2.5;
  const PIPE_GAP = 200;
  const PIPE_WIDTH = 60;
  const PIPE_SPAWN_INTERVAL = 2000;
  const NOTE_SIZE = 40;
  const SPEED_INCREASE_PER_SCORE = 0.1;
  const HIGH_SCORE_KEY = 'neela_tap_highscore';
  const SAFE_MARGIN = 50; // Safe margin from top/bottom

  let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    highScore: 0,
    noteY: 0,
    noteVelocity: 0,
    pipes: [],
    lastPipeTime: 0,
    pipeSpeed: PIPE_SPEED_BASE,
    gameWidth: 0,
    gameHeight: 0,
    animationId: null,
    bgTexts: [],
  };

  let elements = {};
  let onGameQuit = null;
  let onMixReady = null;

  function init() {
    loadHighScore();
    createGameElements();
    createBackgroundTexts();
    setupEventListeners();
  }

  function loadHighScore() {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    gameState.highScore = saved ? parseInt(saved, 10) : 0;
  }

  function saveHighScore() {
    if (gameState.score > gameState.highScore) {
      gameState.highScore = gameState.score;
      localStorage.setItem(HIGH_SCORE_KEY, gameState.highScore.toString());
    }
  }

  function createGameElements() {
    const game = document.getElementById('neela-tap-game');
    if (!game) return;

    game.innerHTML = `
      <div class="neela-game-canvas" id="neela-canvas">
        <div class="neela-start-screen" id="neela-start-screen">
          <h1 class="neela-title">Neela Tap</h1>
          <p class="neela-subtitle">How far can you fly?</p>
          <p class="neela-credits">A Codanela Production</p>
          ${gameState.highScore > 0 ? `<p class="neela-high-score">Your Best: ${gameState.highScore}</p>` : ''}
          <div class="neela-tap-to-start" id="neela-tap-start">Tap to Start</div>
          <button class="neela-quit-btn" id="neela-quit-start">Quit</button>
        </div>
        
        <div class="neela-score" id="neela-score" style="display: none;">0</div>
        <div class="neela-note" id="neela-note" style="display: none;">
          <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        
        <div class="neela-game-over" id="neela-game-over">
          <div class="neela-game-over-card">
            <h2 class="neela-game-over-title">Game Over</h2>
            <p class="neela-game-over-score">Score: <span id="neela-final-score">0</span></p>
            <p class="neela-game-over-best">Best: <span id="neela-final-best">0</span></p>
            <div class="neela-game-over-buttons">
              <button class="neela-btn neela-btn-primary" id="neela-play-again">Play Again</button>
              <button class="neela-btn neela-btn-secondary" id="neela-quit-game">Quit</button>
            </div>
          </div>
        </div>
        
        <div class="neela-ready-banner" id="neela-ready-banner">
          <svg class="neela-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          Your mix is ready! Tap here to get it
        </div>
      </div>
    `;

    elements = {
      game,
      canvas: document.getElementById('neela-canvas'),
      startScreen: document.getElementById('neela-start-screen'),
      note: document.getElementById('neela-note'),
      scoreDisplay: document.getElementById('neela-score'),
      gameOver: document.getElementById('neela-game-over'),
      finalScore: document.getElementById('neela-final-score'),
      finalBest: document.getElementById('neela-final-best'),
      readyBanner: document.getElementById('neela-ready-banner'),
      tapStart: document.getElementById('neela-tap-start'),
      quitStart: document.getElementById('neela-quit-start'),
      playAgain: document.getElementById('neela-play-again'),
      quitGame: document.getElementById('neela-quit-game'),
    };
  }

  function createBackgroundTexts() {
    // Create single scrolling text
    const text = document.createElement('div');
    text.className = 'neela-bg-text';
    text.textContent = 'Codanela Production';
    text.style.top = '50%';
    text.style.left = '100%';
    elements.canvas.appendChild(text);
    gameState.bgTexts.push({
      element: text,
      x: 100,
      speed: 0.2,
    });

    // Create clouds
    createClouds();
    
    // Create moon
    createMoon();
  }

  function createClouds() {
    const cloudPositions = [
      { top: 15, left: 20, size: 60 },
      { top: 25, left: 70, size: 80 },
      { top: 10, left: 50, size: 50 },
    ];
    
    cloudPositions.forEach((pos, index) => {
      const cloud = document.createElement('div');
      cloud.className = 'neela-cloud';
      cloud.style.top = `${pos.top}%`;
      cloud.style.left = `${pos.left}%`;
      cloud.style.width = `${pos.size}px`;
      cloud.style.height = `${pos.size * 0.6}px`;
      elements.canvas.appendChild(cloud);
      
      gameState.bgTexts.push({
        element: cloud,
        x: pos.left,
        speed: 0.05 + index * 0.02,
        isCloud: true,
      });
    });
  }

  function createMoon() {
    const moon = document.createElement('div');
    moon.className = 'neela-moon';
    moon.style.top = '12%';
    moon.style.right = '15%';
    elements.canvas.appendChild(moon);
  }

  function setupEventListeners() {
    elements.tapStart.addEventListener('click', startGame);
    elements.quitStart.addEventListener('click', quitGame);
    elements.playAgain.addEventListener('click', restartGame);
    elements.quitGame.addEventListener('click', quitGame);
    elements.readyBanner.addEventListener('click', handleMixReady);
    
    elements.canvas.addEventListener('click', handleTap);
    elements.canvas.addEventListener('touchstart', handleTap);
    
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  function handleResize() {
    gameState.gameWidth = elements.canvas.clientWidth;
    gameState.gameHeight = elements.canvas.clientHeight;
  }

  function handleTap(e) {
    if (!gameState.isPlaying || gameState.isPaused) return;
    e.preventDefault();
    gameState.noteVelocity = FLAP_STRENGTH;
  }

  function startGame() {
    elements.startScreen.style.display = 'none';
    elements.note.style.display = 'block';
    elements.scoreDisplay.style.display = 'block';
    
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.noteY = gameState.gameHeight / 2 - NOTE_SIZE / 2;
    gameState.noteVelocity = 0;
    gameState.pipes = [];
    gameState.lastPipeTime = Date.now(); // Start timer now
    gameState.pipeSpeed = PIPE_SPEED_BASE;
    
    updateScoreDisplay();
    gameLoop();
  }

  function restartGame() {
    elements.gameOver.classList.remove('active');
    clearPipes();
    startGame();
  }

  function quitGame() {
    stopGame();
    if (onGameQuit) onGameQuit();
  }

  function stopGame() {
    gameState.isPlaying = false;
    if (gameState.animationId) {
      cancelAnimationFrame(gameState.animationId);
      gameState.animationId = null;
    }
    clearPipes();
    elements.note.style.display = 'none';
    elements.scoreDisplay.style.display = 'none';
    elements.gameOver.classList.remove('active');
    elements.startScreen.style.display = 'flex';
    
    // Update high score display on start screen
    const highScoreEl = elements.startScreen.querySelector('.neela-high-score');
    if (gameState.highScore > 0) {
      if (highScoreEl) {
        highScoreEl.textContent = `Your Best: ${gameState.highScore}`;
      } else {
        const subtitle = elements.startScreen.querySelector('.neela-credits');
        const newHighScore = document.createElement('p');
        newHighScore.className = 'neela-high-score';
        newHighScore.textContent = `Your Best: ${gameState.highScore}`;
        subtitle.parentNode.insertBefore(newHighScore, subtitle.nextSibling);
      }
    }
  }

  function pauseGame() {
    gameState.isPaused = true;
  }

  function handleMixReady() {
    stopGame();
    if (onMixReady) onMixReady();
  }

  function gameLoop() {
    if (!gameState.isPlaying || gameState.isPaused) return;

    updateNote();
    updatePipes();
    updateBackgroundTexts();
    checkCollisions();

    gameState.animationId = requestAnimationFrame(gameLoop);
  }

  function updateNote() {
    gameState.noteVelocity += GRAVITY;
    gameState.noteY += gameState.noteVelocity;

    // Boundaries - with safe margin
    if (gameState.noteY < 0) {
      endGame();
      return;
    }
    if (gameState.noteY + NOTE_SIZE > gameState.gameHeight) {
      endGame();
      return;
    }

    elements.note.style.transform = `translate(${gameState.gameWidth * 0.2}px, ${gameState.noteY}px)`;
  }

  function updatePipes() {
    const now = Date.now();
    
    // Spawn new pipe
    if (now - gameState.lastPipeTime > PIPE_SPAWN_INTERVAL) {
      spawnPipe();
      gameState.lastPipeTime = now;
    }

    // Move pipes
    gameState.pipes.forEach((pipe, index) => {
      pipe.x -= gameState.pipeSpeed;

      pipe.topElement.style.transform = `translateX(${pipe.x}px)`;
      pipe.bottomElement.style.transform = `translateX(${pipe.x}px)`;

      // Score when passing pipe
      if (!pipe.scored && pipe.x + PIPE_WIDTH < gameState.gameWidth * 0.2) {
        pipe.scored = true;
        gameState.score++;
        updateScoreDisplay();
        
        // Increase difficulty
        gameState.pipeSpeed = PIPE_SPEED_BASE + gameState.score * SPEED_INCREASE_PER_SCORE;
      }

      // Remove off-screen pipes
      if (pipe.x + PIPE_WIDTH < 0) {
        pipe.topElement.remove();
        pipe.bottomElement.remove();
        gameState.pipes.splice(index, 1);
      }
    });
  }

  function spawnPipe() {
    const minGapTop = SAFE_MARGIN + 50;
    const maxGapTop = gameState.gameHeight - PIPE_GAP - SAFE_MARGIN - 50;
    
    // Ensure valid range
    if (maxGapTop <= minGapTop) {
      return; // Screen too small, skip spawning
    }
    
    const gapTop = Math.random() * (maxGapTop - minGapTop) + minGapTop;

    const topPipe = document.createElement('div');
    topPipe.className = 'neela-pipe';
    topPipe.style.top = '0';
    topPipe.style.height = `${gapTop}px`;
    topPipe.style.left = `${gameState.gameWidth}px`;

    const bottomPipe = document.createElement('div');
    bottomPipe.className = 'neela-pipe';
    bottomPipe.style.top = `${gapTop + PIPE_GAP}px`;
    bottomPipe.style.height = `${gameState.gameHeight - gapTop - PIPE_GAP}px`;
    bottomPipe.style.left = `${gameState.gameWidth}px`;

    elements.canvas.appendChild(topPipe);
    elements.canvas.appendChild(bottomPipe);

    gameState.pipes.push({
      x: gameState.gameWidth,
      gapTop,
      gapBottom: gapTop + PIPE_GAP,
      topElement: topPipe,
      bottomElement: bottomPipe,
      scored: false,
    });
  }

  function clearPipes() {
    gameState.pipes.forEach(pipe => {
      pipe.topElement.remove();
      pipe.bottomElement.remove();
    });
    gameState.pipes = [];
  }

  function updateBackgroundTexts() {
    gameState.bgTexts.forEach(text => {
      text.x -= text.speed;
      
      if (text.isCloud) {
        // Clouds wrap around
        if (text.x < -10) {
          text.x = 110;
        }
      } else {
        // Text wraps around
        if (text.x < -50) {
          text.x = 150;
        }
      }
      
      text.element.style.left = `${text.x}%`;
    });
  }

  function checkCollisions() {
    const noteX = gameState.gameWidth * 0.2;
    const noteRight = noteX + NOTE_SIZE;
    const noteBottom = gameState.noteY + NOTE_SIZE;

    // Check pipe collisions with some tolerance
    const tolerance = 5;
    
    for (const pipe of gameState.pipes) {
      const pipeRight = pipe.x + PIPE_WIDTH;
      
      // Check if note overlaps with pipe horizontally
      if (noteRight - tolerance > pipe.x && noteX + tolerance < pipeRight) {
        // Check if note is outside the gap vertically
        if (gameState.noteY + tolerance < pipe.gapTop || noteBottom - tolerance > pipe.gapBottom) {
          endGame();
          return;
        }
      }
    }
  }

  function updateScoreDisplay() {
    elements.scoreDisplay.textContent = gameState.score;
  }

  function endGame() {
    gameState.isPlaying = false;
    if (gameState.animationId) {
      cancelAnimationFrame(gameState.animationId);
      gameState.animationId = null;
    }

    saveHighScore();

    elements.finalScore.textContent = gameState.score;
    elements.finalBest.textContent = gameState.highScore;
    elements.gameOver.classList.add('active');
  }

  function showReadyNotification() {
    pauseGame();
    elements.readyBanner.classList.add('active');
  }

  function hideGame() {
    elements.game.classList.remove('active');
    stopGame();
  }

  function showGame() {
    elements.game.classList.add('active');
  }

  // Public API
  window.NeelaTap = {
    init,
    showGame,
    hideGame,
    showReadyNotification,
    setOnQuit: (callback) => { onGameQuit = callback; },
    setOnMixReady: (callback) => { onMixReady = callback; },
  };
})();
