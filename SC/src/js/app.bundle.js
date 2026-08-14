(() => {
  'use strict';

  const title = '死死死死死死死死';
  const eraseDelay = 65;
  const typeDelay = 80;
  const holdDelay = 700;
  const emptyDelay = 160;

  function wait(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  async function animateTitle() {
    while (true) {
      if (document.hidden) {
        await new Promise(resolve => document.addEventListener('visibilitychange', resolve, { once: true }));
        continue;
      }
      document.title = title;
      await wait(holdDelay);

      for (let length = title.length - 1; length >= 0; length -= 1) {
        document.title = title.slice(0, length);
        await wait(eraseDelay);
      }

      await wait(emptyDelay);

      for (let length = 1; length <= title.length; length += 1) {
        document.title = title.slice(0, length);
        await wait(typeDelay);
      }
    }
  }

  animateTitle();
})();

window.SSANNT_MEDIA = {
  introSound: '../public/media/audio/hello.mp4',

  videos: [
    '../public/media/video/background-01.mp4',
    '../public/media/video/background-02.mp4',
    '../public/media/video/background-03.mp4'
  ],

  tracks: [
    {
      src: '../public/media/audio/audio1-track.mp3',
      title: 'XY1NA'
    },
    {
      src: '../public/media/audio/audio2-track.mp3',
      title: 'XY1NA'
    },
    {
      src: '../public/media/audio/audio3-track.mp3',
      title: 'XY1NA'
    }
  ],

  settings: {
    videoOrder: 'random',
    videoCrossfadeMs: 1400,
    audioVolume: 0.55
  }
};

(() => {
  'use strict';

  function readableTitle(source) {
    const filename = source.split('/').pop() || 'Без названия';
    return decodeURIComponent(filename)
      .replace(/\.[^.]+$/, '')
      .replace(/^\d+[\s._-]*/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
  }

  function normalizeTracks(tracks) {
    if (!Array.isArray(tracks)) return [];

    return tracks
      .map((track) => {
        if (typeof track === 'string') {
          return { src: track, title: readableTitle(track) };
        }

        if (track && typeof track.src === 'string') {
          return {
            src: track.src,
            title: track.title || readableTitle(track.src)
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  function initSSANNTMedia(config = {}) {
    const videos = Array.isArray(config.videos)
      ? config.videos.filter((source) => typeof source === 'string' && source.trim())
      : [];
    const tracks = normalizeTracks(config.tracks);
    const settings = config.settings || {};
    const configuredVolume = Number(settings.audioVolume);
    const audioVolume = Number.isFinite(configuredVolume)
      ? Math.max(0, Math.min(1, configuredVolume))
      : 0.55;

    const videoElements = [
      document.getElementById('backgroundVideoA'),
      document.getElementById('backgroundVideoB')
    ];
    const videoLayers = [
      document.getElementById('videoLayerA'),
      document.getElementById('videoLayerB')
    ];
    const audio = document.getElementById('audioPlayer');
    const trackTitle = document.getElementById('trackTitle');

    const crossfade = Number(settings.videoCrossfadeMs) || 1400;
    document.documentElement.style.setProperty('--video-crossfade', `${crossfade}ms`);

    let activeVideo = 0;
    let currentVideoIndex = -1;
    let currentTrackIndex = 0;
    let videoSwitchToken = 0;
    let backgroundStarted = false;
    let wasVideoPlaying = false;

    function chooseNextVideo() {
      if (videos.length <= 1) return 0;

      if (settings.videoOrder === 'sequential') {
        return (currentVideoIndex + 1) % videos.length;
      }

      let nextIndex = currentVideoIndex;
      while (nextIndex === currentVideoIndex) {
        nextIndex = Math.floor(Math.random() * videos.length);
      }
      return nextIndex;
    }

    function playVideoElement(element) {
      const promise = element.play();
      if (promise) promise.catch(() => {});
    }

    function loadVideoSlot(slotIndex, source) {
      const video = videoElements[slotIndex];
      video.src = source;
      video.muted = true;
      video.load();
    }

    function clearVideoSlot(slotIndex) {
      const video = videoElements[slotIndex];
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    function showInitialVideo() {
      if (!videos.length || backgroundStarted) return;

      backgroundStarted = true;
      currentVideoIndex = chooseNextVideo();
      loadVideoSlot(activeVideo, videos[currentVideoIndex]);
      playVideoElement(videoElements[activeVideo]);
    }

    function switchVideo() {
      if (!videos.length) return;

      const token = ++videoSwitchToken;
      const nextIndex = chooseNextVideo();
      const outgoingIndex = activeVideo;
      const incomingIndex = activeVideo === 0 ? 1 : 0;
      const incoming = videoElements[incomingIndex];
      const outgoingLayer = videoLayers[outgoingIndex];
      const incomingLayer = videoLayers[incomingIndex];

      incomingLayer.classList.remove('is-active');
      loadVideoSlot(incomingIndex, videos[nextIndex]);

      const reveal = () => {
        if (token !== videoSwitchToken) return;

        playVideoElement(incoming);
        requestAnimationFrame(() => {
          incomingLayer.classList.add('is-active');
          outgoingLayer.classList.remove('is-active');
        });

        setTimeout(() => clearVideoSlot(outgoingIndex), crossfade + 120);

        activeVideo = incomingIndex;
        currentVideoIndex = nextIndex;
      };

      if (incoming.readyState >= 3) reveal();
      else incoming.addEventListener('canplay', reveal, { once: true });
    }

    videoElements.forEach((video, index) => {
      video.addEventListener('ended', () => {
        if (index === activeVideo) switchVideo();
      });

      video.addEventListener('error', () => {
        console.warn('Не удалось загрузить видео:', video.currentSrc || video.src);
      });
    });

    document.addEventListener('visibilitychange', () => {
      const active = videoElements[activeVideo];
      if (!backgroundStarted || !active) return;

      if (document.hidden) {
        wasVideoPlaying = !active.paused;
        videoElements.forEach((video) => video.pause());
      } else if (wasVideoPlaying) {
        playVideoElement(active);
      }
    });

    function loadTrack(index) {
      if (!tracks.length) return;

      currentTrackIndex = (index + tracks.length) % tracks.length;
      const track = tracks[currentTrackIndex];
      audio.src = track.src;
      trackTitle.textContent = track.title;
      audio.load();

      dispatchEvent(new CustomEvent('ssannt:trackchange', {
        detail: {
          index: currentTrackIndex,
          track: { ...track },
          total: tracks.length
        }
      }));
    }

    function activateAudioUi() {
      document.body.classList.remove('audio-muted');
      audio.muted = false;
    }

    function playTrack(index) {
      if (!tracks.length) return;

      activateAudioUi();
      loadTrack(index);
      audio.muted = false;
      audio.volume = audioVolume;

      const promise = audio.play();
      if (promise) {
        promise.catch((error) => {
          trackTitle.textContent = `${tracks[currentTrackIndex].title} / PLAY ERROR`;
          console.error('Не удалось запустить трек:', tracks[currentTrackIndex].src, error);
        });
      }
    }

    function playNextTrack() {
      playTrack(currentTrackIndex + 1);
    }

    audio.addEventListener('ended', playNextTrack);
    audio.addEventListener('error', () => {
      if (!tracks.length) return;

      const errorNames = {
        1: 'ABORTED',
        2: 'NETWORK ERROR',
        3: 'DECODE ERROR',
        4: 'FORMAT ERROR'
      };
      const errorName = errorNames[audio.error?.code] || 'MEDIA ERROR';
      trackTitle.textContent = `${tracks[currentTrackIndex].title} / ${errorName}`;
      console.error(
        'Не удалось загрузить трек:',
        tracks[currentTrackIndex].src,
        errorName,
        audio.error
      );
    });

    if (tracks.length) {
      audio.volume = audioVolume;
      trackTitle.textContent = tracks[0].title;
    }

    return {
      playTrack,
      nextTrack: playNextTrack,
      startBackground: showInitialVideo,
      getTracks: () => tracks.map((track) => ({ ...track }))
    };
  }

  window.initSSANNTMedia = initSSANNTMedia;
})();

(() => {
  'use strict';

  const TIMING = Object.freeze({
    helloDelay: 160,
    identityDelay: 2160,
    injectLoading: 2000,
    bannedFill: 1600
  });

  function requestFullscreen() {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;

    const request = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if (request) request.catch(() => {});
  }

  function buildExclamationField(container) {
    const cellWidth = innerWidth < 760 ? 30 : 46;
    const cellHeight = innerWidth < 760 ? 40 : 56;
    const columns = Math.ceil(innerWidth / cellWidth) + 2;
    const rows = Math.ceil(innerHeight / cellHeight) + 2;
    const count = Math.min(1000, columns * rows);
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      const mark = document.createElement('span');
      mark.textContent = '?';
      fragment.appendChild(mark);
    }

    container.replaceChildren(fragment);
  }

  function buildBannedField(container) {
    container.replaceChildren();

    const columnWidth = innerWidth < 760 ? 118 : 150;
    const rowHeight = innerHeight < 760 ? 52 : 66;
    const columnCount = Math.max(1, Math.ceil(innerWidth / columnWidth));
    const rowCount = Math.max(1, Math.ceil(innerHeight / rowHeight));
    const words = [];
    const fragment = document.createDocumentFragment();

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const column = document.createElement('div');
      column.className = 'banned-column';

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const word = document.createElement('span');
        word.className = 'banned-word';
        word.textContent = 'BANNED';
        column.appendChild(word);
        words.push(word);
      }

      fragment.appendChild(column);
    }

    container.appendChild(fragment);
    return words;
  }

  function animateProgress(element, duration, onComplete) {
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      element.textContent = `${Math.floor(progress * 100)}%`;

      if (progress < 1) requestAnimationFrame(frame);
      else onComplete();
    }

    requestAnimationFrame(frame);
  }

  function fillBannedScreen(words, duration, onComplete) {
    const startTime = performance.now();
    let visibleCount = 0;

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const targetCount = Math.floor(progress * words.length);

      while (visibleCount < targetCount) {
        words[visibleCount].classList.add('is-visible');
        visibleCount += 1;
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      while (visibleCount < words.length) {
        words[visibleCount].classList.add('is-visible');
        visibleCount += 1;
      }

      onComplete();
    }

    requestAnimationFrame(frame);
  }

  function initSSANNTIntro({ mediaPlayer, config }) {
    const enterButton = document.getElementById('enterSite');
    const injectButton = document.getElementById('injectButton');
    const injectPercent = document.getElementById('injectPercent');
    const exclamationField = document.getElementById('exclamationField');
    const bannedField = document.getElementById('bannedField');
    const helloAudio = document.getElementById('helloAudio');

    let introStarted = false;
    let injectionStarted = false;
    let resizeTimer;

    buildExclamationField(exclamationField);
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => buildExclamationField(exclamationField), 160);
    }, { passive: true });

    if (config.introSound) {
      helloAudio.src = config.introSound;
      helloAudio.preload = 'auto';
      helloAudio.load();
    }

    function beginIntro() {
      if (introStarted) return;
      introStarted = true;
      enterButton.disabled = true;

      document.body.classList.add('entry-accepted');

      helloAudio.pause();
      helloAudio.currentTime = 0;
      helloAudio.muted = false;
      helloAudio.volume = 1;
      const helloPlayback = helloAudio.play();
      requestFullscreen();

      if (helloPlayback) {
        helloPlayback.catch(() => {
          console.warn('Не удалось запустить hello.mp4. Проверьте путь и аудиокодек.');
        });
      }

      setTimeout(() => {
        document.body.classList.add('hello-visible');
      }, TIMING.helloDelay);

      setTimeout(() => {
        document.body.classList.add('identity-visible');
      }, TIMING.identityDelay);
    }

    function beginInjection() {
      if (injectionStarted) return;
      injectionStarted = true;

      injectButton.disabled = true;
      injectButton.classList.add('is-loading');
      document.body.classList.add('inject-loading');

      helloAudio.pause();
      helloAudio.currentTime = 0;

      mediaPlayer.startBackground();
      mediaPlayer.playTrack(0);

      animateProgress(injectPercent, TIMING.injectLoading, () => {
        const words = buildBannedField(bannedField);
        document.body.classList.remove('inject-loading');
        document.body.classList.add('banned-active');

        fillBannedScreen(words, TIMING.bannedFill, () => {
          document.body.classList.add('site-revealed');
          setTimeout(() => {
            exclamationField.replaceChildren();
            bannedField.replaceChildren();
          }, 700);
        });
      });
    }

    enterButton.addEventListener('click', beginIntro);
    injectButton.addEventListener('click', beginInjection);

  }

  window.initSSANNTIntro = initSSANNTIntro;
})();

(() => {
  'use strict';

  const VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec2 u_texel;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_audio;
    uniform float u_motion;
    varying vec2 v_uv;

    float hash(float value) {
      return fract(sin(value * 91.3458) * 47453.5453);
    }

    float alphaAt(vec2 uv, float radius) {
      vec2 offset = u_texel * radius;
      float alpha = 0.0;
      alpha = max(alpha, texture2D(u_texture, uv + vec2(offset.x, 0.0)).a);
      alpha = max(alpha, texture2D(u_texture, uv - vec2(offset.x, 0.0)).a);
      alpha = max(alpha, texture2D(u_texture, uv + vec2(0.0, offset.y)).a);
      alpha = max(alpha, texture2D(u_texture, uv - vec2(0.0, offset.y)).a);
      return alpha;
    }

    void main() {
      vec2 uv = v_uv;
      float timeStep = floor(u_time * 9.0);
      float band = floor(uv.y * 34.0);
      float glitchGate = step(0.955 - u_audio * 0.025, hash(timeStep + band * 17.0));
      float glitchShift = (hash(timeStep * 1.37 + band) - 0.5) * 0.026 * glitchGate * u_motion;
      uv.x += glitchShift;

      float pulse = 0.5 + 0.5 * sin(u_time * 2.2);
      float chromaStrength = (0.0012 + u_audio * 0.004 + glitchGate * 0.0025) * u_motion;
      vec2 chroma = vec2(chromaStrength * (0.7 + pulse * 0.3), 0.0);

      vec4 center = texture2D(u_texture, uv);
      float red = texture2D(u_texture, uv + chroma).r;
      float green = center.g;
      float blue = texture2D(u_texture, uv - chroma).b;
      vec3 color = vec3(red, green, blue);

      color = (color - 0.5) * 1.16 + 0.5;
      color *= 0.98 + u_audio * 0.16;

      float scan = sin((uv.y * 920.0) + u_time * 7.0);
      color *= 0.965 + scan * 0.025 * u_motion;

      float pointerLight = max(0.0, 1.0 - distance(uv, u_pointer) * 1.7);
      color += vec3(0.07, 0.09, 0.13) * pointerLight * (0.45 + u_audio * 0.55);

      float nearAlpha = alphaAt(uv, 2.6);
      float farAlpha = alphaAt(uv, 6.5);
      float outline = max(0.0, nearAlpha - center.a);
      float glow = max(0.0, farAlpha - nearAlpha);

      vec3 coldEdge = vec3(0.55, 0.76, 1.0);
      vec3 redEdge = vec3(0.95, 0.045, 0.075);
      vec3 edgeColor = mix(coldEdge, redEdge, pulse * 0.6 + u_audio * 0.4);

      float finalAlpha = max(center.a, outline * 0.95 + glow * (0.26 + u_audio * 0.34));
      vec3 finalColor = color * center.a;
      finalColor += edgeColor * outline * (0.72 + u_audio * 0.45);
      finalColor += edgeColor * glow * (0.12 + u_audio * 0.2);
      finalColor += vec3(0.9, 0.04, 0.08) * glitchGate * center.a * 0.08;

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Avatar shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram(gl) {
    const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Avatar shader linking failed:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  function initVisualPulse(audio, composition) {
    let smoothedLevel = 0;
    let lastRenderedLevel = -1;

    function getLevel(time) {
      let target = 0;

      if (!audio.paused && !audio.muted) {
        const playbackTime = Number.isFinite(audio.currentTime) ? audio.currentTime : time;
        const primaryPulse = Math.abs(Math.sin(playbackTime * 2.7));
        const secondaryPulse = Math.abs(Math.sin(playbackTime * 5.3 + 0.8));
        target = (0.09 + primaryPulse * 0.14 + secondaryPulse * 0.06)
          * (0.65 + audio.volume * 0.35);
      }

      smoothedLevel += (target - smoothedLevel) * 0.1;
      const visualLevel = Math.max(0, Math.min(1, smoothedLevel));

      if (Math.abs(visualLevel - lastRenderedLevel) >= 0.004) {
        composition.style.setProperty('--audio-level', visualLevel.toFixed(3));
        composition.style.setProperty('--audio-blur', `${(12 + visualLevel * 10).toFixed(1)}px`);
        composition.style.setProperty('--audio-scale', (1 + visualLevel * 0.1).toFixed(3));
        composition.style.setProperty('--audio-opacity', (0.6 + visualLevel * 0.34).toFixed(3));
        composition.style.setProperty('--audio-shadow-scale', (1 + visualLevel * 0.09).toFixed(3));
        lastRenderedLevel = visualLevel;
      }

      return visualLevel;
    }

    return { getLevel };
  }

  function initSSANNTAvatarRenderer({ canvas, image, audio }) {
    const composition = canvas.closest('.avatar-composition');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.warn('WebGL is unavailable; PNG fallback is active.');
      return { active: false };
    }

    const program = createProgram(gl);
    if (!program) return { active: false };

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const textureLocation = gl.getUniformLocation(program, 'u_texture');
    const texelLocation = gl.getUniformLocation(program, 'u_texel');
    const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const audioLocation = gl.getUniformLocation(program, 'u_audio');
    const motionLocation = gl.getUniformLocation(program, 'u_motion');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]),
      gl.STATIC_DRAW
    );

    const texture = gl.createTexture();
    let textureReady = false;
    let frameId = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let canvasRect;
    let lastDrawTime = 0;
    const targetFrameInterval = innerWidth < 820 ? 1000 / 30 : 1000 / 40;
    const audioAnalysis = initVisualPulse(audio, composition);

    function uploadTexture() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      textureReady = true;
      composition.classList.add('webgl-ready');
      resize();
      render(performance.now());
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvasRect = rect;
      const dpr = Math.min(devicePixelRatio || 1, innerWidth < 820 ? 1.1 : 1.35);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    }

    function updatePointer(event) {
      const rect = canvasRect || canvas.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    }

    function draw(now) {
      if (!textureReady) return;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(textureLocation, 0);
      gl.uniform2f(texelLocation, 1 / image.naturalWidth, 1 / image.naturalHeight);
      gl.uniform2f(pointerLocation, pointerX, pointerY);
      gl.uniform1f(timeLocation, now * 0.001);
      gl.uniform1f(audioLocation, audioAnalysis.getLevel(now * 0.001));
      gl.uniform1f(motionLocation, reduceMotion ? 0 : 1);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function render(now) {
      if (now - lastDrawTime >= targetFrameInterval) {
        draw(now);
        lastDrawTime = now;
      }
      if (!reduceMotion && !document.hidden) frameId = requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    addEventListener('pointermove', updatePointer, { passive: true });
    addEventListener('resize', resize, { passive: true });

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      composition.classList.remove('webgl-ready');
    });

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      if (!document.hidden && textureReady && !reduceMotion) {
        frameId = requestAnimationFrame(render);
      }
    });

    if (image.complete && image.naturalWidth) uploadTexture();
    else image.addEventListener('load', uploadTexture, { once: true });

    return { active: true, resize };
  }

  window.initSSANNTAvatarRenderer = initSSANNTAvatarRenderer;
})();

