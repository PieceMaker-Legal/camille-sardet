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
