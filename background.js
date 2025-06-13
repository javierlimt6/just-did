// Background service worker for JustDid extension
let timerState = {
  isRunning: false,
  startTime: null,
  duration: 15, // default 15 minutes
  alarmName: 'justDidTimer'
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('JustDid extension installed');
  // Initialize storage if needed
  chrome.storage.local.get(['logs', 'timerState'], (result) => {
    if (!result.logs) {
      chrome.storage.local.set({ logs: [] });
    }
    if (!result.timerState) {
      chrome.storage.local.set({ timerState: timerState });
    }
  });
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startTimer':
      startTimer(message.duration);
      sendResponse({ success: true });
      break;
    case 'getTimerState':
      getTimerState(sendResponse);
      return true; // Keep message channel open for async response
    case 'stopTimer':
      stopTimer();
      sendResponse({ success: true });
      break;
    case 'getBrowserHistory':
      getBrowserHistory(message.minutes || 15, sendResponse);
      return true; // Keep message channel open for async response
  }
});

function startTimer(duration) {
  const now = Date.now();
  timerState = {
    isRunning: true,
    startTime: now,
    duration: duration,
    alarmName: 'justDidTimer'
  };

  // Save timer state
  chrome.storage.local.set({ timerState });

  // Create alarm
  chrome.alarms.create('justDidTimer', {
    when: now + (duration * 60 * 1000) // duration in minutes
  });

  console.log(`Timer started for ${duration} minutes`);
}

function stopTimer() {
  chrome.alarms.clear('justDidTimer');
  timerState.isRunning = false;
  chrome.storage.local.set({ timerState });
  console.log('Timer stopped');
}

function getTimerState(callback) {
  chrome.storage.local.get(['timerState'], (result) => {
    const state = result.timerState || timerState;
    if (state.isRunning && state.startTime) {
      const elapsed = Date.now() - state.startTime;
      const remaining = Math.max(0, (state.duration * 60 * 1000) - elapsed);
      callback({
        isRunning: state.isRunning,
        remaining: remaining,
        duration: state.duration
      });
    } else {
      callback({ isRunning: false });
    }
  });
}

// Handle alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'justDidTimer') {
    console.log('Timer alarm triggered');
    timerState.isRunning = false;
    chrome.storage.local.set({ timerState });

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'JustDid - Time for Reflection!',
      message: 'What did you just accomplish? Click to log your activity.',
      buttons: [{ title: 'Log Activity' }]
    });

    // Open popup (if possible)
    chrome.action.openPopup().catch(() => {
      // Fallback if popup can't be opened
      console.log('Could not open popup automatically');
    });
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.action.openPopup();
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // Log Activity button
    chrome.action.openPopup();
  }
  chrome.notifications.clear(notificationId);
});

async function getBrowserHistory(minutes, callback) {
  try {
    const endTime = Date.now();
    const startTime = endTime - (minutes * 60 * 1000);

    const historyItems = await chrome.history.search({
      text: '',
      startTime: startTime,
      endTime: endTime,
      maxResults: 50
    });

    // Filter and format history items
    const formattedHistory = historyItems
      .filter(item => item.visitCount > 0)
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
      .slice(0, 10)
      .map(item => ({
        title: item.title || 'Untitled',
        url: item.url,
        visitTime: new Date(item.lastVisitTime).toLocaleTimeString(),
        domain: new URL(item.url).hostname
      }));

    callback(formattedHistory);
  } catch (error) {
    console.error('Error fetching browser history:', error);
    callback([]);
  }
}