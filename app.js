const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const dialog = $('#project-dialog');
let projectData = [];
let imageData = {};
let returnFocus = null;
let portfolioInitialized = false;

function imagePath(key, variant = 'image') {
  const image = imageData[key];
  return image ? (variant === 'thumbnail' ? image.thumbnail : image.image) : '';
}

function addImage(image, key, alt, { eager = false, thumbnail = false } = {}) {
  const source = imageData[key];
  image.src = imagePath(key, thumbnail ? 'thumbnail' : 'image');
  if (source?.width && source?.height) {
    image.width = source.width;
    image.height = source.height;
  }
  if (thumbnail && source?.thumbnail && source?.image) {
    image.srcset = `${source.thumbnail} 800w, ${source.image} 1600w`;
    image.sizes = '(max-width: 560px) 100vw, (max-width: 800px) 50vw, 66vw';
  }
  image.alt = alt;
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  if (eager) image.fetchPriority = 'high';
}

function renderProjects() {
  const filtered = projectData;
  const grid = $('#project-grid');
  grid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aucun projet dans cette sélection.';
    grid.append(empty);
    return;
  }
  filtered.forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'project-card';
    article.dataset.projectId = project.id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-open';
    button.setAttribute('aria-label', `Voir le projet ${project.title}`);
    button.addEventListener('click', () => openProject(project, button));
    const wrap = document.createElement('span');
    wrap.className = 'project-image-wrap';
    const manifest = imageData[project.cover];
    if (manifest?.width && manifest?.height) wrap.style.setProperty('--ratio', `${manifest.width} / ${manifest.height}`);
    const img = document.createElement('img');
    addImage(img, project.cover, `${project.title} — image de présentation`, { eager: index < 2, thumbnail: true });
    const overlay = document.createElement('span');
    overlay.className = 'project-overlay';
    const overlayTitle = document.createElement('span');
    overlayTitle.className = 'project-overlay-title';
    overlayTitle.textContent = project.title;
    overlay.append(overlayTitle);
    wrap.append(img, overlay);
    button.append(wrap);
    article.append(button);
    grid.append(article);
  });
}

function renderJournal(items) {
  const grid = $('#journal-grid');
  grid.replaceChildren();
  items.forEach((item, index) => {
    const article = document.createElement('figure');
    article.className = 'journal-item';
    article.dataset.journalId = item.id;
    const wrap = document.createElement('div');
    wrap.className = 'journal-image-wrap';
    const manifest = imageData[item.cover];
    if (manifest?.width && manifest?.height) wrap.style.setProperty('--ratio', `${manifest.width} / ${manifest.height}`);
    const img = document.createElement('img');
    const yearLabel = item.year ? `, ${item.year}` : '';
    addImage(img, item.cover, `Couverture de la série ${item.title}${yearLabel}`, { thumbnail: true });
    const overlay = document.createElement('span');
    overlay.className = 'journal-overlay';
    overlay.textContent = item.title;
    wrap.append(img, overlay);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'journal-open';
    open.setAttribute('aria-label', `Voir la série ${item.title}${yearLabel}`);
    open.append(wrap);
  open.addEventListener('click', () => openProject({
      id: `carnet-${index + 1}`,
      title: item.title,
      category: 'Carnets',
      type: item.type,
      year: item.year,
      cover: item.cover,
      images: item.images,
      description: item.description,
      descriptionEn: item.descriptionEn,
      videos: item.videos,
      credits: item.credits || (item.year ? { Année: item.year } : {}),
    }, open));
    article.append(open);
    grid.append(article);
  });
}

function renderAbout(about) {
  const imageWrap = $('#about-image-wrap');
  const portrait = document.createElement('img');
  addImage(portrait, about.portrait, 'Portrait de Camille Sardet, photographié par Luc Bertrand');
  imageWrap.append(portrait);
  const bio = $('#about-bio');
  about.biography.forEach(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    bio.append(paragraph);
  });
  $('#about-signature').textContent = about.signature;
  const links = $('#document-links');
  about.documents.forEach(documentInfo => {
    const link = document.createElement('a');
    link.href = documentInfo.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = documentInfo.label;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = ' ↗';
    link.append(arrow);
    links.append(link);
  });
}

