'use strict';
const engine = globalThis.PopupPrevention;
const form = document.getElementById('settings');
const status = document.getElementById('status');
const listStatus = document.getElementById('list-status');
const updateButton = document.getElementById('update');
function renderStatus(stored) {
  const list = stored.subscription;
  const result = stored.updateStatus;
  listStatus.textContent = list
    ? `${list.domains.length.toLocaleString()} downloaded domains. Last updated ${new Date(list.updatedAt).toLocaleString()}.`
    : 'Using the bundled HaGeZi list until the first successful update.';
  if (result?.ok === false) listStatus.textContent += ' Update failed: ' + result.error;
}
async function load() {
  const stored = await chrome.storage.local.get(['settings', 'subscription', 'updateStatus']);
  const settings = engine.settingsFrom(stored.settings);
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'boolean') form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
  renderStatus(stored);
}
async function save() {
  const input = {};
  for (const [key, value] of Object.entries(engine.DEFAULTS)) {
    const element = form.elements[key];
    input[key] = typeof value === 'boolean' ? element.checked : element.value.trim();
  }
  const settings = engine.settingsFrom(input);
  await chrome.storage.local.set({settings});
  return settings;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  try { await save(); status.textContent = 'Saved. Open pages will pick up the change shortly.'; }
  catch (error) { status.textContent = 'Could not save: ' + error.message; }
});
updateButton.addEventListener('click', async () => {
  updateButton.disabled = true;
  try {
    await save();
    status.textContent = 'Updating list…';
    const result = await chrome.runtime.sendMessage({type: 'update-list'});
    status.textContent = result.ok ? `Updated ${result.count.toLocaleString()} domains.` : 'Update failed: ' + result.error;
    renderStatus(await chrome.storage.local.get(['subscription', 'updateStatus']));
  } catch (error) { status.textContent = error.message; }
  finally { updateButton.disabled = false; }
});
void load().catch(error => { status.textContent = error.message; });
