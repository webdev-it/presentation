(function(){
  'use strict';

  const slidesEl = document.getElementById('slides');
  const slideNodes = /** @type {HTMLElement[]} */ (Array.from(slidesEl.querySelectorAll('.slide')));
  const total = slideNodes.length; // 7

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnPlay = document.getElementById('btnPlay');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const counter = document.getElementById('counter');
  const dots = document.getElementById('dots');
  const progressBar = document.getElementById('progressBar');
  const presentation = document.getElementById('presentation');

  let index = 0;
  let autoplay = false;
  let autoplayTimer = null;
  let progressTimer = null;
  const AUTOPLAY_INTERVAL = 5000; // мс между слайдами
  let wasAutoplayBeforeVideo = false;
  const VIDEO_SLIDE_INDEX = 4; // нумерация с 0, это 5-й слайд
  const videoEl = document.getElementById('videoSlide5');

  // Инициализируем точки
  for(let i=0;i<total;i++){
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role','tab');
    b.setAttribute('aria-controls', 'slides');
    b.setAttribute('title', `Слайд ${i+1}`);
    b.addEventListener('click', ()=> goTo(i));
    dots.appendChild(b);
  }

  function updateUI(){
    // Активность слайдов
    slideNodes.forEach((el, i)=>{
      const active = i === index;
      el.classList.toggle('active', active);
      el.setAttribute('aria-hidden', String(!active));
    });

    // Точки
    const dotButtons = Array.from(dots.querySelectorAll('button'));
    dotButtons.forEach((b,i)=>{
      b.setAttribute('aria-selected', String(i===index));
    });

    // Счётчик
    counter.textContent = `${index+1} / ${total}`;

    // Особая логика для слайда с видео
    handleVideoSlideActivation();

    // Прогресс для автопрокрутки (не показываем, если активен видеослайд)
    if(!autoplay || index === VIDEO_SLIDE_INDEX){
      progressBar.style.width = '0%';
      if(progressTimer){ clearInterval(progressTimer); progressTimer = null; }
    }
  }

  function goTo(i){
    index = (i + total) % total;
    updateUI();
    if(autoplay){
      restartAutoplayProgress();
    }
  }

  function next(){ goTo(index + 1); }
  function prev(){ goTo(index - 1); }

  // Полноэкранный режим
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
      }else{
        await presentation.requestFullscreen();
      }
    }catch(e){
      console.warn('Fullscreen error:', e);
    }
  }

  // Автопрокрутка
  function startAutoplay(){
    autoplay = true;
    btnPlay.textContent = '⏸';
    if(autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = setInterval(next, AUTOPLAY_INTERVAL);
    restartAutoplayProgress();
  }
  function stopAutoplay(){
    autoplay = false;
    btnPlay.textContent = '▶';
    if(autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
    progressBar.style.width = '0%';
    if(progressTimer){ clearInterval(progressTimer); progressTimer = null; }
  }
  function toggleAutoplay(){ autoplay ? stopAutoplay() : startAutoplay(); }

  function restartAutoplayProgress(){
    if(index === VIDEO_SLIDE_INDEX) return; // не идёт прогресс на видеослайде
    if(progressTimer){ clearInterval(progressTimer); }
    const start = Date.now();
    progressTimer = setInterval(()=>{
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / AUTOPLAY_INTERVAL) * 100);
      progressBar.style.width = p + '%';
      if(p >= 100){
        clearInterval(progressTimer);
        progressTimer = null;
      }
    }, 100);
  }

  // ВИДЕО НА СЛАЙДЕ 5
  function handleVideoSlideActivation(){
    if(!videoEl) return;
    if(index === VIDEO_SLIDE_INDEX){
      // Зафиксировать состояние автоплей, остановить автолистывание, спрятать прогресс
      wasAutoplayBeforeVideo = autoplay;
      if(autoplay){ stopAutoplay(); }
      progressBar.style.width = '0%';

      // Автовоспроизведение: согласно политикам, видео уже помечено muted playsinline
      // Попробуем запустить, при ошибке просто оставим управление пользователю
      const tryPlay = async () => {
        try {
          await videoEl.play();
        } catch (e) {
          // Браузер заблокировал автоплей — включим звук по клику или пользователю нужно нажать Play
          console.warn('Autoplay blocked:', e);
        }
      };
      // Перемотать на начало, если повторный заход на слайд
      if(Math.abs(videoEl.currentTime - 0) > 0.05){
        try{ videoEl.currentTime = 0; }catch{}
      }
      tryPlay();
    }else{
      // Выходим с видеослайда — остановить видео и восстановить автоплей при необходимости
      if(!videoEl.paused){
        try{ videoEl.pause(); }catch{}
      }
      if(wasAutoplayBeforeVideo){
        startAutoplay();
        wasAutoplayBeforeVideo = false;
      }
    }
  }

  if(videoEl){
    // Когда видео закончилось — перейти к следующему слайду
    videoEl.addEventListener('ended', ()=>{
      // Принудительный переход вперёд, затем (если нужно) вернётся автоплей
      goTo(index + 1);
    });
  }

  // Свайпы (тач)
  let touchStartX = 0;
  let touchStartY = 0;
  let touching = false;
  const SWIPE_THRESHOLD = 40;
  slidesEl.addEventListener('touchstart', (e)=>{
    if(e.touches.length !== 1) return;
    touching = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, {passive:true});
  slidesEl.addEventListener('touchmove', (e)=>{
    // предотвращаем вертикальную прокрутку при горизонтальном свайпе
    if(!touching) return;
  }, {passive:true});
  slidesEl.addEventListener('touchend', (e)=>{
    if(!touching) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD){
      if(dx < 0) next(); else prev();
    }
    touching = false;
  });

  // Клавиатура
  window.addEventListener('keydown', (e)=>{
    if(e.defaultPrevented) return;
    switch(e.key){
      case 'ArrowRight': next(); break;
      case 'ArrowLeft': prev(); break;
      case ' ': // Space
        // На видеослайде позволяем пробелу управлять самим видео
        if(index !== VIDEO_SLIDE_INDEX){
          e.preventDefault();
          toggleAutoplay();
        }
        break;
      case 'f': case 'F':
        toggleFullscreen();
        break;
      case 'Home': goTo(0); break;
      case 'End': goTo(total-1); break;
    }
  });

  // Клики кнопок
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', next);
  btnPlay.addEventListener('click', toggleAutoplay);
  btnFullscreen.addEventListener('click', toggleFullscreen);

  // Двойной клик по слайду — fullscreen
  slidesEl.addEventListener('dblclick', toggleFullscreen);

  // Инициализация
  updateUI();
})();
