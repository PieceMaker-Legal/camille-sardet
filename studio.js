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

const studioSections = document.querySelectorAll('details.studio-section');
function closeOtherStudioSections(activeSection) {
  studioSections.forEach(section => {
    if (section !== activeSection) section.open = false;
  });
}
studioSections.forEach(section => {
  section.addEventListener('toggle', () => {
    if (section.open) closeOtherStudioSections(section);
  });
});
function openStudioSection(hash = location.hash) {
  const section = document.getElementById(hash.slice(1));
  if (section?.matches('details.studio-section')) {
    closeOtherStudioSections(section);
    section.open = true;
  }
}
window.addEventListener('hashchange', () => openStudioSection());
openStudioSection();

// Small screens: hide the header while scrolling down, reveal it on scroll up.
const siteHeader = document.querySelector('.site-header');
const smallScreen = matchMedia('(max-width: 800px)');
let lastScrollY = scrollY;
addEventListener('scroll', () => {
  if (!siteHeader) return;
  const y = scrollY;
  const hide = smallScreen.matches && y > lastScrollY && y > siteHeader.offsetHeight && !nav?.classList.contains('is-open');
  if (Math.abs(y - lastScrollY) > 4 || !hide) siteHeader.classList.toggle('is-hidden', hide);
  lastScrollY = y;
}, { passive: true });
