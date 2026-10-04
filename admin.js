(() => {
  'use strict';

  // Content lives in the GitHub Pages repository: each save is a commit,
  // and Pages republishes the site on its own.
  const REPO = 'PieceMaker-Legal/camille-sardet';
  const BRANCH = 'main';
  const GITHUB = `https://api.github.com/repos/${REPO}`;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const authPanel = $('#auth-panel');
  const workspace = $('#workspace');
  const loginForm = $('#login-form');
  const authMessage = $('#auth-message');
  const entryForm = $('#entry-form');
  const fields = $('#editor-fields');
  const tokenKey = 'camille-admin-github-token';
  const storedToken = () => { try { return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey) || ''; } catch { return ''; } };
  let accessToken = storedToken();
  let data = null;
  let active = null;
  let cover = '';
  let images = [];
  let dirty = false;
  let suppressDirty = false;
  // Images added in this session: committed with the entry that uses them.
  // Previews stay local until Pages has republished the files.
  const pendingUploads = new Map();
  const previews = new Map();

  async function github(path, options = {}) {
    const headers = new Headers({ Accept: options.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.json !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${GITHUB}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      cache: 'no-store',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      let message = payload.message || 'La demande n’a pas abouti.';
      if (response.status === 401) message = 'Jeton GitHub refusé ou expiré.';
      else if (response.status === 403 || response.status === 404) message = 'Ce jeton n’a pas accès au dépôt du site (permission « Contents » en lecture et écriture requise).';
      if (response.status === 401) logoutLocal();
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return options.raw ? response.text() : response.json();
  }

  async function readJson(path, ref) {
    return JSON.parse(await github(`/contents/${path}?ref=${ref}`, { raw: true }));
  }

  async function headCommit() {
    const ref = await github(`/git/ref/heads/${BRANCH}`);
    return ref.object.sha;
  }

  function showMessage(node, message, success = false) {
    node.textContent = message || '';
    node.classList.toggle('success', Boolean(success));
  }

  function setAuthView(view) {
    authPanel.hidden = view === 'workspace';
    workspace.hidden = view !== 'workspace';
    loginForm.hidden = view !== 'login';
  }

  function forgetToken() {
    try { localStorage.removeItem(tokenKey); sessionStorage.removeItem(tokenKey); } catch {}
  }

  function logoutLocal() {
    accessToken = '';
    forgetToken();
    data = null;
    setAuthView('login');
  }

  async function loadAdmin() {
    const sha = await headCommit();
    const [content, manifest] = await Promise.all([readJson('data/projects.json', sha), readJson('data/image-manifest.json', sha)]);
    data = content;
    data.manifest = manifest;
    active = null;
    renderList();
    renderLibrary();
    setAuthView('workspace');
    setActive(null);
  }

  async function initialize() {
    if (accessToken) {
      try { await loadAdmin(); return; }
      catch (error) { if (error.status !== 401) showMessage(authMessage, error.message); }
    }
    setAuthView('login');
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage(authMessage, '');
    const form = new FormData(loginForm);
    const button = $('button[type="submit"]', loginForm);
    button.disabled = true;
    accessToken = String(form.get('token') || '').trim();
    try {
      await loadAdmin();
      forgetToken();
      try { (form.get('remember') ? localStorage : sessionStorage).setItem(tokenKey, accessToken); } catch {}
      loginForm.reset();
    } catch (error) {
      accessToken = '';
      setAuthView('login');
      showMessage(authMessage, error.message);
    }
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
    const preview = previews.get(key);
    if (preview) return variant === 'image' ? preview.image : preview.thumbnail;
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

  function blobFromCanvas(canvas, type) {
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Impossible de préparer cette image.')),type,.83));
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
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        // Browsers without a WebP encoder silently return PNG: use JPEG instead.
        let blob=await blobFromCanvas(canvas,'image/webp');
        if (blob.type!=='image/webp') blob=await blobFromCanvas(canvas,'image/jpeg');
        return { blob, width:canvas.width, height:canvas.height };
      };
      return { full:await encode(1600), thumb:await encode(800) };
    } finally { bitmap.close(); }
  }

  $('#image-upload').addEventListener('change', async event => {
    const files=[...event.target.files]; event.target.value='';
    if (!active || !files.length) return;
    const input=event.target; input.disabled=true; showMessage($('#save-message'),'Préparation des images…');
    try {
      for (const file of files) {
        const prepared=await prepareImage(file);
        const id=`u-${Date.now().toString(36)}-${crypto.randomUUID().slice(0,6)}`;
        const ext=prepared.full.blob.type==='image/webp'?'webp':'jpg';
        const record={uploaded:true,image:`assets/uploads/${id}.${ext}`,thumbnail:`assets/uploads/${id}-thumb.${ext}`,width:prepared.full.width,height:prepared.full.height,thumbnailWidth:prepared.thumb.width,thumbnailHeight:prepared.thumb.height};
        pendingUploads.set(id,{record,files:[[record.image,prepared.full.blob],[record.thumbnail,prepared.thumb.blob]]});
        previews.set(id,{image:URL.createObjectURL(prepared.full.blob),thumbnail:URL.createObjectURL(prepared.thumb.blob)});
        data.manifest[id]=record;
        if (!cover) cover=id; else images.push(id);
        markDirty(); renderSelected(); renderLibrary();
      }
      showMessage($('#save-message'),'Images ajoutées à la sélection. Elles seront publiées à l’enregistrement.',true);
    } catch(error) { showMessage($('#save-message'),error.message); }
    finally { input.disabled=false; }
  });

  async function blobToBase64(blob) {
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary='';
    for (let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(binary);
  }

  function contentBundle(content, manifest) {
    return `window.PORTFOLIO_CONTENT = ${JSON.stringify(content)};\nwindow.PORTFOLIO_IMAGES = ${JSON.stringify(manifest)};\n`;
  }

  // Applies the change on top of the latest commit, so edits made elsewhere
  // in the meantime are kept; retries if the branch moved during the save.
  async function commitEntry(kind, item, isNew) {
    const uploads=[item.cover,...item.images].filter(key=>pendingUploads.has(key));
    for (const key of uploads) {
      const upload=pendingUploads.get(key);
      for (const file of upload.files) {
        if (file[2]) continue;
        const blob=await github('/git/blobs',{method:'POST',json:{content:await blobToBase64(file[1]),encoding:'base64'}});
        file[2]=blob.sha;
      }
    }
    for (let attempt=0;;attempt++) {
      const parent=await headCommit();
      const [commit,content,manifest]=await Promise.all([github(`/git/commits/${parent}`),readJson('data/projects.json',parent),readJson('data/image-manifest.json',parent)]);
      const list=kind==='project'?content.projects:content.journal;
      const index=list.findIndex(entry=>entry.id===item.id);
      if (index<0) list.push(item); else list[index]=item;
      for (const key of [item.cover,...item.images]) {
        if (pendingUploads.has(key)) manifest[key]=pendingUploads.get(key).record;
        else if (!manifest[key]) throw new Error(`Image introuvable dans le dépôt : ${key}`);
      }
      const tree=[
        {path:'data/projects.json',mode:'100644',type:'blob',content:JSON.stringify(content,null,2)+'\n'},
        {path:'data/image-manifest.json',mode:'100644',type:'blob',content:JSON.stringify(manifest)+'\n'},
        {path:'data/content.js',mode:'100644',type:'blob',content:contentBundle(content,manifest)},
        ...uploads.flatMap(key=>pendingUploads.get(key).files.map(([path,,sha])=>({path,mode:'100644',type:'blob',sha}))),
      ];
      const newTree=await github('/git/trees',{method:'POST',json:{base_tree:commit.tree.sha,tree}});
      const label=kind==='project'?'projet':'carnet';
      const newCommit=await github('/git/commits',{method:'POST',json:{message:`${isNew?'Ajout':'Mise à jour'} du ${label} « ${item.title} » depuis l’administration`,tree:newTree.sha,parents:[parent]}});
      try {
        await github(`/git/refs/heads/${BRANCH}`,{method:'PATCH',json:{sha:newCommit.sha}});
      } catch(error) {
        if (error.status===422 && attempt<3) continue;
        throw error;
      }
      uploads.forEach(key=>pendingUploads.delete(key));
      return {content,manifest};
    }
  }

  entryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!active) return;
    if (!cover) { showMessage($('#save-message'),'Choisis une image de couverture.'); return; }
    const form=new FormData(entryForm);
    const title=String(form.get('title')||'').trim();
    const generatedId=title.toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'contenu';
    const id=active.isNew?`${generatedId}-${crypto.randomUUID().slice(0,8)}`:active.id;
    const original=active.isNew?{}:(active.kind==='project'?data.projects:data.journal).find(entry=>entry.id===id)||{};
    const item={...original,id,title,year:String(form.get('year')||''),cover,images:[...images],description:String(form.get('description')||''),descriptionEn:String(form.get('descriptionEn')||''),credits:textToCredits(String(form.get('credits')||''))};
    if(active.kind==='project'){item.category=String(form.get('category')||'');item.type=String(form.get('type')||'');}
    else item.type=String(form.get('journalType')||'');
    const saveButton=$('#save-entry');saveButton.disabled=true;showMessage($('#save-message'),'Enregistrement…');
    try {
      const result=await commitEntry(active.kind,item,active.isNew);
      const pendingRecords=Object.fromEntries([...pendingUploads].map(([key,upload])=>[key,upload.record]));
      data={...result.content,manifest:{...result.manifest,...pendingRecords}};
      const saved=(active.kind==='project'?data.projects:data.journal).find(entry=>entry.id===id);
      setActive(active.kind,saved,false);
      renderLibrary();
      showMessage($('#save-message'),'Enregistré. Le site sera à jour d’ici une à deux minutes.',true);
    } catch(error){showMessage($('#save-message'),error.message);}
    finally{saveButton.disabled=false;}
  });

  $('#logout').addEventListener('click', () => {
    if (dirty && !confirm('Abandonner les modifications non enregistrées ?')) return;
    dirty=false;
    logoutLocal();
  });

  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  initialize();
})();
