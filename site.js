/* Shared progressive enhancements. Mathematical widgets own their original scripts. */
(() => {
  const mobile = window.matchMedia('(max-width: 900px)');
  const disclosures = document.querySelectorAll('.hp-toc-details');
  function setTocLayout() { disclosures.forEach(toc => { toc.open = !mobile.matches; }); }
  setTocLayout();
  mobile.addEventListener('change', setTocLayout);
  disclosures.forEach(toc => toc.addEventListener('click', event => {
    if (mobile.matches && event.target.closest('a')) toc.open = false;
  }));
  // Keep the existing topic filtering code; expose its current state to assistive technology.
  document.querySelectorAll('.filter-btn').forEach(button => {
    const update = () => button.setAttribute('aria-pressed', String(button.classList.contains('is-active')));
    update();
    new MutationObserver(update).observe(button, {attributes: true, attributeFilter: ['class']});
  });
})();
