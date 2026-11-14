(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  const petals = document.querySelector('.hero-petals');
  const star = document.querySelector('.hero-star');
  const starIcon = star.querySelector('svg');
  const status = document.querySelector('#star-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let heroVisible = true;
  let pointerFrame = 0;
  let pointX = 0;
  let pointY = 0;
  let sparkleAnimation = null;
  let sparkleTimer = 0;

  function resetPointer() {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    petals.style.setProperty('--pointer-x', '0px');
    petals.style.setProperty('--pointer-y', '0px');
  }

  // Only pointer events schedule a frame; CSS handles the slow floating motion.
  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reducedMotion.matches || !finePointer.matches || !heroVisible || document.hidden) return;
    const bounds = hero.getBoundingClientRect();
    pointX = ((event.clientX - bounds.left) / bounds.width - .5) * 24;
    pointY = ((event.clientY - bounds.top) / bounds.height - .5) * 18;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
      petals.style.setProperty('--pointer-x', `${pointX.toFixed(2)}px`);
      petals.style.setProperty('--pointer-y', `${pointY.toFixed(2)}px`);
      pointerFrame = 0;
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', resetPointer);

  function settleStar() {
    clearTimeout(sparkleTimer);
    sparkleAnimation?.cancel();
    sparkleAnimation = null;
    star.classList.remove('is-lit');
  }

  star.addEventListener('click', () => {
    settleStar();
    // Restart the small burst even when the star is clicked several times.
    void star.offsetWidth;
    star.classList.add('is-lit');
    status.textContent = status.textContent === '星光已点亮。' ? '灵感再次亮起。' : '星光已点亮。';
    if (!reducedMotion.matches) {
      sparkleAnimation = starIcon.animate([
        { transform: 'rotate(0deg) scale(1)' },
        { transform: 'rotate(32deg) scale(1.25)', offset: .35 },
        { transform: 'rotate(90deg) scale(1)' }
      ], { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    sparkleTimer = setTimeout(settleStar, 900);
  });

  function syncMotion() {
    const paused = document.hidden || !heroVisible || reducedMotion.matches;
    hero.classList.toggle('motion-paused', paused);
    if (paused || !finePointer.matches) resetPointer();
    if (paused) settleStar();
  }
  const visibility = new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    syncMotion();
  });
  visibility.observe(hero);
  document.addEventListener('visibilitychange', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  finePointer.addEventListener('change', syncMotion);
  syncMotion();
})();
