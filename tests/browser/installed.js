document.getElementById('ad').addEventListener('click', () => {
  const result = window.open('https://popup-ad.example/', '_blank');
  document.getElementById('results').textContent = result === null
    ? 'Returned null. Confirm no tab appeared and the legitimate control still works.'
    : 'A window was returned. Check extension installation, custom domain and exceptions.';
});
document.getElementById('legitimate').addEventListener('click', () => {
  const result = window.open('about:blank', '_blank');
  document.getElementById('results').textContent = result === null
    ? 'Blank window was blocked (expected only with blank blocking, strict mode, or browser popup blocking).'
    : 'Blank window opened. Close it manually.';
});