(() => {
  'use strict';

  function initSSANNTEspVisuals() {
    const composition = document.getElementById('avatarComposition');
    let targetAngle = -Math.PI / 2;
    let currentAngle = targetAngle;
    let frameId = 0;
    let centerX = innerWidth / 2;
    let centerY = innerHeight / 2;
    let radiusX = 0;
    let radiusY = 0;

    function measure() {
      const rect = composition.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      radiusX = rect.width * 0.41;
      radiusY = rect.height * 0.43;
    }

    function startAnimation() {
      if (!frameId && !document.hidden) frameId = requestAnimationFrame(animateTracer);
    }

    addEventListener('pointermove', (event) => {
      targetAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      startAnimation();
    }, { passive: true });

    function animateTracer() {
      const delta = Math.atan2(
        Math.sin(targetAngle - currentAngle),
        Math.cos(targetAngle - currentAngle)
      );
      currentAngle += delta * 0.14;

      const x = Math.cos(currentAngle) * radiusX;
      const y = Math.sin(currentAngle) * radiusY;
      const rotation = currentAngle * (180 / Math.PI) + 180;

      composition.style.setProperty('--tracer-x', `${x.toFixed(1)}px`);
      composition.style.setProperty('--tracer-y', `${y.toFixed(1)}px`);
      composition.style.setProperty('--tracer-angle', `${rotation.toFixed(2)}deg`);
      frameId = 0;
      if (Math.abs(delta) > 0.001) startAnimation();
    }

    const resizeObserver = new ResizeObserver(() => {
      measure();
      startAnimation();
    });
    resizeObserver.observe(composition);
    addEventListener('resize', measure, { passive: true });

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      if (!document.hidden) startAnimation();
    });

    measure();
    startAnimation();
  }

  window.initSSANNTEspVisuals = initSSANNTEspVisuals;
})();

