document.getElementById('save').addEventListener('click', () => {
  const activity = document.getElementById('activity').value;
  const timestamp = new Date().toISOString();
  chrome.storage.local.get({ logs: [] }, (result) => {
    const logs = result.logs;
    logs.push({ time: timestamp, activity });
    chrome.storage.local.set({ logs }, () => {
      document.getElementById('status').textContent = 'Saved!';
      setTimeout(() => document.getElementById('status').textContent = '', 1500);
      document.getElementById('activity').value = '';
    });
  });
});