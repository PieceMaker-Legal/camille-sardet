(() => {
  'use strict';

  const API = 'https://camille-sardet-admin.rosy-gleam-9132.chatgpt.site/api';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const setupToken = new URLSearchParams(location.hash.slice(1)).get('setup') || '';
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);

  const authPanel = $('#auth-panel');
  const workspace = $('#workspace');
  const loginForm = $('#login-form');
  const setupForm = $('#setup-form');
  const authMessage = $('#auth-message');
  const setupUnavailable = $('#setup-unavailable');
  const entryForm = $('#entry-form');
  const fields = $('#editor-fields');
  const tokenKey = 'camille-admin-session';
  let accessToken = sessionStorage.getItem(tokenKey) || '';
  let data = null;
  let revision = '';
  let active = null;
  let cover = '';
  let images = [];
  let dirty = false;
  let suppressDirty = false;

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.auth !== false && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.json !== undefined) headers.set('Content-Type', 'application/json');
    if (options.setupToken) headers.set('X-Setup-Token', options.setupToken);
    const response = await fetch(`${API}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && options.auth !== false) logoutLocal();
      const error = new Error(payload.error || 'La demande n’a pas abouti.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showMessage(node, message, success = false) {
    node.textContent = message || '';
    node.classList.toggle('success', Boolean(success));
  }

  function setAuthView(view) {
    authPanel.hidden = view === 'workspace';
    workspace.hidden = view !== 'workspace';
    loginForm.hidden = view !== 'login';
    setupForm.hidden = view !== 'setup';
    setupUnavailable.hidden = view !== 'unavailable';
  }

  function logoutLocal() {
    accessToken = '';
    sessionStorage.removeItem(tokenKey);
    data = null;
    setAuthView('login');
  }

  async function loadAdmin() {
    const payload = await api('/admin/content');
    data = payload.content;
    revision = payload.revision;
    data.manifest = payload.manifest;
    active = null;
    renderList();
    renderLibrary();
    setAuthView('workspace');
    setActive(null);
  }

  async function initialize() {
    try {
      const state = await api('/status', { auth: false });
      if (!state.configured) {
        setAuthView(setupToken ? 'setup' : 'unavailable');
        return;
      }
      if (accessToken) {
        try { await loadAdmin(); return; } catch { logoutLocal(); }
      }
      setAuthView('login');
    } catch (error) {
      setAuthView('unavailable');
      showMessage(authMessage, `Connexion au service impossible. ${error.message}`);
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage(authMessage, '');
    const password = new FormData(loginForm).get('password');
    const button = $('button[type="submit"]', loginForm);
    button.disabled = true;
    try {
      const result = await api('/login', { method: 'POST', auth: false, json: { password } });
      accessToken = result.token;
      sessionStorage.setItem(tokenKey, accessToken);
      loginForm.reset();
      await loadAdmin();
    } catch (error) { showMessage(authMessage, error.message); }
    finally { button.disabled = false; }
  });

  setupForm.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage(authMessage, '');
    const form = new FormData(setupForm);
    const button = $('button[type="submit"]', setupForm);
    button.disabled = true;
    try {
      await api('/setup', { method: 'POST', auth: false, setupToken, json: { password: form.get('password'), confirm: form.get('confirm') } });
      setupForm.reset();
      showMessage(authMessage, 'Mot de passe créé. Vous pouvez vous connecter.', true);
      setAuthView('login');
      $('#login-password').focus();
    } catch (error) { showMessage(authMessage, error.message); }
    finally { button.disabled = false; }
  });

  function renderList() {
    const target = $('#content-items');
    target.replaceChildren();
    const query = $('#content-search').value.trim().toLocaleLowerCase('fr');
    for (const kind of ['project', 'journal']) {
      const entries = kind === 'project' ? data.projects : data.journal;
      for (const entry of entries) {
        if (query && !entry.title.toLocaleLowerCase('fr').includes(query)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'content-item';
        button.setAttribute('aria-current', String(active?.id === entry.id && active.kind === kind && !active.isNew));
        const title = document.createElement('strong'); title.textContent = entry.title;
        const meta = document.createElement('span'); meta.textContent = `${kind === 'project' ? 'Projet' : 'Carnet'}${entry.year ? ` · ${entry.year}` : ''}`;
        button.append(title, meta);
        button.addEventListener('click', () => selectEntry(kind, entry.id));
        target.append(button);
      }
    }
  }

  function input(name) { return $(`[name="${name}"]`, entryForm); }
  function setField(name, value) { input(name).value = value || ''; }

  function creditsToText(credits) {
    return Object.entries(credits || {}).map(([key, value]) => `${key} : ${value}`).join('\n');
  }
  function textToCredits(value) {
    const credits = {};
    for (const line of value.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const splitAt = line.indexOf(':');
      const key = (splitAt < 0 ? 'Crédits' : line.slice(0, splitAt)).trim();
      const text = (splitAt < 0 ? line : line.slice(splitAt + 1)).trim();
      if (key && text) credits[key] = text;
    }
    return credits;
  }

  function setActive(kind, entry, isNew = false) {
    suppressDirty = true;
    active = entry ? { kind, id: entry.id, isNew } : null;
    fields.hidden = !entry;
    $('#entry-kind-label').textContent = kind === 'journal' ? 'Carnet' : 'Projet';
    $('#entry-heading').textContent = entry ? (isNew ? `Nouveau ${kind === 'journal' ? 'carnet' : 'projet'}` : entry.title) : 'Choisir un contenu';
    if (entry) {
      setField('title', entry.title);
      setField('year', entry.year);
      setField('category', entry.category);
      setField('type', entry.type);
      setField('journalType', entry.type);
      setField('description', entry.description);
      setField('descriptionEn', entry.descriptionEn);
      setField('credits', creditsToText(entry.credits));
      $('.project-only').hidden = kind !== 'project';
      $('.journal-type').hidden = kind !== 'journal';
      cover = entry.cover || '';
      images = [...(entry.images || [])].filter(key => key !== cover);
    } else {
      entryForm.reset();
      $('.project-only').hidden = true;
      $('.journal-type').hidden = true;
      cover = '';
      images = [];
    }
    dirty = false;
    $('#dirty-indicator').hidden = true;
    showMessage($('#save-message'), '');
    renderSelected();
    renderList();
    suppressDirty = false;
  }

  async function selectEntry(kind, id) {
    if (dirty && !confirm('Abandonner les modifications non enregistrées ?')) return;
    const entry = (kind === 'project' ? data.projects : data.journal).find(item => item.id === id);
    if (entry) setActive(kind, entry);
  }

  function newEntry(kind) {
    if (dirty && !confirm('Abandonner les modifications non enregistrées ?')) return;
    setActive(kind, { title: '', year: '', category: '', type: kind === 'journal' ? 'Série' : '', description: '', descriptionEn: '', credits: {}, cover: '', images: [] }, true);
  }

  function markDirty() {
    if (suppressDirty || !active) return;
    dirty = true;
    $('#dirty-indicator').hidden = false;
    showMessage($('#save-message'), '');
  }
  entryForm.addEventListener('input', markDirty);
  $('#content-search').addEventListener('input', renderList);
  $('#new-project').addEventListener('click', () => newEntry('project'));
  $('#new-journal').addEventListener('click', () => newEntry('journal'));

  function imageUrl(key, variant = 'thumbnail') {
    const record = data?.manifest?.[key];
    if (!record) return '';
    return variant === 'image' ? record.image : record.thumbnail;
  }

  function setCover(key) {
    if (!key || !data.manifest[key] || key === cover) return;
    const oldCover = cover;
    images = images.filter(image => image !== key && image !== oldCover);
    if (oldCover) images.unshift(oldCover);
    cover = key;
    markDirty(); renderSelected(); renderLibrary();
  }

  function addToSelection(key) {
    if (!data.manifest[key]) return;
    if (key === cover) return;
    if (images.includes(key)) images = images.filter(item => item !== key);
    else images.push(key);
    markDirty(); renderSelected(); renderLibrary();
  }

  function renderSelected() {
    const slot = $('#cover-slot'); slot.replaceChildren();
    if (cover && data?.manifest?.[cover]) {
      const image = document.createElement('img'); image.src = imageUrl(cover); image.alt = 'Image de couverture';
      slot.append(image);
    } else {
      const label = document.createElement('span'); label.textContent = 'Choisir une image dans la médiathèque'; slot.append(label);
    }
    $('#gallery-count').textContent = `${images.length} image${images.length === 1 ? '' : 's'}`;
    const list = $('#selected-images'); list.replaceChildren();
    images.forEach((key, index) => {
      const card = document.createElement('div'); card.className = 'selected-card';
      const image = document.createElement('img'); image.src = imageUrl(key); image.alt = `Image ${index + 1} de la galerie`;
      const actions = document.createElement('div'); actions.className = 'selected-card-actions';
      const control = (symbol, label, callback, disabled = false) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol; button.title = label; button.setAttribute('aria-label', label); button.disabled = disabled; button.addEventListener('click', callback); return button;
      };
      actions.append(
        control('↑','Monter',() => moveImage(index,-1),index===0),
        control('↓','Descendre',() => moveImage(index,1),index===images.length-1),
        control('★','Choisir comme couverture',() => setCover(key)),
        control('×','Retirer',() => { images=images.filter(item=>item!==key); markDirty(); renderSelected(); renderLibrary(); })
      );
      card.append(image,actions); list.append(card);
    });
  }

  function moveImage(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= images.length) return;
    [images[index],images[next]] = [images[next],images[index]];
    markDirty(); renderSelected();
  }

  function renderLibrary() {
    const target = $('#media-library'); target.replaceChildren();
    const query = $('#media-search').value.trim().toLocaleLowerCase('fr');
    const keys = Object.keys(data?.manifest || {}).filter(key => {
      const record = data.manifest[key];
      return !query || `${key} ${record.source || ''}`.toLocaleLowerCase('fr').includes(query);
    });
    if (!keys.length) { const p=document.createElement('p');p.className='empty-library';p.textContent='Aucune image trouvée.';target.append(p);return; }
    for (const key of keys) {
      const button = document.createElement('button'); button.type='button'; button.className='library-image';
      const chosen = key===cover || images.includes(key); button.setAttribute('aria-pressed',String(chosen));
      button.title = key;
      const image=document.createElement('img');image.loading='lazy';image.src=imageUrl(key);image.alt='';
      const label=document.createElement('span');label.textContent=key;
      button.append(image,label);
      button.addEventListener('click',()=>{
        if (!cover) setCover(key);
        else if (key===cover) setCover('');
        else addToSelection(key);
      });
      target.append(button);
    }
  }
  $('#media-search').addEventListener('input', renderLibrary);

  function blobFromCanvas(canvas) {
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Impossible de préparer cette image.')),'image/webp',.83));
  }

  async function prepareImage(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error(`${file.name} : format accepté JPEG, PNG ou WebP.`);
    if (file.size > 20*1024*1024) throw new Error(`${file.name} dépasse 20 Mo.`);
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width*bitmap.height > 50_000_000) throw new Error(`${file.name} dépasse 50 mégapixels.`);
      const encode = async bound => {
        const scale=Math.min(1,bound/Math.max(bitmap.width,bitmap.height));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return blobFromCanvas(canvas);
      };
      return { original:file, full:await encode(1600), thumb:await encode(800) };
    } finally { bitmap.close(); }
  }

  $('#image-upload').addEventListener('change', async event => {
    const files=[...event.target.files]; event.target.value='';
    if (!active || !files.length) return;
    const input=event.target; input.disabled=true; showMessage($('#save-message'),'Préparation des images…');
    try {
      for (const file of files) {
        const prepared=await prepareImage(file);
        const form=new FormData();form.append('revision',revision);form.append('original',prepared.original,file.name);form.append('full',prepared.full,`${file.name}.webp`);form.append('thumb',prepared.thumb,`${file.name}-thumb.webp`);
        const result=await api('/admin/upload',{method:'POST',body:form});
        revision=result.revision;
        data.manifest[result.id]=result.manifest;
        if (!cover) cover=result.id; else images.push(result.id);
        markDirty(); renderSelected(); renderLibrary();
      }
      showMessage($('#save-message'),'Images ajoutées à la sélection.',true);
    } catch(error) { showMessage($('#save-message'),error.message); }
    finally { input.disabled=false; }
  });

  entryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!active) return;
    if (!cover) { showMessage($('#save-message'),'Choisis une image de couverture.'); return; }
    const form=new FormData(entryForm);
    const title=String(form.get('title')||'').trim();
    const generatedId=title.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'contenu';
    const id=active.isNew?`${generatedId}-${crypto.randomUUID().slice(0,8)}`:active.id;
    const item={id,title,year:String(form.get('year')||''),cover,images:[...images],description:String(form.get('description')||''),descriptionEn:String(form.get('descriptionEn')||''),credits:textToCredits(String(form.get('credits')||''))};
    if(active.kind==='project'){item.category=String(form.get('category')||'');item.type=String(form.get('type')||'');}
    else item.type=String(form.get('journalType')||'');
    const saveButton=$('#save-entry');saveButton.disabled=true;showMessage($('#save-message'),'Enregistrement…');
    try {
      const result=await api('/admin/save',{method:'POST',json:{kind:active.kind,isNew:active.isNew,item,revision}});
      revision=result.revision;
      const list=active.kind==='project'?data.projects:data.journal;
      const index=list.findIndex(entry=>entry.id===result.item.id);
      if(index<0)list.push(result.item);else list[index]=result.item;
      setActive(active.kind,result.item,false);
      showMessage($('#save-message'),'Modifications enregistrées.',true);
    } catch(error){showMessage($('#save-message'),error.message);}
    finally{saveButton.disabled=false;}
  });

  $('#logout').addEventListener('click', async () => {
    try { await api('/admin/logout',{method:'POST',json:{}}); } catch {}
    logoutLocal();
  });

  const passwordDialog=$('#password-dialog');
  $('#change-password').addEventListener('click',()=>passwordDialog.showModal());
  $('#close-password').addEventListener('click',()=>passwordDialog.close());
  $('#password-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));
    showMessage($('#password-message'),'');
    try{await api('/admin/change-password',{method:'POST',json:values});form.reset();passwordDialog.close();alert('Mot de passe mis à jour.');}
    catch(error){showMessage($('#password-message'),error.message);}
  });

  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  initialize();
})();