(() => {
  'use strict';

  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function initSSANNTPlaylist({ player, audio }) {
    const tracks = player.getTracks();
    const playlist = document.getElementById('playlist');
    const list = document.getElementById('trackList');
    const title = document.getElementById('trackTitle');
    const seek = document.getElementById('trackSeek');
    const currentTime = document.getElementById('trackCurrentTime');
    const duration = document.getElementById('trackDuration');
    const previous = document.getElementById('previousTrack');
    const toggle = document.getElementById('toggleTrack');
    const next = document.getElementById('nextTrack');
    const volume = document.getElementById('trackVolume');
    const mute = document.getElementById('audioToggle');
    const launcher = document.getElementById('playlistLauncher');
    const close = document.getElementById('playlistClose');
    let activeIndex = 0;
    let seeking = false;
    let beatFrame = 0;
    let lastBeatPaint = 0;
    let lastBeat = -1;
    let beatAmplitude = 0.08;
    let beatOffsetX = 0;
    let beatOffsetY = 0;
    let currentBeatScale = 1;
    let currentBeatX = 0;
    let currentBeatY = 0;

    function animateLauncherBeat() {
      beatFrame = 0;
      let targetScale = 1;
      let targetX = 0;
      let targetY = 0;

      if (!audio.paused && !audio.muted && audio.volume > 0) {
        const beatPosition = audio.currentTime * 3.35;
        const beatIndex = Math.floor(beatPosition);
        const phase = beatPosition - beatIndex;

        if (beatIndex !== lastBeat) {
          lastBeat = beatIndex;
          beatAmplitude = 0.065 + Math.random() * 0.095;
          beatOffsetX = (Math.random() - 0.5) * 3.2;
          beatOffsetY = (Math.random() - 0.5) * 3.2;
        }

        const envelope = Math.exp(-phase * 8.5);
        targetScale = 1 + beatAmplitude * envelope;
        targetX = beatOffsetX * envelope;
        targetY = beatOffsetY * envelope;
      }

      currentBeatScale += (targetScale - currentBeatScale) * 0.48;
      currentBeatX += (targetX - currentBeatX) * 0.4;
      currentBeatY += (targetY - currentBeatY) * 0.4;

      const now = performance.now();
      if (now - lastBeatPaint >= 1000 / 30) {
        launcher.style.setProperty('--beat-scale', currentBeatScale.toFixed(4));
        launcher.style.setProperty('--beat-x', `${currentBeatX.toFixed(2)}px`);
        launcher.style.setProperty('--beat-y', `${currentBeatY.toFixed(2)}px`);
        lastBeatPaint = now;
      }

      const isSettled = audio.paused
        && Math.abs(currentBeatScale - 1) < 0.0005
        && Math.abs(currentBeatX) < 0.02
        && Math.abs(currentBeatY) < 0.02;
      if (!isSettled && !document.hidden) beatFrame = requestAnimationFrame(animateLauncherBeat);
    }

    function startLauncherBeat() {
      if (!reduceMotion && !beatFrame && !document.hidden) {
        beatFrame = requestAnimationFrame(animateLauncherBeat);
      }
    }

    function openPlayer() {
      playlist.classList.add('is-open');
      playlist.setAttribute('aria-hidden', 'false');
      launcher.setAttribute('aria-expanded', 'true');
    }

    function closePlayer() {
      playlist.classList.remove('is-open');
      playlist.setAttribute('aria-hidden', 'true');
      launcher.setAttribute('aria-expanded', 'false');
    }

    function bindTrackList() {
      const items = list.querySelectorAll('.playlist-track');

      items.forEach((item) => {
        const button = item.querySelector('[data-track-index]');
        const index = Number(button?.dataset.trackIndex);
        const track = tracks[index];
        if (!button || !track) return;

        const trackTitle = item.querySelector('.playlist-track__title');
        if (trackTitle) trackTitle.textContent = track.title;
        button.setAttribute('aria-label', `Включить ${track.title}`);
        button.addEventListener('click', () => player.playTrack(index));
      });
    }

    function updateActiveTrack(index, track = tracks[index]) {
      activeIndex = index;
      title.textContent = track?.title || 'XY1NA';

      list.querySelectorAll('.playlist-track').forEach((item, itemIndex) => {
        const active = itemIndex === index;
        item.classList.toggle('is-active', active);
        const state = item.querySelector('.playlist-track__state');
        if (state) state.textContent = active ? 'ИГРАЕТ' : 'ГОТОВ';
      });
    }

    function updateTimeline() {
      currentTime.textContent = formatTime(audio.currentTime);
      duration.textContent = formatTime(audio.duration);

      const progress = Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.currentTime / audio.duration) * 100
        : 0;

      if (!seeking) seek.value = String(progress);
      seek.style.setProperty('--range-progress', `${progress.toFixed(2)}%`);
    }

    function updatePlaybackState() {
      const paused = audio.paused;
      toggle.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');
      document.body.classList.toggle('audio-paused', paused);
    }

    function updateMuteState() {
      const muted = audio.muted || audio.volume === 0;
      mute.classList.toggle('is-muted', muted);
      mute.setAttribute('aria-pressed', String(muted));
      mute.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
      document.body.classList.toggle('audio-muted', muted);
    }

    addEventListener('ssannt:trackchange', (event) => {
      updateActiveTrack(event.detail.index, event.detail.track);
      seek.value = '0';
      currentTime.textContent = '0:00';
    });

    audio.addEventListener('timeupdate', updateTimeline);
    audio.addEventListener('durationchange', updateTimeline);
    audio.addEventListener('loadedmetadata', updateTimeline);
    audio.addEventListener('play', () => {
      updatePlaybackState();
      startLauncherBeat();
    });
    audio.addEventListener('playing', () => {
      updatePlaybackState();
      startLauncherBeat();
    });
    audio.addEventListener('pause', () => {
      updatePlaybackState();
      startLauncherBeat();
    });
    audio.addEventListener('volumechange', updateMuteState);

    previous.addEventListener('click', () => {
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }

      player.playTrack((activeIndex - 1 + tracks.length) % tracks.length);
    });

    next.addEventListener('click', () => player.nextTrack());

    toggle.addEventListener('click', () => {
      if (!audio.getAttribute('src')) {
        player.playTrack(activeIndex);
        return;
      }

      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });

    seek.addEventListener('pointerdown', () => {
      seeking = true;
    });

    seek.addEventListener('input', () => {
      seek.style.setProperty('--range-progress', `${Number(seek.value).toFixed(2)}%`);
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const target = (Number(seek.value) / 100) * audio.duration;
      currentTime.textContent = formatTime(target);
    });

    seek.addEventListener('change', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(seek.value) / 100) * audio.duration;
      }
      seeking = false;
    });

    volume.addEventListener('input', () => {
      audio.volume = Number(volume.value);
      volume.style.setProperty('--range-progress', `${(audio.volume * 100).toFixed(0)}%`);
      if (audio.volume > 0) audio.muted = false;
    });

    mute.addEventListener('click', () => {
      audio.muted = !audio.muted;
      updateMuteState();
    });

    launcher.addEventListener('click', () => {
      if (playlist.classList.contains('is-open')) closePlayer();
      else openPlayer();
    });

    close.addEventListener('click', closePlayer);

    addEventListener('pointerdown', (event) => {
      if (!playlist.classList.contains('is-open')) return;
      if (playlist.contains(event.target) || launcher.contains(event.target)) return;
      if (event.target.closest('#playlistLayoutEditor')) return;
      closePlayer();
    });

    addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePlayer();
    });

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(beatFrame);
      beatFrame = 0;
      if (!document.hidden && !reduceMotion) {
        startLauncherBeat();
      }
    });

    volume.value = String(audio.volume);
    volume.style.setProperty('--range-progress', `${(audio.volume * 100).toFixed(0)}%`);
    bindTrackList();
    updateActiveTrack(0);
    updateTimeline();
    updatePlaybackState();
    updateMuteState();

  }

  window.initSSANNTPlaylist = initSSANNTPlaylist;
})();

