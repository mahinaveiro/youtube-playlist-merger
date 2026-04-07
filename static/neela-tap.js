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
      will-change: transform, opacity;
    }
    .neela-boss-banner {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      transform: translateY(-100%);
      transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }
    .neela-boss-banner.active {
      transform: translateY(0);
    }
    .neela-boss-banner h2 {
      font-size: 42px;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 4px;
      animation: neela-text-pulse 1.5s ease-in-out infinite;
    }
    .neela-boss-banner p {
      font-size: 18px;
      margin: 10px 0 0;
      opacity: 0.8;
    }
    @keyframes neela-text-pulse {
      0%, 100% { text-shadow: 0 0 10px currentColor; }
      50% { text-shadow: 0 0 30px currentColor; }
    }
    .neela-wall {
      position: absolute;
      width: 60px;
      z-index: 10;
      will-change: transform;
    }
    .neela-wall-line {
      position: absolute;
      width: 2px;
      height: 100%;
      background: rgba(255, 255, 255, 0.4);
      top: 0;
    }
    .neela-ghost {
      position: absolute;
      width: 40px;
      height: 40px;
      z-index: 9;
      pointer-events: none;
      will-change: transform;
      animation: neela-ghost-fade 0.8s ease-in-out infinite alternate;
    }
    @keyframes neela-ghost-fade {
      from { opacity: 0.4; }
      to { opacity: 0.6; }
    }
    .neela-flash-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: bold;
      z-index: 60;
      pointer-events: none;
      animation: neela-flash-anim 1s ease-out forwards;
    }
    @keyframes neela-flash-anim {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
    }
    .neela-boss-pipe {
      position: absolute;
      width: 70px !important;
      z-index: 10;
      will-change: transform;
      border-radius: 8px;
    }
    .neela-ghost-flare {
      position: absolute;
      width: 8px;
      height: 8px;
      background: rgba(0, 191, 255, 0.6);
      box-shadow: 0 0 10px #00bfff, 0 0 20px #0000ff;
      border-radius: 50%;
      pointer-events: none;
      z-index: 8;
      will-change: transform, opacity;
    }
    .neela-weather-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      opacity: 0;
      transition: opacity 2.5s ease;
      overflow: hidden;
    }
    .neela-weather-layer.active {
      opacity: 1;
    }
    .neela-rain-drop {
      position: absolute;
      width: 2px;
      height: 15px;
      background: rgba(255, 255, 255, 0.4);
      top: -20px;
    }
    .neela-snow-flake {
      position: absolute;
      width: 4px;
      height: 4px;
      background: white;
      border-radius: 50%;
      top: -10px;
      opacity: 0.8;
    }
    .neela-thunder-flash {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      opacity: 0;
      z-index: 60;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // --- Web Audio API Setup ---
  let audioCtx = null;
  let bgMusic = null;
  let bgMusicGain = null;
  let isMusicMuted = false;
  const MUSIC_MUTE_KEY = 'neela_tap_music_muted';
  
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
  
  function loadMusicMuteState() {
    const saved = localStorage.getItem(MUSIC_MUTE_KEY);
    isMusicMuted = saved === 'true';
  }
  
  function saveMusicMuteState() {
    localStorage.setItem(MUSIC_MUTE_KEY, isMusicMuted.toString());
  }
  
  function initBackgroundMusic() {
    if (bgMusic) return; // Already initialized
    
    bgMusic = new Audio('/static/song.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0; // Start at 0 for fade in
    
    loadMusicMuteState();
    updateMuteButtonUI();
  }
  
  function fadeInMusic() {
    if (!bgMusic || isMusicMuted) return;
    
    bgMusic.volume = 0;
    bgMusic.play().catch(e => console.log('Music play failed:', e));
    
    // Fade in over 1 second
    let volume = 0;
    const fadeInterval = setInterval(() => {
      volume += 0.02;
      if (volume >= 0.4) {
        volume = 0.4;
        clearInterval(fadeInterval);
      }
      bgMusic.volume = volume;
    }, 20);
  }
  
  function fadeOutMusic() {
    if (!bgMusic) return;
    
    let volume = bgMusic.volume;
    const fadeInterval = setInterval(() => {
      volume -= 0.02;
      if (volume <= 0) {
        volume = 0;
        clearInterval(fadeInterval);
        bgMusic.pause();
        bgMusic.currentTime = 0;
      }
      bgMusic.volume = volume;
    }, 20);
  }
  
  function toggleMusicMute() {
    isMusicMuted = !isMusicMuted;
    saveMusicMuteState();
    updateMuteButtonUI();
    
    if (isMusicMuted) {
      fadeOutMusic();
    } else if (gameState.isPlaying) {
      fadeInMusic();
    }
  }
  
  function updateMuteButtonUI() {
    if (!elements.muteBtn) return;
    
    const soundWaves = elements.muteBtn.querySelectorAll('.neela-sound-waves');
    
    if (isMusicMuted) {
      // Hide sound waves when muted
      soundWaves.forEach(wave => wave.style.display = 'none');
      elements.muteBtn.title = 'Unmute Music';
      
      // Add X line for muted state
      if (!elements.muteBtn.querySelector('.neela-mute-x')) {
        const svg = elements.muteBtn.querySelector('svg');
        const muteLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        muteLine.setAttribute('class', 'neela-mute-x');
        muteLine.setAttribute('x1', '1');
        muteLine.setAttribute('y1', '1');
        muteLine.setAttribute('x2', '23');
        muteLine.setAttribute('y2', '23');
        muteLine.setAttribute('stroke', 'currentColor');
        muteLine.setAttribute('stroke-width', '2');
        muteLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(muteLine);
      }
    } else {
      // Show sound waves when unmuted
      soundWaves.forEach(wave => wave.style.display = 'block');
      elements.muteBtn.title = 'Mute Music';
      
      // Remove X line
      const muteLine = elements.muteBtn.querySelector('.neela-mute-x');
      if (muteLine) muteLine.remove();
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
  
  const GRAVITY = isMobile ? 0.18 : 0.22;
  const FLAP_STRENGTH = isMobile ? -5.0 : -5.5;
  const TERMINAL_VELOCITY = isMobile ? 5.5 : 6.5;
  
  const START_PIPE_SPEED = 2.4;   // Boosted starting speed
  const MAX_PIPE_SPEED = 5.0;     // Slightly higher max
  const SPEED_INC = 0.08;
  
  const START_SPAWN_INTERVAL = isMobile ? 2200 : 2600; // Desktop gets more distance
  const MIN_SPAWN_INTERVAL = 1500;   // Minimum gap
  
  const PIPE_WIDTH = 52;
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
    gameStartTimestamp: null,
    lastFrameTimestamp: 0,
    pipeSpeed: START_PIPE_SPEED,
    spawnInterval: START_SPAWN_INTERVAL,
    gameWidth: 0,
    gameHeight: 0,
    animationId: null,
    bgTexts: [],
    particles: [],
    lastParticleFrame: 0,
    // Boss State
    boss1Active: false,
    boss1Triggered: false,
    boss2Active: false,
    boss2Triggered: false,
    bossWall: null,
    bossGhost: null,
    ghostBuffer: [],
    boss1Score: 0,
    boss2Score: 0,
    gravityPaused: false,
    // Weather State
    weather: 'clear',
    lastWeatherScore: 0,
    nextWeatherAt: 8,
    weatherElements: []
  };

  let elements = {};
  let onGameQuit = null;
  let onMixReady = null;

  function init() {
    loadHighScore();
    createGameElements();
    createBackgroundTexts();
    setupEventListeners();
    initBackgroundMusic();
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
          <button id="neela-test-skip" style="margin-top: 15px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #aaa; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 10px;">[TEST] Skip to 25 pts</button>
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
        
        <button class="neela-mute-btn" id="neela-mute-btn" title="Mute Music">
          <svg class="neela-mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="neela-sound-waves" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="neela-sound-waves" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
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
      muteBtn: document.getElementById('neela-mute-btn'),
      tapStart: document.getElementById('neela-tap-start'),
      quitStart: document.getElementById('neela-quit-start'),
      playAgain: document.getElementById('neela-play-again'),
      quitGame: document.getElementById('neela-quit-game'),
      testSkip: document.getElementById('neela-test-skip'),
    };
    
    // Initialize weather layers after elements object is defined
    elements.rainLayer = createWeatherLayer('rain');
    elements.snowLayer = createWeatherLayer('snow');
    elements.thunderFlash = createThunderFlash();
  }

  function createWeatherLayer(type) {
    const layer = document.createElement('div');
    layer.className = `neela-weather-layer neela-weather-${type}`;
    elements.canvas.appendChild(layer);
    return layer;
  }

  function createThunderFlash() {
    const flash = document.createElement('div');
    flash.className = 'neela-thunder-flash';
    elements.canvas.appendChild(flash);
    return flash;
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
      text1.style.fontSize = '40px'; // Much smaller on mobile
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
      text2.style.fontSize = '40px'; // Much smaller on mobile
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
      { top: 35, left: 10, size: 70 },
      { top: 5, left: 85, size: 55 },
      { top: 45, left: 90, size: 65 },
      { top: 15, left: 40, size: 90 },
      { top: 30, left: 60, size: 50 },
    ];
    cloudPositions.forEach((pos, index) => {
      const cloud = document.createElement('div');
      cloud.className = 'neela-cloud';
      cloud.style.top = `${pos.top}%`;
      cloud.style.left = `${pos.left}%`;
      cloud.style.width = `${pos.size}px`;
      cloud.style.height = `${pos.size * 0.6}px`;
      elements.canvas.appendChild(cloud);
      gameState.bgTexts.push({ element: cloud, x: pos.left, speed: 0.03 + index * 0.01, isCloud: true });
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
    elements.muteBtn.addEventListener('click', toggleMusicMute);
    if (elements.testSkip) {
      elements.testSkip.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
        gameState.score = 25;
        updateScoreDisplay();
      });
    }
    
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
    
    // Position note immediately with correct dimensions
    elements.startScreen.style.display = 'none';
    handleResize();
    
    elements.note.style.display = 'block';
    elements.scoreDisplay.style.display = 'block';
    
    gameState.noteY = gameState.gameHeight / 2 - NOTE_SIZE / 2;
    gameState.noteVelocity = 0;
    gameState.currentRotation = 0;
    const initialX = gameState.gameWidth * 0.2;
    elements.note.style.transform = `translate(${initialX}px, ${gameState.noteY}px) rotate(0deg)`;
    
    actuallyStartGame();
  }
  
  function actuallyStartGame() {
    elements.scoreDisplay.style.display = 'block';
    elements.gameOver.classList.remove('active');
    
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.gameStartTimestamp = null;
    gameState.lastFrameTimestamp = 0;
    
    clearPipes();
    clearParticles();
    
    gameState.pipeSpeed = START_PIPE_SPEED;
    gameState.spawnInterval = START_SPAWN_INTERVAL;
    
    // Position first pipe VERY close (45% across screen) for truly instant action
    spawnPipe(gameState.gameWidth * 0.45);
    gameState.lastPipeTimestamp = performance.now();
    
    // Reset Boss State
    gameState.boss1Active = false;
    gameState.boss1Triggered = false;
    gameState.boss2Active = false;
    gameState.boss2Triggered = false;
    gameState.bossWall = null;
    gameState.bossGhost = null;
    gameState.ghostBuffer = [];
    
    gameState.boss1Score = 25 + Math.floor(Math.random() * 10); // Random score 25-35
    gameState.boss2Score = 40 + Math.floor(Math.random() * 15); // Random score 40-55
    
    // Reset Weather
    gameState.weather = 'clear';
    gameState.lastWeatherScore = 0;
    gameState.nextWeatherAt = 7 + Math.floor(Math.random() * 5);
    clearWeatherElements();
    elements.rainLayer.classList.remove('active');
    elements.snowLayer.classList.remove('active');
    
    updateScoreDisplay();
    attachGameInputs();
    
    // Start background music with fade in
    fadeInMusic();
    
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
    
    // Boss cleanup
    if (gameState.bossWall) {
      if (gameState.bossWall.topElement) gameState.bossWall.topElement.remove();
      if (gameState.bossWall.bottomElement) gameState.bossWall.bottomElement.remove();
      gameState.bossWall = null;
    }
    if (gameState.bossGhost) {
      gameState.bossGhost.element.remove();
      gameState.bossGhost = null;
    }
    stopGhostAudio();
    resetBossUI();
    document.querySelectorAll('.neela-boss-banner, .neela-flash-text').forEach(el => el.remove());

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
      gameState.lastFrameTimestamp = timestamp;
      
      if (!gameState.lastPipeTimestamp) {
        gameState.lastPipeTimestamp = timestamp;
      }
    }
    
    // Calculate delta time multiplier (1.0 for 60fps ~ 16.66ms per frame)
    let deltaTime = timestamp - gameState.lastFrameTimestamp;
    // Cap deltaTime to avoid massive jumps after lag or tab switch
    if (deltaTime > 100) deltaTime = 100;
    
    const timeScale = deltaTime / 16.666;
    gameState.lastFrameTimestamp = timestamp;

    updateNote(timestamp, timeScale);
    updatePipes(timestamp, timeScale);
    updateBosses(timestamp, timeScale);
    updateWeather(timestamp, timeScale);
    updateParticles();
    // Background text movement is now handled by CSS animations for performance
    checkCollisions();

    if (gameState.isPlaying) {
      gameState.animationId = requestAnimationFrame(gameLoop);
    }
  }

  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  function updateNote(timestamp, timeScale) {
    if (!gameState.gravityPaused) {
      gameState.noteVelocity += GRAVITY * timeScale;
    } else {
      gameState.noteVelocity = 0;
    }
    
    if (gameState.noteVelocity > TERMINAL_VELOCITY) {
      gameState.noteVelocity = TERMINAL_VELOCITY;
    }
    gameState.noteY += gameState.noteVelocity * timeScale;

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

    gameState.lastParticleFrame += timeScale;
    if (gameState.lastParticleFrame > 5) {
      gameState.lastParticleFrame = 0;
      spawnParticle(currentX + NOTE_SIZE/2, gameState.noteY + NOTE_SIZE/2);
    }
  }

  function spawnParticle(x, y) {
    if (gameState.particles.length > 12) {
      const p = gameState.particles.shift();
      if (p && p.element && p.element.parentNode) p.element.remove();
    }
    
    const div = document.createElement('div');
    div.className = 'neela-particle';
    div.style.transform = `translate(${x - 3}px, ${y - 3}px)`;
    elements.canvas.appendChild(div);
    
    // Performance optimization: use CSS animationend for cleanup if possible, 
    // but here we use a controlled frame-based approach or short timeout for strict count
    let opacity = 0.8;
    let scale = 1;
    let ty = 0;
    
    const pInterval = setInterval(() => {
      opacity -= 0.08;
      scale -= 0.1;
      ty += 1.5;
      if (opacity <= 0) {
        clearInterval(pInterval);
        if (div.parentNode) div.remove();
      } else {
        div.style.opacity = opacity;
        div.style.transform = `translate(${x - 3}px, ${y - 3 + ty}px) scale(${scale})`;
      }
    }, 30);
    
    gameState.particles.push({ element: div });
  }

  function clearParticles() {
    gameState.particles.forEach(p => {
      if (p && p.element && p.element.parentNode) p.element.remove();
    });
    gameState.particles = [];
  }

  function updatePipes(timestamp, timeScale) {
    if (gameState.boss1Active && !gameState.bossWall) {
      // Regular pipes clearing for boss 1
    } else if (!gameState.boss1Active) {
      const gracePeriod = 500;
      const timeSinceStart = timestamp - (gameState.gameStartTimestamp || timestamp);
      
      if (timeSinceStart > gracePeriod && timestamp - gameState.lastPipeTimestamp >= gameState.spawnInterval) {
        spawnPipe();
        gameState.lastPipeTimestamp = timestamp;
      }
    }

    for (let i = gameState.pipes.length - 1; i >= 0; i--) {
      const pipe = gameState.pipes[i];
      pipe.x -= gameState.pipeSpeed * timeScale;
      pipe.topElement.style.transform = `translateX(${pipe.x}px)`;
      pipe.bottomElement.style.transform = `translateX(${pipe.x}px)`;

      const noteX = gameState.gameWidth * 0.2 + NOTE_SIZE/2;
      const pipeCenterX = pipe.x + PIPE_WIDTH/2;

      if (!pipe.scored && noteX > pipeCenterX) {
        pipe.scored = true;
        gameState.score++;
        updateScoreDisplay();
        playScoreSound();
        checkBossTriggers();
        checkWeatherTriggers();
        
        if (!gameState.boss1Active && !gameState.boss2Active) {
          gameState.pipeSpeed = Math.min(START_PIPE_SPEED + (gameState.score * SPEED_INC), MAX_PIPE_SPEED);
          const intervalReduc = Math.floor(gameState.score / 5) * 15;
          gameState.spawnInterval = Math.max(START_SPAWN_INTERVAL - intervalReduc, MIN_SPAWN_INTERVAL);
        }
      }

      if (pipe.x + PIPE_WIDTH < -50) {
        if (pipe.topElement.parentNode) pipe.topElement.remove();
        if (pipe.bottomElement.parentNode) pipe.bottomElement.remove();
        gameState.pipes.splice(i, 1);
      }
    }
  }

  function checkBossTriggers() {
    if (gameState.score === gameState.boss1Score && !gameState.boss1Triggered) {
      triggerBoss1();
    }
    if (gameState.score === gameState.boss2Score && !gameState.boss2Triggered) {
      triggerBoss2();
    }
  }

  function triggerBoss1() {
    gameState.boss1Triggered = true;
    gameState.boss1Active = true;
    
    // Banner
    showBossBanner("BOSS INCOMING", "THE BEATDROP WALL", "linear-gradient(to bottom, #8B0000, #FF2020)", "#FF4444");
    
    // Audio deep rumble
    playBossIntroAudio(60, 180, 1.2, 'sawtooth');
    
    // NO FREEZING - Player keeps control
    setTimeout(() => {
      spawnBossWall();
    }, 3000); 
  }

  function spawnBossWall() {
    const top = document.createElement('div');
    top.className = 'neela-boss-pipe';
    top.style.height = '1000px';
    top.style.backgroundColor = '#8B0000';
    top.style.boxShadow = 'inset 0 0 20px #FF4444, 0 0 40px #FF0000cc';
    top.style.border = '2px solid #FF4444';
    top.style.left = '0';
    top.style.top = '0';
    
    const bot = document.createElement('div');
    bot.className = 'neela-boss-pipe';
    bot.style.height = '1000px';
    bot.style.backgroundColor = '#8B0000';
    bot.style.boxShadow = 'inset 0 0 20px #FF4444, 0 0 40px #FF0000cc';
    bot.style.border = '2px solid #FF4444';
    bot.style.left = '0';
    bot.style.top = '0';
    
    elements.canvas.appendChild(top);
    elements.canvas.appendChild(bot);
    
    gameState.bossWall = {
      topElement: top,
      bottomElement: bot,
      x: gameState.gameWidth + 100, // Start just off screen
      phase: 'moving', // moving, exiting
      gapY: gameState.gameHeight / 2
    };
    
    elements.scoreDisplay.style.color = '#FF2020';
    elements.canvas.style.boxShadow = 'inset 0 0 100px #FF000066';
  }

  function triggerBoss2() {
    gameState.boss2Triggered = true;
    gameState.boss2Active = true;
    
    showBossBanner("BOSS INCOMING", "THE ECHO GHOST", "linear-gradient(to bottom, #2D0059, #9B00FF)", "#CC88FF");
    
    // Eerie audio
    playGhostIntroAudio();
    
    setTimeout(() => {
      spawnGhost();
    }, 1800);
    
    elements.scoreDisplay.style.color = '#9B00FF';
    elements.canvas.style.boxShadow = 'inset 0 0 80px #9B00FF44';
  }

  function spawnGhost() {
    const ghost = document.createElement('div');
    ghost.className = 'neela-ghost';
    ghost.innerHTML = elements.noteInner.innerHTML;
    // Replica color with blue-purple tint
    ghost.style.color = '#b09eff';
    ghost.style.opacity = '0.5';
    ghost.style.filter = 'drop-shadow(0 0 15px #00bfff) drop-shadow(0 0 25px #0000ffaa)';
    elements.canvas.appendChild(ghost);
    
    gameState.bossGhost = {
      element: ghost,
      spawnTime: performance.now(),
      trailCounter: 0,
      flareCounter: 0
    };
    gameState.ghostBuffer = [];
  }

  function showBossBanner(title, sub, gradient, textColor) {
    const banner = document.createElement('div');
    banner.className = 'neela-boss-banner';
    banner.style.background = gradient;
    banner.style.color = 'white';
    banner.innerHTML = `<h2 style="color: ${textColor}">${title}</h2><p>${sub}</p>`;
    elements.canvas.appendChild(banner);
    
    setTimeout(() => banner.classList.add('active'), 100);
    setTimeout(() => {
      banner.classList.remove('active');
      setTimeout(() => banner.remove(), 600);
    }, 1800 + 100);
  }

  function playBossIntroAudio(f1, f2, dur, type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(f2, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function playGhostIntroAudio() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    
    lfo.frequency.setValueAtTime(5, audioCtx.currentTime);
    lfoGain.gain.setValueAtTime(15, audioCtx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.8);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    lfo.start();
    osc.start();
    
    gameState.ghostOsc = { osc, lfo, gain };
  }

  function stopGhostAudio() {
    if (gameState.ghostOsc) {
      gameState.ghostOsc.gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      setTimeout(() => {
        gameState.ghostOsc.osc.stop();
        gameState.ghostOsc.lfo.stop();
        gameState.ghostOsc = null;
      }, 1000);
    }
  }

  function updateBosses(timestamp, timeScale) {
    if (gameState.bossWall) {
      const wall = gameState.bossWall;
      const gapHeight = 155;
      
      // Gap movement
      const sin = Math.sin(timestamp * 0.0018);
      const gapOffset = sin * (gameState.gameHeight * 0.28);
      wall.gapY = (gameState.gameHeight / 2) + gapOffset;
      
      // Horizontal movement
      const wallSpeed = 3.5; // Faster arrival
      wall.x -= wallSpeed * timeScale;
      
      if (wall.x < -100) {
        finishBoss1();
      }
      
      wall.topElement.style.transform = `translate(${wall.x}px, ${wall.gapY - gapHeight/2 - 1000}px)`;
      wall.bottomElement.style.transform = `translate(${wall.x}px, ${wall.gapY + gapHeight/2}px)`;
      
      // Wall particles
      if (Math.random() < 0.3) {
        spawnWallParticle(wall.x + 60, Math.random() * gameState.gameHeight);
      }
      
      // Wall sounds
      if (!wall.lastSin) wall.lastSin = 0;
      if (sin > 0.98 && wall.lastSin <= 0.98) playOscillator(880, 'sine', 0.05, 0.2);
      if (sin < -0.98 && wall.lastSin >= -0.98) playOscillator(120, 'sine', 0.08, 0.3);
      wall.lastSin = sin;
    }
    
    if (gameState.bossGhost) {
      const ghost = gameState.bossGhost;
      const now = performance.now();
      
      // Buffer current note pos
      gameState.ghostBuffer.push({ x: gameState.gameWidth * 0.2, y: gameState.noteY });
      if (gameState.ghostBuffer.length > 120) { // Increased delay to 2s
        const targetPos = gameState.ghostBuffer.shift();
        // Shift ghost horizontally to be slightly behind the player
        const ghostX = targetPos.x - 30; 
        ghost.element.style.transform = `translate(${ghostX}px, ${targetPos.y}px) rotate(${gameState.currentRotation}deg)`;
        ghost.lastX = ghostX;
        ghost.lastY = targetPos.y;
      } else {
        // Drifting entrance from right
        const startX = gameState.gameWidth + 100;
        const noteX = (gameState.gameWidth * 0.2) - 30; // Target behind player
        const driftProgress = Math.min(1, (now - ghost.spawnTime) / 4000); // Slower 4s drift in
        
        ghost.lastX = lerp(startX, noteX, driftProgress);
        ghost.lastY = gameState.gameHeight / 2 + Math.sin(now * 0.002) * 80;
        
        ghost.element.style.transform = `translate(${ghost.lastX}px, ${ghost.lastY}px)`;
      }
      
      // Trails
      ghost.trailCounter++;
      if (ghost.trailCounter >= 3) {
        ghost.trailCounter = 0;
        spawnGhostTrail(ghost.lastX, ghost.lastY);
      }
      
      // Blue Flares
      ghost.flareCounter++;
      if (ghost.flareCounter >= 5) {
        ghost.flareCounter = 0;
        spawnGhostFlare(ghost.lastX + 20, ghost.lastY + 20);
      }
      
      // Distance sound
      const dx = (gameState.gameWidth * 0.2) - ghost.lastX;
      const dy = gameState.noteY - ghost.lastY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 80) playGhostWhoosh();

      if (now - ghost.spawnTime > 18000) {
        finishBoss2();
      }
    }
  }

  function spawnWallParticle(x, y) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.width = '4px';
    p.style.height = '4px';
    p.style.backgroundColor = '#FF4444';
    p.style.left = '0';
    p.style.top = '0';
    p.style.transform = `translate(${x}px, ${y}px)`;
    p.style.zIndex = '5';
    elements.canvas.appendChild(p);
    
    setTimeout(() => {
      p.style.transition = 'transform 0.6s ease-out, opacity 0.6s';
      p.style.transform = `translate(${x - 100}px, ${y + (Math.random()-0.5)*50}px)`;
      p.style.opacity = '0';
      setTimeout(() => p.remove(), 600);
    }, 10);
  }

  function spawnGhostTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'neela-ghost';
    trail.innerHTML = elements.noteInner.innerHTML;
    trail.style.color = '#00bfff';
    trail.style.opacity = '0.25';
    trail.style.transform = `translate(${x}px, ${y}px) scale(0.85)`;
    elements.canvas.appendChild(trail);
    setTimeout(() => {
      trail.style.transition = 'opacity 0.6s, transform 0.6s';
      trail.style.opacity = '0';
      trail.style.transform = `translate(${x}px, ${y}px) scale(0.6)`;
      setTimeout(() => trail.remove(), 600);
    }, 10);
  }

  function spawnGhostFlare(x, y) {
    const flare = document.createElement('div');
    flare.className = 'neela-ghost-flare';
    flare.style.transform = `translate(${x}px, ${y}px)`;
    elements.canvas.appendChild(flare);
    
    const tx = x + (Math.random() - 0.5) * 100;
    const ty = y + (Math.random() - 0.5) * 100;
    
    setTimeout(() => {
      flare.style.transition = 'transform 1s ease-out, opacity 1s';
      flare.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
      flare.style.opacity = '0';
      setTimeout(() => flare.remove(), 1000);
    }, 10);
  }

  function playGhostWhoosh() {
    if (!audioCtx || gameState.lastWhoosh && Date.now() - gameState.lastWhoosh < 500) return;
    gameState.lastWhoosh = Date.now();
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
  }

  function finishBoss1() {
    gameState.boss1Active = false;
    if (gameState.bossWall) {
      if (gameState.bossWall.topElement) gameState.bossWall.topElement.remove();
      if (gameState.bossWall.bottomElement) gameState.bossWall.bottomElement.remove();
      gameState.bossWall = null;
    }
    playVictoryChime();
    showFlashText("SURVIVED!", "#10b981");
    resetBossUI();
  }

  function finishBoss2() {
    gameState.boss2Active = false;
    if (gameState.bossGhost) {
      gameState.bossGhost.element.style.transition = 'opacity 1s';
      gameState.bossGhost.element.style.opacity = '0';
      const el = gameState.bossGhost.element;
      setTimeout(() => el.remove(), 1000);
      gameState.bossGhost = null;
    }
    stopGhostAudio();
    playVictoryChime();
    showFlashText("GHOST BANISHED!", "#9B00FF");
    resetBossUI();
  }

  function resetBossUI() {
    elements.scoreDisplay.style.color = '#e0d4ff';
    elements.canvas.style.boxShadow = 'none';
  }

  function playVictoryChime() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((f, i) => {
      setTimeout(() => playOscillator(f, 'sine', 0.1, 0.2), i * 100);
    });
  }

  function showFlashText(text, color) {
    const el = document.createElement('div');
    el.className = 'neela-flash-text';
    el.style.color = color;
    el.textContent = text;
    elements.canvas.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function spawnPipe(customX = null) {
    const isMobile = window.innerWidth <= 640;
    const gapHeight = isMobile ? 160 : 180;
    
    const spawnX = customX !== null ? customX : gameState.gameWidth;
    
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
    topPipe.style.transform = `translateX(${spawnX}px)`;

    const bottomPipe = document.createElement('div');
    bottomPipe.className = 'neela-pipe';
    bottomPipe.style.top = `${gapBottom}px`;
    bottomPipe.style.height = `${gameState.gameHeight - gapBottom}px`;
    bottomPipe.style.left = '0px';
    bottomPipe.style.width = `${PIPE_WIDTH}px`;
    bottomPipe.style.transform = `translateX(${spawnX}px)`;

    elements.canvas.appendChild(topPipe);
    elements.canvas.appendChild(bottomPipe);

    gameState.pipes.push({
      x: spawnX,
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

  function updateBackgroundTexts(timeScale) {
    gameState.bgTexts.forEach(text => {
      text.x -= text.speed * timeScale;
      
      if (text.isCloud) {
        if (text.x < -20) text.x = 120;
      } else {
        if (text.x < -60) text.x = 160;
      }
      
      text.element.style.transform = `translateX(${text.x}vw)`;
    });
  }

  function checkWeatherTriggers() {
    if (gameState.score >= gameState.lastWeatherScore + gameState.nextWeatherAt) {
      changeWeather();
    }
  }

  function changeWeather() {
    const cycle = ['clear', 'rain', 'thunder', 'snow'];
    const currentIndex = cycle.indexOf(gameState.weather);
    const nextIndex = (currentIndex + 1) % cycle.length;
    
    gameState.weather = cycle[nextIndex];
    gameState.lastWeatherScore = gameState.score;
    gameState.nextWeatherAt = 7 + Math.floor(Math.random() * 5); // 7 to 11 points
    
    // Update visual layers
    elements.rainLayer.classList.remove('active');
    elements.snowLayer.classList.remove('active');
    
    if (gameState.weather === 'rain' || gameState.weather === 'thunder') {
      elements.rainLayer.classList.add('active');
      for(let i=0; i<30; i++) spawnWeatherElement('rain');
    } else if (gameState.weather === 'snow') {
      elements.snowLayer.classList.add('active');
      for(let i=0; i<40; i++) spawnWeatherElement('snow');
    } else {
      clearWeatherElements();
    }
  }

  function spawnWeatherElement(type) {
    const el = document.createElement('div');
    el.className = type === 'rain' ? 'neela-rain-drop' : 'neela-snow-flake';
    
    const x = Math.random() * gameState.gameWidth;
    const y = Math.random() * gameState.gameHeight - gameState.gameHeight;
    const speed = type === 'rain' ? 10 + Math.random() * 10 : 2 + Math.random() * 3;
    
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    const targetLayer = type === 'rain' ? elements.rainLayer : elements.snowLayer;
    targetLayer.appendChild(el);
    
    gameState.weatherElements.push({
      element: el,
      x: x,
      y: y,
      speed: speed,
      type: type,
      sinOffset: Math.random() * 10
    });
  }

  function clearWeatherElements() {
    gameState.weatherElements.forEach(item => item.element.remove());
    gameState.weatherElements = [];
  }

  function updateWeather(timestamp, timeScale) {
    gameState.weatherElements.forEach(item => {
      item.y += item.speed * timeScale;
      
      let xOffset = 0;
      if (item.type === 'snow') {
        xOffset = Math.sin(timestamp * 0.002 + item.sinOffset) * 20;
      }
      
      if (item.y > gameState.gameHeight) {
        item.y = -20;
        item.x = Math.random() * gameState.gameWidth;
      }
      
      item.element.style.transform = `translate(${xOffset}px, ${item.y}px)`;
      item.element.style.left = `${item.x}px`;
    });

    // Thunder logic
    if (gameState.weather === 'thunder' && Math.random() < 0.005) {
      triggerThunder();
    }
  }

  function triggerThunder() {
    elements.thunderFlash.style.opacity = '0.8';
    // Deep rumble
    playOscillator(60, 'sawtooth', 0.8, 0.4, 30, 0.8);
    // Sharp crack
    playThunderCrack();
    
    setTimeout(() => elements.thunderFlash.style.opacity = '0', 50);
    setTimeout(() => {
      elements.thunderFlash.style.opacity = '0.4';
      setTimeout(() => elements.thunderFlash.style.opacity = '0', 30);
    }, 100);
  }

  function playThunderCrack() {
    if (!audioCtx) return;
    try {
      const bufferSize = audioCtx.sampleRate * 0.1;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      noise.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch(e) {}
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
    
    // MUCH more forgiving: only trigger if the center of the note clearly overlaps
    // This allows the "empty" space of the note SVG to graze the pipe without losing
    const shrinkX = 18; // Very narrow horizontal hitbox
    const shrinkY = 14;  // Low vertical hitbox
    const noteHitbox = {
      left: noteRect.left + shrinkX,
      right: noteRect.right - shrinkX,
      top: noteRect.top + shrinkY,
      bottom: noteRect.bottom - shrinkY
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

    // Boss 1 Collision
    if (gameState.bossWall) {
      const wallX = gameState.bossWall.x;
      const wallW = 70;
      const gapY = gameState.bossWall.gapY;
      const left = gameState.gameWidth * 0.2 + 8; // More precise hitboxes
      const right = left + 40 - 16;
      const top = gameState.noteY + 6;
      const bottom = top + 40 - 12;

      if (right > wallX && left < wallX + wallW) {
        if (top < gapY - 155/2 || bottom > gapY + 155/2) {
          triggerGameOver();
          return;
        }
      }
    }

    // Boss 2 Collision
    if (gameState.bossGhost && gameState.ghostBuffer.length >= 120) {
      const ghostX = gameState.bossGhost.lastX;
      const ghostY = gameState.bossGhost.lastY;
      const noteX = gameState.gameWidth * 0.2;
      
      const shrink = 10; // More forgiving ghost hitbox
      const r1 = { left: noteX + shrink, right: noteX + 40 - shrink, top: gameState.noteY + shrink, bottom: gameState.noteY + 40 - shrink };
      const r2 = { left: ghostX + shrink, right: ghostX + 40 - shrink, top: ghostY + shrink, bottom: ghostY + 40 - shrink };
      
      if (!(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom)) {
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
    
    // Fade out background music
    fadeOutMusic();

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
