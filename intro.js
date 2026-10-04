(() => {
  'use strict';
  const entrance = document.querySelector('.entrance');
  const wordmark = document.querySelector('.wordmark-name');
  const glyphs = window.ENTRANCE_GLYPHS;
  if (!entrance || !wordmark || !glyphs) return;

  const root = document.documentElement;
  const stage = entrance.querySelector('.entrance-stage');
  const cover = entrance.querySelector('.entrance-cover');
  const drawing = entrance.querySelector('.entrance-drawing');
  const scrollLink = entrance.querySelector('.entrance-scroll');
  const subtitle = document.createElement('p');
  subtitle.className = 'entrance-subtitle';
  subtitle.textContent = 'Dessiner pour faire et faire pour penser.';
  drawing.after(subtitle);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const namespace = 'http://www.w3.org/2000/svg';
  const sourceName = 'CamilleSardet';
  const targetName = 'CAMILLESARDET';
  let letters = [];
  let distance = 1;
  let lastProgress = -1;
  let dismissed = false;

  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const between = (start, end, value) => ease(clamp((value - start) / (end - start)));
  const place = (contours, at) => contours.map(points => [...points, points[0]].map(([x, y]) => [at.x + x * at.size, at.y - y * at.size]));
  const outline = subpaths => subpaths.map(points => `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`).join('');

  function measure() {
    if (dismissed) return;
    root.classList.add('entrance-ready');
    distance = entrance.getBoundingClientRect().height;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    drawing.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const targetFontSize = parseFloat(getComputedStyle(wordmark).fontSize);
    const tracking = -.04;
    const advance = [...'Camille Sardet'].reduce((sum, character) => sum + glyphs.letters[character].width + tracking, -tracking);
    const sourceFontSize = Math.min(116, width * .84 / advance, height * .16);
    let sourceX = (width - advance * sourceFontSize) / 2;
    const sourceBaseline = height / 2 + .34 * sourceFontSize;
    subtitle.style.top = `${sourceBaseline + .4 * sourceFontSize}px`;
    const ranges = [];
    // The destination comes from the existing H1, including its responsive
    // font size, line breaks, tracking and desktop/mobile alignment.
    for (const node of wordmark.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      for (let character = 0; character < node.length; character++) {
        const range = document.createRange();
        range.setStart(node, character);
        range.setEnd(node, character + 1);
        ranges.push(range.getBoundingClientRect());
      }
    }
    if (ranges.length !== targetName.length) {
      root.classList.remove('entrance-ready', 'entrance-active', 'entrance-finished');
      return;
    }
    letters = [...sourceName].map((character, index) => {
      if (index === 7) sourceX += (glyphs.letters[' '].width + tracking) * sourceFontSize;
      const start = { x: sourceX, y: sourceBaseline, size: sourceFontSize };
      sourceX += (glyphs.letters[character].width + tracking) * sourceFontSize;
      const rect = ranges[index];
      const end = {
        x: rect.left,
        y: rect.top + window.scrollY - distance + glyphs.ascent * targetFontSize,
        size: targetFontSize,
      };
      const sourceContours = place(glyphs.letters[character].contours, start);
      const targetContours = place(glyphs.letters[targetName[index]].contours, end);
      const sourceFill = document.createElementNS(namespace, 'path');
      const targetFill = document.createElementNS(namespace, 'path');
      sourceFill.setAttribute('fill-rule', 'evenodd');
      sourceFill.setAttribute('class', 'entrance-letter');
      targetFill.setAttribute('fill-rule', 'evenodd');
      sourceFill.setAttribute('d', outline(sourceContours));
      targetFill.setAttribute('d', outline(targetContours));
      targetFill.setAttribute('fill', getComputedStyle(wordmark).color);
      return { sourceFill, targetFill };
    });
    drawing.replaceChildren(
      ...letters.map(letter => letter.sourceFill),
      ...letters.map(letter => letter.targetFill),
    );
    lastProgress = -1;
    render();
  }

  // Once scrolled through, the opening is removed for the rest of the visit:
  // scrolling back up leads to the header, never to the cover again.
  function dismiss() {
    dismissed = true;
    // Measure a non-sticky element so the page stays exactly where it was.
    const anchor = document.querySelector('main') || entrance.nextElementSibling;
    const before = anchor.getBoundingClientRect().top;
    root.classList.remove('entrance-ready', 'entrance-active', 'entrance-finished');
    root.classList.add('entrance-dismissed');
    window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: 'instant' });
    window.removeEventListener('scroll', requestRender);
  }

  function render() {
    if (dismissed) return;
    const progress = clamp(window.scrollY / distance);
    if (progress === lastProgress) return;
    lastProgress = progress;
    const finished = progress >= 1;
    root.classList.toggle('entrance-finished', finished);
    root.classList.toggle('entrance-active', !finished && !motionPreference.matches);
    scrollLink.tabIndex = finished ? -1 : 0;
    if (finished) return dismiss();

    // Reduced motion keeps the cover and name, then uses a simple dissolve.
    if (motionPreference.matches) {
      stage.style.opacity = String(1 - between(.08, .7, progress));
      stage.style.backgroundColor = 'var(--paper)';
      cover.style.opacity = '1';
      cover.style.transform = 'none';
    } else {
      stage.style.opacity = '1';
      stage.style.backgroundColor = `rgba(250, 249, 246, ${1 - between(.58, .96, progress)})`;
      cover.style.opacity = String(1 - between(.14, .76, progress));
      cover.style.transform = `translateY(${-progress * 35}px) scale(${1 + progress * .06})`;
    }
    scrollLink.style.opacity = String(1 - between(0, .16, progress));
    scrollLink.style.pointerEvents = progress > .16 ? 'none' : 'auto';
    scrollLink.tabIndex = progress > .16 ? -1 : 0;

    // The name dissolves on the cover, then reappears in place as the title.
    const sourceFill = motionPreference.matches ? 1 : 1 - between(.05, .4, progress);
    const targetFill = motionPreference.matches ? 0 : between(.6, .95, progress);
    subtitle.style.opacity = String(sourceFill);
    letters.forEach(letter => {
      letter.sourceFill.setAttribute('fill', 'white');
      letter.sourceFill.setAttribute('fill-opacity', String(sourceFill));
      letter.targetFill.setAttribute('fill-opacity', String(targetFill));
    });
  }

  function requestRender() {
    // Native scroll events are already coalesced by the browser. Update here
    // so Safari also keeps the drawing in sync in an inactive preview window.
    render();
  }
  function settleAnchor() {
    if (!dismissed && ['#accueil', '#projets', '#contenu'].includes(location.hash)) {
      // scroll-padding must not leave the overlay covering an anchor destination.
      window.scrollTo({ top: Math.max(distance, window.scrollY), behavior: 'instant' });
      requestRender();
    }
  }
  scrollLink.addEventListener('click', event => {
    event.preventDefault();
    window.scrollTo({ top: distance, behavior: motionPreference.matches ? 'instant' : 'smooth' });
  });
  // A hidden title reached by keyboard must never retain an invisible focus.
  document.addEventListener('focusin', event => {
    if (!dismissed && root.classList.contains('entrance-active') && !entrance.contains(event.target) && !event.target.matches('.skip-link')) {
      window.scrollTo({ top: Math.max(distance, window.scrollY), behavior: 'instant' });
      requestRender();
    }
  });
  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', () => { measure(); settleAnchor(); });
  window.addEventListener('hashchange', settleAnchor);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !dismissed) { lastProgress = -1; requestRender(); } });
  motionPreference.addEventListener('change', measure);
  document.fonts.ready.then(() => { measure(); settleAnchor(); });
  measure();
})();