(() => {
  'use strict';

  function initSSANNTKillfeed() {
    const killfeed = document.getElementById('killfeed');
    const trigger = document.getElementById('killfeedTrigger');
    const drawer = document.getElementById('killfeedDrawer');

    function open() {
      killfeed.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function close() {
      killfeed.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    }

    function toggle() {
      if (killfeed.classList.contains('is-open')) close();
      else open();
    }

    trigger.addEventListener('click', toggle);

    addEventListener('pointerdown', (event) => {
      if (!killfeed.classList.contains('is-open')) return;
      if (killfeed.contains(event.target)) return;
      close();
    });

    addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

  }

  window.initSSANNTKillfeed = initSSANNTKillfeed;
})();

(() => {
  'use strict';
  function initSSANNTPotion() {
    const potion=document.getElementById('potion');
    const trigger=document.getElementById('potionTrigger');
    const drawer=document.getElementById('potionDrawer');
    const open=()=>{potion.classList.add('is-open');trigger.setAttribute('aria-expanded','true');drawer.setAttribute('aria-hidden','false')};
    const close=()=>{potion.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');drawer.setAttribute('aria-hidden','true')};
    const toggle=()=>potion.classList.contains('is-open')?close():open();
    trigger.addEventListener('click',toggle);
    addEventListener('pointerdown',event=>{if(!potion.classList.contains('is-open'))return;if(potion.contains(event.target))return;close()});
    addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    
  }
  window.initSSANNTPotion=initSSANNTPotion;
})();

(() => {
  'use strict';

  function initSSANNTBinds() {
    const block = document.getElementById('binds');
    const trigger = document.getElementById('bindsTrigger');
    const drawer = document.getElementById('bindsDrawer');

    const open = () => {
      block.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
    };

    const close = () => {
      block.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    };

    const toggle = () => block.classList.contains('is-open') ? close() : open();

    trigger.addEventListener('click', toggle);
    addEventListener('pointerdown', event => {
      if (!block.classList.contains('is-open')) return;
      if (block.contains(event.target)) return;
      close();
    });
    addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });

  }

  window.initSSANNTBinds = initSSANNTBinds;
})();

