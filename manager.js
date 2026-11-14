(() => {
  'use strict';
  const app = window.portfolioApp;
  const repository = window.workRepository;
  const $ = selector => document.querySelector(selector);
  const manager = $('#manager-dialog');
  const confirmDialog = $('#confirm-dialog');
  const form = $('#work-form');
  const preview = $('#editor-video');
  let editing = null;
  let video = null;
  let cover = null;
  let dirty = false;
  let busy = false;
  let videoPending = false;
  let coverPending = false;
  let videoSequence = 0;
  let coverSequence = 0;
  let confirmResolve = null;
  let cancelVideoWait = null;
  const temporaryUrls = new Set();
  const option = (value, label) => { const el = document.createElement('option'); el.value = value; el.textContent = label; return el; };
  const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
  const iconButton = (name, label, action) => {
    const button = element('button', 'icon-button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
    const icon = document.createElement('i'); icon.dataset.lucide = name; button.append(icon); button.addEventListener('click', action); return button;
  };
  const message = (text, error = false) => { $('#manager-message').textContent = text; $('#manager-message').hidden = !text; $('#manager-message').classList.toggle('is-error', error); };
  const formError = text => { $('#work-error').textContent = text; $('#work-error').hidden = !text; };
  const friendlyError = error => error.name === 'QuotaExceededError' ? '本地空间不足，保存未完成。请释放空间后重试。' : error.message || '操作失败，请重试。';
  const formatDuration = seconds => { const total = Math.round(seconds); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
  const tempURL = file => { const url = URL.createObjectURL(file); temporaryUrls.add(url); return url; };
  const setDirty = value => { dirty = value; $('#save-state').textContent = value ? '有未保存的修改' : editing ? '已保存到作品库' : '尚未保存'; };
  const updateSave = () => { $('#work-save').disabled = busy || videoPending || coverPending; $('#capture-cover').disabled = busy || videoPending || preview.readyState < 2; };

  app.registerModal(manager);
  app.registerModal(confirmDialog);
  const confirmation = (title, body, accept = '确认') => new Promise(resolve => {
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    $('#confirm-accept').textContent = accept;
    confirmResolve = resolve;
    app.showModal(confirmDialog);
    $('#confirm-cancel').focus();
  });
  $('#confirm-cancel').addEventListener('click', () => confirmDialog.close('cancel'));
  $('#confirm-accept').addEventListener('click', () => confirmDialog.close('accept'));
  confirmDialog.addEventListener('close', () => { confirmResolve?.(confirmDialog.returnValue === 'accept'); confirmResolve = null; });
  confirmDialog.addEventListener('cancel', event => { event.preventDefault(); confirmDialog.close('cancel'); });
  async function allowDiscard() { return !dirty || await confirmation('放弃未保存的修改？', '尚未保存的内容将被放弃。', '放弃修改'); }
  async function closeManager() {
    if (busy || !await allowDiscard()) return;
    manager.close();
  }
  manager.addEventListener('cancel', event => { event.preventDefault(); closeManager(); });
  $('#manager-close').addEventListener('click', closeManager);
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
  function releasePreview() {
    videoSequence++; coverSequence++;
    cancelVideoWait?.();
    videoPending = false; coverPending = false;
    preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
    $('#editor-cover').replaceChildren();
    for (const url of temporaryUrls) URL.revokeObjectURL(url);
    temporaryUrls.clear();
  }
  manager.addEventListener('close', () => { releasePreview(); setDirty(false); });

  function populateSources() {
    $('#existing-video').replaceChildren(option('', '或选择已有视频'));
    $('#existing-cover').replaceChildren(option('', '或选择已有封面'));
    for (const work of app.getWorks()) {
      if (work.video) $('#existing-video').append(option(work.id, work.title));
      if (work.cover) $('#existing-cover').append(option(work.id, work.title));
    }
  }
  function renderList() {
    const query = $('#library-search').value.trim().toLocaleLowerCase();
    const category = $('#library-category').value;
    const works = app.getWorks().filter(work => (!category || work.category === category) && `${work.title} ${work.description} ${(work.software || []).join(' ')}`.toLocaleLowerCase().includes(query));
    $('#library-count').textContent = `${works.length} 部作品 / 共 ${app.getWorks().length} 部`;
    const list = $('#library-list'); list.replaceChildren();
    for (const work of works) {
      const row = element('article', `library-row${editing?.id === work.id ? ' selected' : ''}`);
      const edit = element('button', 'library-select'); edit.type = 'button'; edit.setAttribute('aria-label', `编辑 ${work.title}`);
      const image = document.createElement('img'); image.src = app.safeMedia(work.cover); image.alt = ''; image.loading = 'lazy';
      const copy = element('span', 'library-row-copy');
      copy.append(element('strong', '', work.title), element('small', '', app.categories.find(item => item.id === work.category)?.title || ''));
      edit.append(image, copy); edit.addEventListener('click', async () => { if (!busy && await allowDiscard()) startEditor(work); });
      const actions = element('div', 'library-row-actions');
      actions.append(iconButton('play', `播放 ${work.title}`, () => { preview.pause(); app.openWork(work); }), iconButton('trash-2', `删除 ${work.title}`, () => deleteWork(work)));
      row.append(edit, actions); list.append(row);
    }
    if (!works.length) list.append(element('p', 'library-empty', query || category ? '没有匹配的作品。' : '还没有作品。'));
    window.lucide?.createIcons();
  }
  function mediaReference(work, kind) {
    return { url: work[kind], assetId: work[`${kind}AssetId`] || null, name: work[`${kind}Name`] || work[kind]?.split('/').at(-1) || work.title, file: null };
  }
  function displayCover() {
    $('#editor-cover').replaceChildren();
    $('#cover-filename').textContent = cover?.name || '未选择封面';
    if (cover) { const image = document.createElement('img'); image.src = cover.url; image.alt = '作品封面预览'; $('#editor-cover').append(image); }
  }
  function displayVideo() {
    preview.pause();
    if (video) { preview.src = video.url; preview.hidden = false; }
    else { preview.removeAttribute('src'); preview.hidden = true; }
    preview.load();
    $('#video-filename').textContent = video?.name || '未选择视频';
    $('#video-message').textContent = '';
    updateSave();
  }
  async function startEditor(work = null) {
    releasePreview(); form.reset(); formError('');
    editing = work ? { ...work } : null;
    video = work?.video ? mediaReference(work, 'video') : null;
    if (video) Object.assign(video, { aspectRatio: work.aspectRatio, portrait: work.portrait, duration: work.duration });
    cover = work?.cover ? mediaReference(work, 'cover') : null;
    populateSources();
    $('#editor-title').textContent = work ? '编辑作品' : '新增作品';
    $('#work-title').value = work?.title || '';
    $('#work-category').value = work?.category || $('#library-category').value || app.categories[0]?.id || '';
    $('#work-description').value = work?.description || '';
    $('#work-software').value = (work?.software || []).join('、');
    form.hidden = false; $('#editor-empty').hidden = true;
    displayVideo(); displayCover(); setDirty(false); renderList();
    $('.editor-panel').scrollTop = 0;
    $('#work-title').focus({ preventScroll: true });
    if (innerWidth <= 760) $('#editor-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  document.querySelectorAll('.add-work').forEach(button => button.addEventListener('click', async () => { if (!busy && await allowDiscard()) startEditor(); }));
  $('#editor-reset').addEventListener('click', async () => { if (!busy && await allowDiscard()) startEditor(editing); });
  $('#library-search').addEventListener('input', renderList);
  $('#library-category').addEventListener('change', renderList);
  for (const category of app.categories) {
    $('#library-category').append(option(category.id, category.title));
    $('#work-category').append(option(category.id, category.title));
  }
  document.querySelector('.manage-open').addEventListener('click', async () => {
    await app.ready;
    message(''); populateSources(); renderList();
    form.hidden = true; $('#editor-empty').hidden = false; editing = null; setDirty(false);
    app.showModal(manager);
    $('#library-search').focus();
  });
  form.addEventListener('input', () => setDirty(true));
  form.addEventListener('change', () => setDirty(true));

  preview.addEventListener('loadeddata', updateSave);
  preview.addEventListener('loadedmetadata', () => {
    if (!video) return;
    video.aspectRatio = `${preview.videoWidth} / ${preview.videoHeight}`;
    video.portrait = preview.videoHeight > preview.videoWidth;
    video.duration = preview.duration;
    $('#video-message').textContent = `${preview.videoWidth} × ${preview.videoHeight} · ${formatDuration(preview.duration)}`;
    updateSave();
  });
  preview.addEventListener('error', () => { if (preview.hasAttribute('src')) $('#video-message').textContent = '此视频无法在当前浏览器播放，请使用 H.264/AAC MP4 或 WebM。'; updateSave(); });
  function waitForVideo() {
    cancelVideoWait?.();
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); preview.removeEventListener('loadeddata', loaded); preview.removeEventListener('error', failed); cancelVideoWait = null; };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('视频无法解码，请选择可播放的 MP4、WebM 或 Ogg 视频。')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('视频读取超时，请重新选择文件。')); }, 20000);
      cancelVideoWait = () => { cleanup(); reject(new Error('已取消读取')); };
      preview.addEventListener('loadeddata', loaded); preview.addEventListener('error', failed);
    });
  }
  async function chooseVideo(file, reference = null) {
    const sequence = ++videoSequence;
    videoPending = true; updateSave(); formError('');
    try {
      if (file && (!file.size || !/\.(mp4|m4v|webm|ogv|ogg|mov)$/i.test(file.name))) throw new Error('请选择 MP4、M4V、WebM、Ogg 或 MOV 视频。');
      video = file ? { url: tempURL(file), file, name: file.name, assetId: null } : reference;
      const loaded = waitForVideo(); displayVideo();
      await loaded;
      if (sequence !== videoSequence) return;
      if (!Number.isFinite(preview.duration) || !preview.videoWidth) throw new Error('无法读取视频信息，请选择其他文件。');
      if (!cover) await captureCover().catch(error => { if (sequence === videoSequence) formError(error.message); });
      setDirty(true);
    } catch (error) {
      if (sequence === videoSequence) {
        video = null; preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
        $('#video-filename').textContent = '未选择视频'; formError(error.message);
      }
    } finally { if (sequence === videoSequence) { videoPending = false; updateSave(); } }
  }
  $('#video-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) { $('#existing-video').value = ''; chooseVideo(file); } });
  $('#existing-video').addEventListener('change', event => {
    const work = app.getWorks().find(item => item.id === event.target.value);
    if (work) { $('#video-file').value = ''; chooseVideo(null, mediaReference(work, 'video')); }
  });
  async function chooseCover(file, reference = null) {
    const sequence = ++coverSequence;
    coverPending = true; updateSave(); formError('');
    try {
      if (file && (!file.size || !/\.(jpe?g|png|webp)$/i.test(file.name))) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
      const next = file ? { url: tempURL(file), file, name: file.name, assetId: null } : reference;
      await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error('封面图片无法读取')); image.src = next.url; });
      if (sequence !== coverSequence) return;
      cover = next; displayCover(); setDirty(true);
    } catch (error) { if (sequence === coverSequence) formError(error.message); }
    finally { if (sequence === coverSequence) { coverPending = false; updateSave(); } }
  }
  $('#cover-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) { $('#existing-cover').value = ''; chooseCover(file); } });
  $('#existing-cover').addEventListener('change', event => {
    const work = app.getWorks().find(item => item.id === event.target.value);
    if (work) { $('#cover-file').value = ''; chooseCover(null, mediaReference(work, 'cover')); }
  });
  async function captureCover() {
    if (preview.readyState < 2) throw new Error('请先选择并加载视频');
    const sequence = ++coverSequence;
    coverPending = true; updateSave();
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(preview.videoWidth, preview.videoHeight));
      canvas.width = Math.round(preview.videoWidth * scale); canvas.height = Math.round(preview.videoHeight * scale);
      canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
      if (!blob) throw new Error('截取封面失败，请选择图片文件');
      if (sequence !== coverSequence) return;
      const file = new File([blob], 'video-cover.jpg', { type: 'image/jpeg' });
      cover = { url: tempURL(file), file, name: file.name, assetId: null };
      $('#cover-file').value = ''; $('#existing-cover').value = ''; displayCover(); setDirty(true);
    } catch { throw new Error('无法截取此视频画面，请选择封面图片'); }
    finally { if (sequence === coverSequence) { coverPending = false; updateSave(); } }
  }
  $('#capture-cover').addEventListener('click', () => captureCover().catch(error => formError(error.message)));

  async function runMutation(operation, success) {
    if (busy) return false;
    busy = true; manager.setAttribute('aria-busy', 'true'); updateSave();
    const controls = [...manager.querySelectorAll('button,input,select,textarea')];
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    try {
      const works = await operation();
      app.renderWorks(works); $('#storage-message').hidden = true;
      message(success); return true;
    } catch (error) { formError(friendlyError(error)); message(friendlyError(error), true); return false; }
    finally {
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      busy = false; manager.removeAttribute('aria-busy'); updateSave();
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || videoPending || coverPending || !form.reportValidity()) return;
    formError('');
    if (!video || !cover) { formError(!video ? '请选择真实视频文件。' : '请选择封面图片。'); return; }
    const category = $('#work-category').value;
    const categoryTitle = app.categories.find(item => item.id === category)?.title || '';
    const record = {
      ...(editing || {}), id: editing?.id || crypto.randomUUID(), category,
      title: $('#work-title').value.trim(), description: $('#work-description').value.trim(),
      software: [...new Set($('#work-software').value.split(/[、,，;；\n]/).map(item => item.trim()).filter(Boolean))],
      subtitle: [categoryTitle, video.duration ? formatDuration(video.duration) : ''].filter(Boolean).join(' · '),
      tags: [categoryTitle], demo: false, credit: editing?.credit || '',
      video: video.assetId || video.file ? '' : video.url, videoAssetId: video.assetId,
      cover: cover.assetId || cover.file ? '' : cover.url, coverAssetId: cover.assetId,
      videoPoster: cover.assetId || cover.file ? '' : cover.url,
      videoName: video.name, coverName: cover.name,
      aspectRatio: video.aspectRatio || '16 / 9', portrait: !!video.portrait, duration: video.duration || null
    };
    // Keep bundled relative references portable instead of persisting file:// URLs.
    for (const field of ['video', 'cover', 'videoPoster']) {
      const media = field === 'video' ? video : cover;
      if (record[field] && media.url && !media.assetId && !media.file) {
        const existing = app.getWorks().find(work => work[field] === media.url || (field === 'videoPoster' && work.cover === media.url));
        if (existing) record[field] = field === 'videoPoster' ? existing.cover : existing[field];
      }
    }
    const id = record.id;
    const saved = await runMutation(() => repository.save({ work: record, videoFile: video.file, coverFile: cover.file }), '作品已保存');
    if (saved) { setDirty(false); startEditor(app.getWorks().find(work => work.id === id)); }
  });
  async function deleteWork(work) {
    if (busy || !await allowDiscard()) return;
    if (!await confirmation('删除这部作品？', `“${work.title}”将从本地作品库移除。`, '删除作品')) return;
    const deleted = await runMutation(() => repository.remove(work.id), '作品已删除');
    if (deleted) {
      if (editing?.id === work.id || dirty) { releasePreview(); editing = null; form.hidden = true; $('#editor-empty').hidden = false; setDirty(false); }
      renderList(); populateSources();
    }
  }
  $('#backup-export').addEventListener('click', async () => {
    if (busy) return;
    if (!repository.backup) { message('当前存储服务未提供备份下载。', true); return; }
    busy = true;
    try {
      message('正在准备备份…');
      const bytes = await repository.backup();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const link = document.createElement('a'); link.href = url; link.download = 'video-portfolio-backup.zip'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      message('已导出保存的作品和上传素材');
    } catch (error) { message(friendlyError(error), true); }
    finally { busy = false; }
  });
  $('#backup-import').addEventListener('click', () => { if (!busy) $('#backup-file').click(); });
  $('#backup-file').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file || busy || !await allowDiscard()) return;
    if (!repository.restore) { message('当前存储服务未提供备份恢复。', true); return; }
    if (!await confirmation('恢复作品备份？', '备份将替换当前已保存的作品库。', '恢复备份')) return;
    const restored = await runMutation(() => repository.restore(file), '作品备份已恢复');
    if (restored) { releasePreview(); editing = null; form.hidden = true; $('#editor-empty').hidden = false; setDirty(false); populateSources(); renderList(); }
  });
})();