function openProject(project, trigger) {
  returnFocus = trigger;
  const content = $('#dialog-content');
  content.replaceChildren();
  const heading = document.createElement('header');
  heading.className = 'dialog-heading';
  const titleBlock = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'dialog-title';
  title.textContent = project.title;
  titleBlock.append(title);
  heading.append(titleBlock);

  const gallery = document.createElement('div');
  gallery.className = 'dialog-gallery';
  [project.cover, ...project.images].forEach((key, imageIndex) => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    addImage(img, key, `${project.title}, vue ${imageIndex + 1}`);
    figure.append(img);
    gallery.append(figure);
  });
  (project.videos || []).forEach((videoInfo, videoIndex) => {
    const figure = document.createElement('figure');
    const video = document.createElement('video');
    video.className = 'dialog-video';
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('aria-label', `${project.title}, vidéo ${videoIndex + 1}`);
    video.poster = imagePath(videoInfo.poster || project.cover);
    const source = document.createElement('source');
    source.src = videoInfo.src;
    source.type = 'video/mp4';
    video.append(source);
    figure.append(video);
    gallery.append(figure);
  });

  const details = document.createElement('section');
  details.className = 'dialog-details';
  if (project.description) {
    details.classList.add('has-description');
    details.setAttribute('aria-label', 'Explications et crédits');
    const photo = document.createElement('div');
    photo.className = 'dialog-project-photo';
    const photoImage = document.createElement('img');
    addImage(photoImage, project.cover, `Image de ${project.title}`);
    photo.append(photoImage);
    const info = document.createElement('div');
    info.className = 'dialog-info-copy';
    const infoTitle = document.createElement('h3');
    infoTitle.className = 'dialog-info-title';
    infoTitle.textContent = project.title;
    info.append(infoTitle);
    [
      { language: 'fr', text: project.description },
      { language: 'en', text: project.descriptionEn },
    ].filter(item => item.text).forEach(item => {
      const block = document.createElement('section');
      block.className = 'dialog-language';
      block.lang = item.language;
      item.text.split(/\n\s*\n/).forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        block.append(paragraph);
      });
      info.append(block);
    });
    details.append(photo, info);
  } else {
    details.classList.add('dialog-credits-only');
    details.setAttribute('aria-label', 'Informations du carnet');
  }
  const credits = document.createElement('dl');
  credits.className = 'dialog-credits';
  Object.entries(project.credits || {}).forEach(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const definition = document.createElement('dd');
    definition.textContent = value;
    row.append(term, definition);
    credits.append(row);
  });
  if (project.description) {
    $('.dialog-info-copy', details).append(credits);
  } else {
    details.append(credits);
  }
  content.append(heading, gallery, details);
  document.body.classList.add('dialog-open');
  dialog.showModal();
  dialog.scrollTop = 0;
  $('.dialog-close', dialog).focus();
}

function closeProject() {
  if (dialog.open) dialog.close();
}

$('.dialog-close').addEventListener('click', closeProject);
dialog.addEventListener('close', () => {
  $$('video', dialog).forEach(video => video.pause());
  document.body.classList.remove('dialog-open');
  returnFocus?.focus();
  returnFocus = null;
  if (/^#(?:projet|carnet)-/.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search);
  }
});
dialog.addEventListener('cancel', () => document.body.classList.remove('dialog-open'));
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = $$('button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])', dialog)
    .filter(element => element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const menuToggle = $('.menu-toggle');
const nav = $('#primary-nav');
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  nav.classList.toggle('is-open', !expanded);
});
$$('.primary-nav a').forEach(link => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.focus();
  }
});

$('#year').textContent = new Date().getFullYear();
function openGalleryFromHash() {
  if (!portfolioInitialized || dialog.open) return;
  const hash = location.hash;
  const isProject = hash.startsWith('#projet-');
  const isJournal = hash.startsWith('#carnet-');
  if (!isProject && !isJournal) return;
  const id = hash.slice(8);
  const cards = isProject ? $$('.project-card') : $$('.journal-item');
  const card = cards.find(element => (isProject ? element.dataset.projectId : element.dataset.journalId) === id);
  card?.querySelector('button')?.click();
}
window.addEventListener('hashchange', openGalleryFromHash);
function initializePortfolio(content, manifest) {
  projectData = content.projects;
  imageData = manifest;
  renderProjects();
  renderJournal(content.journal);
  if ($('#about-image-wrap') && content.about) renderAbout(content.about);
  const firstInitialization = !portfolioInitialized;
  portfolioInitialized = true;
  if (firstInitialization) openGalleryFromHash();
}
if (window.PORTFOLIO_CONTENT && window.PORTFOLIO_IMAGES) {
  initializePortfolio(window.PORTFOLIO_CONTENT, window.PORTFOLIO_IMAGES);
} else {
  Promise.all([
    fetch('data/projects.json').then(response => {
      if (!response.ok) throw new Error('Impossible de charger les projets.');
      return response.json();
    }),
    fetch('data/image-manifest.json').then(response => {
      if (!response.ok) throw new Error('Impossible de charger les images.');
      return response.json();
    }),
  ]).then(([content, manifest]) => initializePortfolio(content, manifest)).catch(error => {
  console.error(error);
  $('#project-grid').innerHTML = '<p class="empty-state">Le portfolio ne peut pas être chargé pour le moment.</p>';
  });
}

// Online edits are committed to the repository: hosted pages re-read the data
// files, bypassing a bundle the browser may still have cached. The file://
// version remains self-contained and uses the embedded data above.
if (location.protocol.startsWith('http')) {
  Promise.all(['data/projects.json', 'data/image-manifest.json'].map(path =>
    fetch(path, { cache: 'no-store' }).then(response => response.ok ? response.json() : null)))
    .then(([content, manifest]) => {
      if (!content || !manifest) return;
      if (JSON.stringify(content) === JSON.stringify(window.PORTFOLIO_CONTENT)) return;
      initializePortfolio(content, manifest);
    })
    .catch(() => {});
}