(() => {
  'use strict';

  function initSSANNTLowerHud() {
    const coordsValue = document.getElementById('coordsValue');
    const pingValue = document.getElementById('pingValue');
    const bpsValue = document.getElementById('bpsValue');
    let lastX = innerWidth / 2;
    let lastY = innerHeight / 2;
    let lastTime = performance.now();
    let lastMoveTime = lastTime;
    let velocity = 0;
    let frameId = 0;
    let pingTimer;
    let lastBpsPaint = 0;

    function updateCoordinates(x, y) {
      const normalizedX = clamp(x / Math.max(1, innerWidth), 0, 1);
      const normalizedY = clamp(y / Math.max(1, innerHeight), 0, 1);
      const worldX = Math.round((normalizedX * 2 - 1) * 999);
      const worldY = Math.round(64 + (1 - normalizedY) * 128);
      const worldZ = Math.round((normalizedY * 2 - 1) * 999);
      coordsValue.textContent = `${worldX} ${worldY} ${worldZ}`;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    addEventListener('pointermove', (event) => {
      const now = performance.now();
      const elapsed = Math.max(8, now - lastTime);
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      const instantVelocity = (distance / elapsed) * 1000;
      velocity = velocity * 0.68 + instantVelocity * 0.32;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;
      lastMoveTime = now;
      updateCoordinates(event.clientX, event.clientY);
      if (!frameId && !document.hidden) frameId = requestAnimationFrame(updateBps);
    }, { passive: true });

    function updateBps(now) {
      frameId = 0;
      const idle = now - lastMoveTime;
      if (idle > 45) velocity *= Math.pow(0.88, Math.min(3, idle / 100));
      if (velocity < 0.5) velocity = 0;
      if (now - lastBpsPaint >= 50 || velocity === 0) {
        const mapped = 1 + 998 * (1 - Math.exp(-velocity / 900));
        const nextValue = String(clamp(Math.round(mapped), 1, 999));
        if (bpsValue.textContent !== nextValue) bpsValue.textContent = nextValue;
        lastBpsPaint = now;
      }
      if (velocity > 0 && !document.hidden) frameId = requestAnimationFrame(updateBps);
    }

    function schedulePing() {
      pingValue.textContent = Math.random() < 0.52 ? '-1' : '0';
      const nextDelay = 850 + Math.random() * 2600;
      pingTimer = setTimeout(schedulePing, nextDelay);
    }

    updateCoordinates(lastX, lastY);
    schedulePing();
    frameId = requestAnimationFrame(updateBps);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        clearTimeout(pingTimer);
      } else {
        lastMoveTime = performance.now();
        if (velocity > 0) frameId = requestAnimationFrame(updateBps);
        schedulePing();
      }
    });

  }

  window.initSSANNTLowerHud = initSSANNTLowerHud;
})();

