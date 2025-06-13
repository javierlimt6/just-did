chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('activityPrompt', { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'activityPrompt') {
    chrome.action.openPopup();
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Activity Log Reminder',
      message: 'What did you do in the last 15 minutes? Click the extension to record.'
    });
  }
});