(() => {
  'use strict';
  const data = window.PORTFOLIO;
  const $ = selector => document.querySelector(selector);
  const icon = name => { const el = document.createElement('i'); el.dataset.lucide = name; return el; };
  const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
  const safeMedia = value => {
    if (!value || typeof value !== 'string') return '';
    try { const url = new URL(value, document.baseURI); return ['https:', 'http:', 'file:', 'blob:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const categories = data.categories || [];
  let works = (data.works || []).filter(work => categories.some(category => category.id === work.category));
  const dialog = $('#player-dialog');
  const player = $('#player');
  const notice = $('#notice-dialog');
  let scrollPosition = 0;
  let modalCount = 0;
  const modalFocus = new WeakMap();
  const lockScroll = () => { scrollPosition = window.scrollY; document.body.style.position = 'fixed'; document.body.style.top = `-${scrollPosition}px`; document.body.style.width = '100%'; };
  const unlockScroll = () => { document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = ''; window.scrollTo({ top: scrollPosition, behavior: 'instant' }); };
  function showModal(modal) {
    if (modal.open) return;
    modalFocus.set(modal, document.activeElement);
    if (modalCount++ === 0) lockScroll();
    modal.showModal();
  }
  function registerModal(modal) {
    modal.addEventListener('close', () => {
      if (modal === dialog) { player.pause(); player.removeAttribute('src'); player.load(); }
      modalCount = Math.max(0, modalCount - 1);
      if (!modalCount) unlockScroll();
      const previous = modalFocus.get(modal);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    });
  }
  function showNotice() { showModal(notice); }
  function openWork(work) {
    player.pause();
    $('#player-category').textContent = categories.find(category => category.id === work.category)?.english || '';
    $('#player-title').textContent = work.title;
    $('#player-description').textContent = work.description || work.subtitle || '';
    $('#player-meta').textContent = [work.year, ...(work.tags || []), ...(work.software || [])].filter(Boolean).join(' / ');
    $('#demo-note').textContent = work.demo ? `示例素材，非个人作品。${work.credit || ''}` : work.credit || '';
    $('#demo-note').hidden = !work.demo && !work.credit;
    $('#video-error').hidden = true;
    player.removeAttribute('poster');
    player.style.aspectRatio = work.aspectRatio || '16 / 9';
    dialog.classList.toggle('portrait-player', !!work.portrait);
    if (safeMedia(work.videoPoster)) player.poster = safeMedia(work.videoPoster);
    const src = safeMedia(work.video);
    $('.player-fullscreen').disabled = !src;
    if (src) { player.src = src; player.hidden = false; player.load(); }
    else { player.removeAttribute('src'); player.load(); player.hidden = true; $('#video-error').textContent = '这部作品的视频即将上线。'; $('#video-error').hidden = false; }
    showModal(dialog);
    if (src) player.play().catch(() => { /* Native controls remain available when autoplay is restricted. */ });
  }
  player.addEventListener('error', () => { if (dialog.open && player.hasAttribute('src')) { $('#video-error').textContent = '视频暂时无法播放，请稍后再试。'; $('#video-error').hidden = false; } });
  $('.close-player').addEventListener('click', () => dialog.close());
  $('.player-fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (player.requestFullscreen) await player.requestFullscreen();
      else if (player.webkitEnterFullscreen) player.webkitEnterFullscreen();
    } catch { /* Native video controls also expose fullscreen on supported devices. */ }
  });
  document.querySelectorAll('.close-notice').forEach(button => button.addEventListener('click', () => notice.close()));
  [dialog, notice].forEach(modal => {
    modal.addEventListener('click', event => {
      const box = modal.getBoundingClientRect();
      if (event.target === modal && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) modal.close();
    });
    registerModal(modal);
  });
  document.addEventListener('play', event => {
    if (event.target.tagName === 'VIDEO') document.querySelectorAll('video').forEach(video => { if (video !== event.target) video.pause(); });
  }, true);
  $('#hero-intro').textContent = data.intro;
  $('#about-name').textContent = `你好，我是 ${data.name}`;
  $('#about-bio').textContent = data.bio;
  if (safeMedia(data.portrait)) {
    const image = document.createElement('img'); image.alt = `${data.name} 的个人照片`;
    image.addEventListener('load', () => { $('#portrait').replaceChildren(image); $('#portrait').classList.add('has-photo'); }, { once: true });
    image.src = safeMedia(data.portrait);
  }
  [['剪辑方向', data.focus], ['常用软件', (data.software || []).join(' / ')], ['擅长技能', (data.skills || []).join(' / ')]].forEach(([label, value]) => $('#profile-details').append(text('dt', label), text('dd', value || '待填写')));
  function renderWorks(nextWorks) {
    works = nextWorks.filter(work => categories.some(category => category.id === work.category));
    $('#work-groups').querySelectorAll('.reveal').forEach(el => reveal.unobserve(el));
    $('#category-nav').replaceChildren();
    $('#work-groups').replaceChildren();
    $('#film-strip').replaceChildren();
    const all = text('a', '全部作品'); all.href = '#works'; all.append(text('sup', String(works.length).padStart(2, '0'))); $('#category-nav').append(all);
    categories.forEach((category, index) => {
      const groupWorks = works.filter(work => work.category === category.id);
      const groupId = `category-${index}`;
      const nav = text('a', category.title); nav.href = `#${groupId}`; nav.append(text('sup', String(groupWorks.length).padStart(2, '0'))); $('#category-nav').append(nav);
      const section = document.createElement('section'); section.className = 'work-group'; section.id = groupId; section.setAttribute('aria-labelledby', `${groupId}-title`);
      const heading = document.createElement('div'); heading.className = 'group-heading reveal';
      const titleRow = document.createElement('div'); titleRow.className = 'group-title';
      const title = text('h3', category.title); title.id = `${groupId}-title`; title.append(text('small', category.english));
      titleRow.append(text('span', String(index + 1).padStart(2, '0'), 'group-number'), title);
      heading.append(titleRow, text('p', category.description));
      const grid = document.createElement('div'); grid.className = 'work-grid';
      groupWorks.forEach((work, workIndex) => {
        const card = document.createElement('article'); card.className = 'work-card reveal';
        const cover = document.createElement('button'); cover.className = 'cover-button'; cover.setAttribute('aria-label', `播放 ${work.title}`);
        cover.classList.toggle('portrait-cover', !!work.portrait);
        if (safeMedia(work.cover)) { const img = document.createElement('img'); img.src = safeMedia(work.cover); img.alt = work.title; img.loading = 'lazy'; img.decoding = 'async'; cover.append(img); }
        if (work.demo) cover.append(text('span', '示例作品', 'demo-badge'));
        const play = document.createElement('span'); play.className = 'play-icon'; play.append(icon('play')); cover.append(play, text('span', String(workIndex + 1).padStart(2, '0'), 'cover-index'));
        const caption = document.createElement('span'); caption.className = 'cover-caption'; caption.setAttribute('aria-hidden', 'true');
        caption.append(text('strong', work.title), text('span', '播放作品 / WATCH FILM'));
        cover.append(caption);
        cover.addEventListener('click', () => openWork(work));
        const info = document.createElement('div'); info.className = 'work-info';
        const copy = document.createElement('div'); const h = document.createElement('h4'); h.className = 'work-title'; const titleButton = text('button', work.title); titleButton.addEventListener('click', () => openWork(work)); h.append(titleButton); copy.append(h, text('p', work.subtitle || '', 'work-subtitle'));
        const arrow = document.createElement('button'); arrow.className = 'work-arrow'; arrow.setAttribute('aria-label', `查看 ${work.title}`); arrow.title = '查看作品'; arrow.append(icon('arrow-up-right')); arrow.addEventListener('click', () => openWork(work)); info.append(copy, arrow);
        const tags = document.createElement('div'); tags.className = 'work-tags'; [...new Set([...(work.tags || []), ...(work.software || [])])].forEach(tag => tags.append(text('span', tag)));
        card.append(cover, info, tags); grid.append(card);
      });
      if (!groupWorks.length) grid.append(text('p', '新的故事，即将上线。', 'empty-state'));
      section.append(heading, grid); $('#work-groups').append(section);
    });
    categories.map(category => works.find(work => work.category === category.id)).filter(Boolean).slice(0, 3).forEach((work, index) => {
      const button = document.createElement('button'); button.className = 'film-frame'; button.setAttribute('aria-label', `预览 ${work.title}`);
      button.classList.toggle('portrait-cover', !!work.portrait);
      const image = document.createElement('img'); image.src = safeMedia(work.cover); image.alt = ''; image.decoding = 'async';
      const label = document.createElement('span'); label.className = 'film-caption'; label.append(text('span', `0${index + 1} / ${categories.find(category => category.id === work.category).english}`), icon('play'));
      button.append(image, label); button.addEventListener('click', () => openWork(work)); $('#film-strip').append(button);
    });
    $('#work-groups').querySelectorAll('.reveal').forEach(el => reveal.observe(el));
    window.lucide?.createIcons();
    document.dispatchEvent(new CustomEvent('portfolio:updated'));
  }
  const email = typeof data.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ? data.email.trim() : '';
  const mailto = email ? `mailto:${encodeURIComponent(email)}` : '';
  $('#contact-button').addEventListener('click', () => { if (mailto) window.location.href = mailto; else showNotice(); });
  const menuButton = $('.menu-toggle');
  function closeMenu() { $('#mobile-nav').hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', '打开导航'); }
  menuButton.addEventListener('click', () => { const open = $('#mobile-nav').hidden; $('#mobile-nav').hidden = !open; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航'); });
  $('#mobile-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 640) closeMenu(); });
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); reveal.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  const sections = [...document.querySelectorAll('main>section[id]')];
  let navigationFrame = 0;
  function updateNavigation() {
    navigationFrame = 0;
    const current = sections.filter(section => section.getBoundingClientRect().top <= innerHeight * .35).at(-1) || sections[0];
    document.querySelectorAll('.desktop-nav a').forEach(link => {
      const active = link.hash === `#${current.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', () => { if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation); }, { passive: true });
  window.addEventListener('resize', updateNavigation);
  updateNavigation();
  window.lucide?.createIcons();
  const ready = window.workRepository.load().then(renderWorks).catch(error => {
    renderWorks(works);
    $('#storage-message').textContent = `本地作品库暂时无法读取，当前显示初始作品。${error.message}`;
    $('#storage-message').hidden = false;
  });
  window.portfolioApp = { ready, getWorks: () => works, categories, renderWorks, openWork, showModal, registerModal, safeMedia };
})();