(() => {
  'use strict';
  function initSSANNTInfoWidget(){
    const widget=document.getElementById('infoWidget'),trigger=document.getElementById('infoTrigger'),drawer=document.getElementById('infoDrawer');
    const open=()=>{widget.classList.add('is-open');trigger.setAttribute('aria-expanded','true');drawer.setAttribute('aria-hidden','false')};
    const close=()=>{widget.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');drawer.setAttribute('aria-hidden','true')};
    const toggle=()=>widget.classList.contains('is-open')?close():open();
    trigger.addEventListener('click',toggle);
    addEventListener('pointerdown',event=>{if(!widget.classList.contains('is-open'))return;if(widget.contains(event.target))return;if(event.target.closest('#infoEditor'))return;close()});
    addEventListener('keydown',event=>{if(event.key==='Escape')close()});

  }
  window.initSSANNTInfoWidget=initSSANNTInfoWidget;
})();

(() => {
  'use strict';

  function safeInit(name, initializer) {
    try {
      return initializer();
    } catch (error) {
      console.error(`${name} initialization failed:`, error);
      return null;
    }
  }

  const audio = document.getElementById('audioPlayer');
  const player = window.initSSANNTMedia(window.SSANNT_MEDIA);

  window.initSSANNTIntro({
    mediaPlayer: player,
    config: window.SSANNT_MEDIA
  });

  safeInit('Playlist', () => window.initSSANNTPlaylist({ player, audio }));
  safeInit('Killfeed', () => window.initSSANNTKillfeed());
  safeInit('Potion', () => window.initSSANNTPotion());
  safeInit('Binds', () => window.initSSANNTBinds());
  safeInit('Lower HUD', () => window.initSSANNTLowerHud());
  safeInit('Info widget', () => window.initSSANNTInfoWidget());
  safeInit('ESP visuals', () => window.initSSANNTEspVisuals());
  safeInit('Avatar renderer', () => window.initSSANNTAvatarRenderer({
    canvas: document.getElementById('avatarShader'),
    image: document.getElementById('avatarTexture'),
    audio
  }));

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let parallaxFrame = 0;

  function startParallax() {
    if (!parallaxFrame && !document.hidden) {
      parallaxFrame = requestAnimationFrame(updateAvatarParallax);
    }
  }

  addEventListener('pointermove', event => {
    targetX = event.clientX / innerWidth - 0.5;
    targetY = event.clientY / innerHeight - 0.5;
    startParallax();
  }, { passive: true });

  function updateAvatarParallax() {
    parallaxFrame = 0;
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    document.documentElement.style.setProperty('--avatar-x', `${(currentX * 12).toFixed(2)}px`);
    document.documentElement.style.setProperty('--avatar-y', `${(currentY * 7).toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.0005 || Math.abs(targetY - currentY) > 0.0005) {
      startParallax();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(parallaxFrame);
      parallaxFrame = 0;
    } else {
      startParallax();
    }
  });
})();

