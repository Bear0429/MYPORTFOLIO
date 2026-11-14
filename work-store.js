(() => {
  'use strict';
  const DATABASE = 'my-video-portfolio-v1';
  const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const completed = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('保存已取消')); tx.onerror = () => {}; });
  const clone = value => structuredClone(value);
  const assetIds = works => new Set(works.flatMap(work => [work.videoAssetId, work.coverAssetId]).filter(Boolean));
  const storedWork = work => {
    const result = clone(work);
    if (result.videoAssetId) result.video = '';
    if (result.coverAssetId) { result.cover = ''; result.videoPoster = ''; }
    for (const field of ['video', 'cover', 'videoPoster']) if (result[field]?.startsWith('blob:')) result[field] = '';
    return result;
  };
  const validSource = value => typeof value === 'string' && (!value || /^https?:\/\//i.test(value) || /^assets\/(?!\/)[^\x00-\x1f\\?#:]+$/.test(value) && !value.split('/').includes('..'));

  class LocalWorkRepository {
    constructor(initialWorks, categories, bundledImports = []) {
      this.initialWorks = clone(initialWorks).map(work => ({ description: '', software: [], videoPoster: '', ...work }));
      this.categories = categories;
      this.bundledImports = bundledImports;
      this.urls = new Map();
      this.dbPromise = null;
    }
    async database() {
      if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('当前浏览器无法使用本地存储')); return; }
        const open = indexedDB.open(DATABASE, 1);
        open.onupgradeneeded = () => { open.result.createObjectStore('state'); open.result.createObjectStore('assets', { keyPath: 'id' }); };
        open.onsuccess = () => { open.result.onversionchange = () => { open.result.close(); this.dbPromise = null; }; resolve(open.result); };
        open.onerror = () => { this.dbPromise = null; reject(open.error); };
        open.onblocked = () => { this.dbPromise = null; reject(new Error('请关闭其他作品集标签页后重试')); };
      });
      return this.dbPromise;
    }
    async snapshot() {
      const db = await this.database();
      const tx = db.transaction(['state', 'assets'], 'readonly');
      const done = completed(tx);
      try {
        const [state, assets] = await Promise.all([request(tx.objectStore('state').get('portfolio')), request(tx.objectStore('assets').getAll())]);
        await done;
        return { works: state ? state.works : clone(this.initialWorks), assets };
      } catch (error) { await done.catch(() => {}); throw error; }
    }
    async applyBundledImports() {
      if (!this.bundledImports.length) return;
      const db = await this.database();
      const tx = db.transaction('state', 'readwrite');
      const done = completed(tx);
      try {
        const state = await request(tx.objectStore('state').get('portfolio'));
        if (state) {
          const applied = new Set(state.appliedImports || []);
          const ids = new Set(state.works.map(work => work.id));
          let changed = false;
          for (const batch of this.bundledImports) {
            if (applied.has(batch.id)) continue;
            for (const id of batch.workIds) {
              const work = this.initialWorks.find(item => item.id === id);
              if (work && !ids.has(id)) { state.works.push(clone(work)); ids.add(id); }
            }
            applied.add(batch.id); changed = true;
          }
          if (changed) { state.appliedImports = [...applied]; tx.objectStore('state').put(state, 'portfolio'); }
        }
        await done;
      } catch (error) { await done.catch(() => {}); throw error; }
    }
    async load() {
      await this.applyBundledImports();
      const { works, assets } = await this.snapshot();
      const files = new Map(assets.map(asset => [asset.id, asset]));
      const used = assetIds(works);
      for (const [id, url] of this.urls) if (!used.has(id)) { URL.revokeObjectURL(url); this.urls.delete(id); }
      const urlFor = id => {
        if (!files.has(id)) throw new Error('作品素材不完整，请从备份恢复');
        if (!this.urls.has(id)) this.urls.set(id, URL.createObjectURL(files.get(id).blob));
        return this.urls.get(id);
      };
      return works.map(work => {
        const result = clone(work);
        if (work.videoAssetId) result.video = urlFor(work.videoAssetId);
        if (work.coverAssetId) { result.cover = urlFor(work.coverAssetId); result.videoPoster = result.cover; }
        return result;
      });
    }
    validate(work) {
      if (!work.id || typeof work.id !== 'string' || !work.title?.trim() || work.title.length > 120) throw new Error('请填写作品标题（最多 120 字）');
      if (!this.categories.some(category => category.id === work.category)) throw new Error('请选择作品类型');
      if (typeof work.description !== 'string' || work.description.length > 3000) throw new Error('作品简介最多 3000 字');
      if (!Array.isArray(work.software) || work.software.some(item => typeof item !== 'string' || item.length > 100)) throw new Error('制作软件格式不正确');
      if (!work.video && !work.videoAssetId) throw new Error('请选择视频文件');
      if (!work.cover && !work.coverAssetId) throw new Error('请选择封面图片');
      for (const field of ['video', 'cover', 'videoPoster']) if (!validSource(work[field])) throw new Error('素材地址无效');
    }
    async mutate(change) {
      const db = await this.database();
      const tx = db.transaction(['state', 'assets'], 'readwrite');
      const done = completed(tx);
      try {
        const state = await request(tx.objectStore('state').get('portfolio'));
        const works = clone(state ? state.works : this.initialWorks);
        const next = change(works, tx.objectStore('assets'));
        const used = assetIds(next);
        const keys = await request(tx.objectStore('assets').getAllKeys());
        const available = new Set(keys);
        for (const id of used) if (!available.has(id)) throw new Error('作品素材不完整，请重新选择视频或封面');
        for (const key of keys) if (!used.has(key)) tx.objectStore('assets').delete(key);
        const appliedImports = [...new Set([...(state?.appliedImports || []), ...this.bundledImports.map(batch => batch.id)])];
        tx.objectStore('state').put({ version: 1, works: next, appliedImports, updatedAt: new Date().toISOString() }, 'portfolio');
        await done;
      } catch (error) {
        try { tx.abort(); } catch { /* Transaction may already have aborted on quota errors. */ }
        await done.catch(() => {});
        throw error;
      }
      return this.load();
    }
    async save({ work, videoFile, coverFile }) {
      const record = storedWork(work);
      const assets = [];
      for (const [kind, file] of [['video', videoFile], ['cover', coverFile]]) {
        if (!file) continue;
        if (!(file instanceof Blob) || !file.size) throw new Error('无法保存空文件');
        const id = crypto.randomUUID();
        assets.push({ id, blob: file, name: file.name || `${kind}.jpg`, type: file.type });
        record[`${kind}AssetId`] = id;
        record[kind] = '';
        if (kind === 'cover') record.videoPoster = '';
        record[`${kind}Name`] = file.name || `${kind}.jpg`;
      }
      this.validate(record);
      record.updatedAt = new Date().toISOString();
      return this.mutate((works, store) => {
        for (const asset of assets) store.put(asset);
        const index = works.findIndex(item => item.id === record.id);
        if (index === -1) works.push(record);
        else works[index] = record;
        return works;
      });
    }
    async remove(id) { return this.mutate(works => works.filter(work => work.id !== id)); }
    async backup() {
      await this.applyBundledImports();
      const { works, assets } = await this.snapshot();
      const files = {};
      const manifest = { version: 1, works, assets: assets.map(({ id, name, type }) => ({ id, name, type })) };
      files['portfolio.json'] = fflate.strToU8(JSON.stringify(manifest, null, 2));
      for (const asset of assets) files[`media/${asset.id}`] = new Uint8Array(await asset.blob.arrayBuffer());
      return new Promise((resolve, reject) => fflate.zip(files, { level: 0 }, (error, result) => error ? reject(error) : resolve(result)));
    }
    async restore(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const files = await new Promise((resolve, reject) => fflate.unzip(bytes, { filter: entry => entry.originalSize <= 1024 * 1024 * 1024 }, (error, result) => error ? reject(new Error('无法读取备份文件')) : resolve(result)));
      let manifest;
      try { manifest = JSON.parse(fflate.strFromU8(files['portfolio.json'])); } catch { throw new Error('备份格式不正确'); }
      if (manifest.version !== 1 || !Array.isArray(manifest.works) || !Array.isArray(manifest.assets)) throw new Error('不支持的备份版本');
      const ids = new Set();
      const assets = new Map();
      for (const asset of manifest.assets) {
        if (!asset || typeof asset.id !== 'string' || assets.has(asset.id) || !files[`media/${asset.id}`]?.length) throw new Error('备份素材不完整');
        assets.set(asset.id, { id: asset.id, name: String(asset.name || ''), type: String(asset.type || ''), blob: new Blob([files[`media/${asset.id}`]], { type: String(asset.type || '') }) });
      }
      for (const work of manifest.works) {
        this.validate(work);
        if (ids.has(work.id)) throw new Error('备份作品 ID 重复');
        ids.add(work.id);
        for (const id of assetIds([work])) if (!assets.has(id)) throw new Error('备份缺少视频或封面');
      }
      // New object URLs are issued after replacement, even when backup IDs match.
      await this.mutate((works, store) => {
        store.clear();
        for (const asset of assets.values()) store.put(asset);
        return manifest.works;
      });
      for (const url of this.urls.values()) URL.revokeObjectURL(url);
      this.urls.clear();
      return this.load();
    }
  }
  window.LocalWorkRepository = LocalWorkRepository;
  // Supply a cloud adapter before app.js with this same async contract.
  window.workRepository = window.PORTFOLIO_REPOSITORY || new LocalWorkRepository(window.PORTFOLIO.works || [], window.PORTFOLIO.categories || [], window.PORTFOLIO.bundledImports || []);
})();
