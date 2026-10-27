'use strict';
const toggle = document.getElementById('toggle');
const status = document.getElementById('status');
async function render() {
  const stored = await chrome.storage.local.get('settings');
  const settings = PopupPrevention.settingsFrom(stored.settings);
  document.getElementById('state').textContent = settings.enabled ? 'Protection is on' : 'Protection is paused';
  toggle.textContent = settings.enabled ? 'Pause protection' : 'Enable protection';
}
toggle.addEventListener('click', async () => {
  try {
    const stored = await chrome.storage.local.get('settings');
    const settings = PopupPrevention.settingsFrom(stored.settings);
    await chrome.storage.local.set({settings: {...settings, enabled: !settings.enabled}});
    await render();
    status.textContent = 'Open pages will pick up the change shortly.';
  } catch (error) { status.textContent = error.message; }
});
document.getElementById('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
void render().catch(error => { status.textContent = error.message; });
