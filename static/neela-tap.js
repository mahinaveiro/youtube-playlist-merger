/**
 * Neela Tap - Premium Mobile-First Mini Game
 * A Codanela Production
 * Pure vanilla JS, no dependencies
 */

(function () {
  'use strict';

  // --- Dynamic CSS Injection for requirements not perfectly matched in existing CSS ---
  const style = document.createElement('style');
  style.textContent = `
    @keyframes neela-wobble {
      0% { transform: scale(1); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .neela-wobble-anim {
      animation: neela-wobble 0.4s ease-in-out infinite;
      transform-origin: center;
      width: 100%;
      height: 100%;
      display: block;
    }
    .neela-particle {
      position: absolute;
      width: 6px;
      height: 6px;
      background-color: #a78bfa; /* Soft purple */
      border-radius: 50%;
      pointer-events: none;
      z-index: 4;
      opacity: 0.8;
      transition: transform 0.5s ease-out, opacity 0.5s ease-out;
    }
  `;
  document.head.appendChild(style);

  // --- Web Audio API Setup ---
  let audioCtx = null;
  
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playOscillator(freq, type, duration, vol, rampToFreq=null, rampDuration=0) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (rampToFreq && rampDuration > 0) {
        osc.frequency.linearRampToValueAtTime(rampToFreq, audioCtx.currentTime + rampDuration);
      }
      
      gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }

  function playFlapSound() {
    playOscillator(520, 'sine', 0.08, 0.3);
  }

  function playScoreSound() {
    if (!audioCtx) return;
    try {
      playOscillator(660, 'sine', 0.06, 0.2);
      setTimeout(() => {
        playOscillator(880, 'sine', 0.06, 0.2);
      }, 60);
    } catch(e) {}
  }

  function playGameOverSound() {
    playOscillator(440, 'triangle', 0.6, 0.4, 150, 0.6);
  }

  // --- Constants & Config ---
  const isMobile = window.innerWidth <= 640;
  
  const GRAVITY = isMobile ? 0.18 : 0.15;           // Faster on mobile for better responsiveness
  const FLAP_STRENGTH = isMobile ? -5.0 : -4.2;     // Stronger flap on mobile
  const TERMINAL_VELOCITY = isMobile ? 5.5 : 4.5;   // Faster fall on mobile
  const PIPE_SPEED_BASE = 2.0;
  const MAX_PIPE_SPEED = 4.0;
  const PIPE_WIDTH = 52;
  const PIPE_SPAWN_INTERVAL = isMobile ? 2500 : 2000; // More distance between pipes on mobile (2.5s vs 2s)
  const NOTE_SIZE = 40;
  const HIGH_SCORE_KEY = 'neela_tap_highscore';

  let gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    highScore: 0,
    noteY: 0,
    noteVelocity: 0,
    pipes: [],
    lastPipeTimestamp: 0,
    pipeSpeed: PIPE_SPEED_BASE,
    gameWidth: 0,
    gameHeight: 0,
    animationId: null,
    bgTexts: [],
    particles: [],
    lastParticleFrame: 0,
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
          <div class="neela-wobble-anim" id="neela-note-inner" style="transform-origin: center;">
            <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
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
        
        <div class="neela-countdown" id="neela-countdown">
          <div class="neela-countdown-number" id="neela-countdown-number">3</div>
        </div>
      </div>
    `;

    elements = {
      game,
      canvas: document.getElementById('neela-canvas'),
      startScreen: document.getElementById('neela-start-screen'),
      note: document.getElementById('neela-note'),
      noteInner: document.getElementById('neela-note-inner'),
      scoreDisplay: document.getElementById('neela-score'),
      gameOver: document.getElementById('neela-game-over'),
      finalScore: document.getElementById('neela-final-score'),
      finalBest: document.getElementById('neela-final-best'),
      readyBanner: document.getElementById('neela-ready-banner'),
      countdown: document.getElementById('neela-countdown'),
      countdownNumber: document.getElementById('neela-countdown-number'),
      tapStart: document.getElementById('neela-tap-start'),
      quitStart: document.getElementById('neela-quit-start'),
      playAgain: document.getElementById('neela-play-again'),
      quitGame: document.getElementById('neela-quit-game'),
    };
  }

  function createBackgroundTexts() {
    const isMobile = window.innerWidth <= 640;
    
    // First text: "Codanela Production"
    const text1 = document.createElement('div');
    text1.className = 'neela-bg-text';
    text1.textContent = 'Codanela Production';
    text1.style.top = '35%';
    text1.style.left = '100%';
    if (isMobile) {
      text1.style.fontSize = '60px'; // Smaller on mobile
    }
    elements.canvas.appendChild(text1);
    gameState.bgTexts.push({ element: text1, x: 100, speed: 0.15 });

    // Second text: "Created by Mahin"
    const text2 = document.createElement('div');
    text2.className = 'neela-bg-text';
    text2.textContent = 'Created by Mahin';
    text2.style.top = '65%';
    text2.style.left = '100%';
    if (isMobile) {
      text2.style.fontSize = '60px'; // Smaller on mobile
    }
    elements.canvas.appendChild(text2);
    gameState.bgTexts.push({ element: text2, x: 100, speed: 0.18 });

    createClouds();
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
      gameState.bgTexts.push({ element: cloud, x: pos.left, speed: 0.05 + index * 0.02, isCloud: true });
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
    
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  function handleKeyDown(e) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (gameState.isPlaying && !gameState.isPaused) jump();
    }
  }

  function handlePointerDown(e) {
    if (e.target.closest('.neela-start-screen, .neela-game-over, .neela-quit-btn')) return;
    if (e.type === 'touchstart') e.preventDefault();
    if (gameState.isPlaying && !gameState.isPaused) jump();
  }

  function attachGameInputs() {
    document.addEventListener('keydown', handleKeyDown);
    elements.canvas.addEventListener('mousedown', handlePointerDown);
    elements.canvas.addEventListener('touchstart', handlePointerDown, {passive: false});
  }

  function detachGameInputs() {
    document.removeEventListener('keydown', handleKeyDown);
    elements.canvas.removeEventListener('mousedown', handlePointerDown);
    elements.canvas.removeEventListener('touchstart', handlePointerDown);
  }

  function handleResize() {
    gameState.gameWidth = elements.canvas.clientWidth;
    gameState.gameHeight = elements.canvas.clientHeight;
  }

  function jump() {
    initAudio();
    gameState.noteVelocity = FLAP_STRENGTH;
    playFlapSound();
  }

  function startGame() {
    initAudio();
    
    // Force resize calculation BEFORE showing countdown
    elements.startScreen.style.display = 'none';
    handleResize();
    
    // Show countdown overlay
    elements.countdown.classList.add('active');
    elements.note.style.display = 'block';
    elements.scoreDisplay.style.display = 'none';
    
    // Position note immediately with correct dimensions
    gameState.noteY = gameState.gameHeight / 2 - NOTE_SIZE / 2;
    gameState.noteVelocity = 0;
    gameState.currentRotation = 0;
    const initialX = gameState.gameWidth * 0.2;
    elements.note.style.transform = `translate(${initialX}px, ${gameState.noteY}px) rotate(0deg)`;
    void elements.note.offsetHeight;
    
    // Countdown sequence: 3... 2... 1... GO!
    let count = 3;
    elements.countdownNumber.textContent = count;
    elements.countdownNumber.className = 'neela-countdown-number';
    void elements.countdownNumber.offsetWidth;
    elements.countdownNumber.classList.add('neela-countdown-animate');
    
    playOscillator(440, 'sine', 0.1, 0.3);
    
    const countdownInterval = setInterval(() => {
      count--;
      
      if (count > 0) {
        elements.countdownNumber.textContent = count;
        elements.countdownNumber.className = 'neela-countdown-number';
        void elements.countdownNumber.offsetWidth;
        elements.countdownNumber.classList.add('neela-countdown-animate');
        playOscillator(440, 'sine', 0.1, 0.3);
      } else if (count === 0) {
        elements.countdownNumber.textContent = 'GO!';
        elements.countdownNumber.className = 'neela-countdown-number neela-countdown-go';
        void elements.countdownNumber.offsetWidth;
        elements.countdownNumber.classList.add('neela-countdown-animate');
        playOscillator(660, 'sine', 0.15, 0.4);
      } else {
        clearInterval(countdownInterval);
        elements.countdown.classList.remove('active');
        actuallyStartGame();
      }
    }, 1000);
  }
  
  function actuallyStartGame() {
    elements.scoreDisplay.style.display = 'block';
    elements.gameOver.classList.remove('active');
    
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.gameStartTimestamp = null;
    
    clearPipes();
    clearParticles();
    
    gameState.pipeSpeed = PIPE_SPEED_BASE;
    gameState.lastPipeTimestamp = 0;
    
    updateScoreDisplay();
    attachGameInputs();
    
    gameState.animationId = requestAnimationFrame(gameLoop);
  }

  function restartGame() {
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
    detachGameInputs();
    clearPipes();
    clearParticles();
    elements.note.style.display = 'none';
    elements.scoreDisplay.style.display = 'none';
    elements.gameOver.classList.remove('active');
    elements.startScreen.style.display = 'flex';
    
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

  // Main Loop
  function gameLoop(timestamp) {
    if (!gameState.isPlaying || gameState.isPaused) return;

    if (!gameState.gameStartTimestamp) {
      gameState.gameStartTimestamp = timestamp;
    }
    
    if (!gameState.lastPipeTimestamp) gameState.lastPipeTimestamp = timestamp;

    updateNote(timestamp);
    updatePipes(timestamp);
    updateParticles();
    updateBackgroundTexts();
    checkCollisions();

    if (gameState.isPlaying) {
      gameState.animationId = requestAnimationFrame(gameLoop);
    }
  }

  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  function updateNote(timestamp) {
    gameState.noteVelocity += GRAVITY;
    if (gameState.noteVelocity > TERMINAL_VELOCITY) {
      gameState.noteVelocity = TERMINAL_VELOCITY;
    }
    gameState.noteY += gameState.noteVelocity;

    const currentX = gameState.gameWidth * 0.2;
    
    let targetRotation = 0;
    if (gameState.noteVelocity < 0) {
      targetRotation = -20;
    } else {
      targetRotation = Math.min(30, (gameState.noteVelocity / TERMINAL_VELOCITY) * 30);
    }
    
    if (gameState.currentRotation === undefined) gameState.currentRotation = 0;
    gameState.currentRotation = lerp(gameState.currentRotation, targetRotation, 0.2);

    elements.note.style.transform = `translate(${currentX}px, ${gameState.noteY}px) rotate(${gameState.currentRotation}deg)`;

    gameState.lastParticleFrame++;
    if (gameState.lastParticleFrame > 5) {
      gameState.lastParticleFrame = 0;
      spawnParticle(currentX + NOTE_SIZE/2, gameState.noteY + NOTE_SIZE/2);
    }
  }

  function spawnParticle(x, y) {
    if (gameState.particles.length > 15) {
      const p = gameState.particles.shift();
      if (p && p.element && p.element.parentNode) p.element.remove();
    }
    
    const div = document.createElement('div');
    div.className = 'neela-particle';
    div.style.left = `${x - 3}px`; 
    div.style.top = `${y - 3}px`;
    elements.canvas.appendChild(div);
    
    void div.offsetWidth; // Force reflow
    
    div.style.transform = 'translateY(15px) scale(0)';
    div.style.opacity = '0';
    
    // Store particle ref safely
    const particleState = {
      element: div,
      createdAt: performance.now()
    };
    
    gameState.particles.push(particleState);
    
    setTimeout(() => {
      if (div && div.parentNode) div.remove();
      const idx = gameState.particles.indexOf(particleState);
      if (idx !== -1) gameState.particles.splice(idx, 1);
    }, 500);
  }

  function clearParticles() {
    gameState.particles.forEach(p => {
      if (p && p.element && p.element.parentNode) p.element.remove();
    });
    gameState.particles = [];
  }

  function updatePipes(timestamp) {
    // Grace period: Don't spawn pipes in the first 500ms to let player get ready
    const gracePeriod = 500;
    const timeSinceStart = timestamp - (gameState.gameStartTimestamp || timestamp);
    
    if (timeSinceStart > gracePeriod && timestamp - gameState.lastPipeTimestamp >= PIPE_SPAWN_INTERVAL) {
      spawnPipe();
      gameState.lastPipeTimestamp = timestamp;
    }

    for (let i = gameState.pipes.length - 1; i >= 0; i--) {
      const pipe = gameState.pipes[i];
      pipe.x -= gameState.pipeSpeed;

      pipe.topElement.style.transform = `translateX(${pipe.x}px)`;
      pipe.bottomElement.style.transform = `translateX(${pipe.x}px)`;

      const noteX = gameState.gameWidth * 0.2 + NOTE_SIZE/2;
      const pipeCenterX = pipe.x + PIPE_WIDTH/2;

      if (!pipe.scored && noteX > pipeCenterX) {
        pipe.scored = true;
        gameState.score++;
        updateScoreDisplay();
        playScoreSound();
        
        const bonus = Math.floor(gameState.score / 5) * 0.1;
        gameState.pipeSpeed = Math.min(PIPE_SPEED_BASE + bonus, MAX_PIPE_SPEED);
      }

      if (pipe.x + PIPE_WIDTH < 0) {
        if (pipe.topElement.parentNode) pipe.topElement.remove();
        if (pipe.bottomElement.parentNode) pipe.bottomElement.remove();
        gameState.pipes.splice(i, 1);
      }
    }
  }

  function spawnPipe() {
    const isMobile = window.innerWidth <= 640;
    const gapHeight = isMobile ? 160 : 180;
    
    const minCenterY = gameState.gameHeight * 0.25;
    const maxCenterY = gameState.gameHeight * 0.75;
    const gapCenterY = Math.random() * (maxCenterY - minCenterY) + minCenterY;
    
    const gapTop = gapCenterY - (gapHeight / 2);
    const gapBottom = gapCenterY + (gapHeight / 2);

    const topPipe = document.createElement('div');
    topPipe.className = 'neela-pipe';
    topPipe.style.top = '0px';
    topPipe.style.height = `${gapTop}px`;
    topPipe.style.left = '0px';
    topPipe.style.width = `${PIPE_WIDTH}px`;
    topPipe.style.transform = `translateX(${gameState.gameWidth}px)`;

    const bottomPipe = document.createElement('div');
    bottomPipe.className = 'neela-pipe';
    bottomPipe.style.top = `${gapBottom}px`;
    bottomPipe.style.height = `${gameState.gameHeight - gapBottom}px`;
    bottomPipe.style.left = '0px';
    bottomPipe.style.width = `${PIPE_WIDTH}px`;
    bottomPipe.style.transform = `translateX(${gameState.gameWidth}px)`;

    elements.canvas.appendChild(topPipe);
    elements.canvas.appendChild(bottomPipe);

    gameState.pipes.push({
      x: gameState.gameWidth,
      topElement: topPipe,
      bottomElement: bottomPipe,
      scored: false,
    });
  }

  function clearPipes() {
    gameState.pipes.forEach(pipe => {
      if (pipe.topElement.parentNode) pipe.topElement.remove();
      if (pipe.bottomElement.parentNode) pipe.bottomElement.remove();
    });
    gameState.pipes = [];
  }

  function updateBackgroundTexts() {
    gameState.bgTexts.forEach(text => {
      text.x -= text.speed;
      
      // For background texts (not clouds), reset when completely off-screen to the left
      // This ensures they scroll all the way from right to left
      if (text.isCloud) {
        if (text.x < -10) text.x = 110;
      } else {
        // For text elements, reset when they've scrolled completely off the left side
        // Use -50 to ensure text fully exits before looping
        if (text.x < -50) text.x = 150;
      }
      
      text.element.style.left = `${text.x}%`;
    });
  }

  function updateParticles() {
    // Mostly handled via CSS transition + self-deleting setTimeouts
  }

  function checkCollisions() {
    // Boundary check
    if (gameState.noteY < 0 || gameState.noteY + NOTE_SIZE > gameState.gameHeight) {
      triggerGameOver();
      return;
    }

    const noteRect = elements.noteInner.getBoundingClientRect();
    
    // Safety check - ensure note has valid dimensions before collision detection
    if (noteRect.width === 0 || noteRect.height === 0) {
      return; // Skip collision check this frame
    }
    
    // Slight tolerance to make bounding box feel fair vs visual art bounds
    const shrink = 4;
    const noteHitbox = {
      left: noteRect.left + shrink,
      right: noteRect.right - shrink,
      top: noteRect.top + shrink,
      bottom: noteRect.bottom - shrink
    };

    for (let pipe of gameState.pipes) {
      const topRect = pipe.topElement.getBoundingClientRect();
      const botRect = pipe.bottomElement.getBoundingClientRect();

      const intersect = (r1, r2) => {
        return !(r1.right < r2.left || 
                 r1.left > r2.right || 
                 r1.bottom < r2.top || 
                 r1.top > r2.bottom);
      };

      if (intersect(noteHitbox, topRect) || intersect(noteHitbox, botRect)) {
        triggerGameOver();
        return;
      }
    }
  }

  function triggerGameOver() {
    gameState.isPlaying = false;
    if (gameState.animationId) {
      cancelAnimationFrame(gameState.animationId);
      gameState.animationId = null;
    }

    playGameOverSound();
    saveHighScore();

    elements.finalScore.textContent = gameState.score;
    elements.finalBest.textContent = gameState.highScore;

    setTimeout(() => {
      elements.gameOver.classList.add('active');
    }, 400);
  }

  function updateScoreDisplay() {
    elements.scoreDisplay.textContent = gameState.score;
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
