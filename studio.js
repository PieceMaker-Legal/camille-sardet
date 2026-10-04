const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
menuToggle?.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  nav?.classList.toggle('is-open', !expanded);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menuToggle?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.focus();
  }
});
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

function openStudioSection(hash = location.hash) {
  const section = document.getElementById(hash.slice(1));
  if (section?.matches('details.studio-section')) section.open = true;
}
document.querySelectorAll('.studio-index a').forEach(link => {
  link.addEventListener('click', () => openStudioSection(link.hash));
});
window.addEventListener('hashchange', () => openStudioSection());
openStudioSection();
