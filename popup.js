// JustDid Extension - Main Popup Logic
class JustDidApp {
    constructor() {
        this.currentView = 'landing';
        this.timerInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkTimerState();
        this.updateSliderValue();
    }

    setupEventListeners() {
        // Timer slider
        const timerSlider = document.getElementById('timer-slider');
        const timerValue = document.getElementById('timer-value');

        timerSlider.addEventListener('input', (e) => {
            timerValue.textContent = e.target.value;
        });

        // Landing view buttons
        document.getElementById('start-timer-btn').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('show-history-btn').addEventListener('click', () => {
            this.showHistory();
        });

        // Timer view buttons
        document.getElementById('show-history-timer-btn').addEventListener('click', () => {
            this.showHistory();
        });

        document.getElementById('stop-timer-btn').addEventListener('click', () => {
            this.stopTimer();
        });

        // Task entry buttons
        document.getElementById('ai-suggest-btn').addEventListener('click', () => {
            this.generateAISummary();
        });

        document.getElementById('record-and-history-btn').addEventListener('click', () => {
            this.recordTaskAndShowHistory();
        });

        document.getElementById('record-and-continue-btn').addEventListener('click', () => {
            this.recordTaskAndContinue();
        });

        // History view buttons
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showLanding();
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportData('json');
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            this.exportData('csv');
        });

        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            this.exportData('pdf');
        });
    }

    updateSliderValue() {
        const slider = document.getElementById('timer-slider');
        const value = document.getElementById('timer-value');
        value.textContent = slider.value;
    }

    async checkTimerState() {
        try {
            const response = await this.sendMessage({ action: 'getTimerState' });
            if (response.isRunning) {
                this.showTimerRunning(response.remaining, response.duration);
            } else {
                // Check if we just finished a timer (show confetti view)
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('timerComplete') === 'true') {
                    this.showTaskEntry();
                } else {
                    this.showLanding();
                }
            }
        } catch (error) {
            console.error('Error checking timer state:', error);
            this.showLanding();
        }
    }

    async startTimer() {
        const duration = parseInt(document.getElementById('timer-slider').value);
        try {
            await this.sendMessage({ action: 'startTimer', duration });
            this.showTimerRunning(duration * 60 * 1000, duration);
            window.close(); // Close popup after starting timer
        } catch (error) {
            console.error('Error starting timer:', error);
        }
    }

    async stopTimer() {
        try {
            await this.sendMessage({ action: 'stopTimer' });
            this.showLanding();
        } catch (error) {
            console.error('Error stopping timer:', error);
        }
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
            this.currentView = viewName;
        }
    }

    showLanding() {
        this.showView('landing');
    }

    showTimerRunning(remainingMs, totalDuration) {
        this.showView('timer');
        this.startTimerDisplay(remainingMs, totalDuration);
    }

    showTaskEntry() {
        this.showView('task-entry');
        this.showConfetti();
        this.loadBrowserHistory();
        document.getElementById('task-input').focus();
    }

    async showHistory() {
        this.showView('history');
        await this.loadActivityHistory();
    }

    startTimerDisplay(remainingMs, totalDuration) {
        const remainingTimeEl = document.getElementById('remaining-time');
        const progressFillEl = document.getElementById('progress-fill');

        const updateDisplay = () => {
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            remainingTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const progress = ((totalDuration * 60 * 1000 - remainingMs) / (totalDuration * 60 * 1000)) * 100;
            progressFillEl.style.width = `${progress}%`;

            remainingMs -= 1000;

            if (remainingMs < 0) {
                clearInterval(this.timerInterval);
                this.showTaskEntry();
            }
        };

        updateDisplay();
        this.timerInterval = setInterval(updateDisplay, 1000);
    }

    showConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            container.appendChild(confetti);
        }

        setTimeout(() => {
            container.innerHTML = '';
        }, 4000);
    }

    async loadBrowserHistory() {
        try {
            const history = await this.sendMessage({ action: 'getBrowserHistory', minutes: 15 });
            const historyList = document.getElementById('browser-history-list');

            if (history.length === 0) {
                historyList.innerHTML = '<div class="history-item">No recent browser activity found</div>';
                return;
            }

            historyList.innerHTML = history.map(item => `
                <div class="history-item">
                    <div class="history-item-title">${this.escapeHtml(item.title)}</div>
                    <div class="history-item-meta">${item.domain} â€¢ ${item.visitTime}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading browser history:', error);
            document.getElementById('browser-history-list').innerHTML = 
                '<div class="history-item">Unable to load browser history</div>';
        }
    }

    async generateAISummary() {
        const button = document.getElementById('ai-suggest-btn');
        const taskInput = document.getElementById('task-input');

        button.textContent = 'â³';
        button.disabled = true;

        try {
            const history = await this.sendMessage({ action: 'getBrowserHistory', minutes: 15 });
            const summary = this.generateSummaryFromHistory(history);
            taskInput.value = summary;
        } catch (error) {
            console.error('Error generating summary:', error);
            taskInput.value = 'Focused work session';
        } finally {
            button.innerHTML = '<span class="icon">âœ¨</span>';
            button.disabled = false;
        }
    }

    generateSummaryFromHistory(history) {
        if (history.length === 0) return 'Focused work session';

        // Simple algorithm to generate summary from browser history
        const domains = [...new Set(history.map(item => item.domain))];
        const titles = history.map(item => item.title.toLowerCase());

        // Common work-related keywords
        const workKeywords = ['github', 'stackoverflow', 'docs', 'documentation', 'coding', 'development', 'programming'];
        const socialKeywords = ['twitter', 'facebook', 'linkedin', 'social'];
        const productivityKeywords = ['email', 'calendar', 'notion', 'trello', 'slack'];

        if (domains.some(domain => workKeywords.some(keyword => domain.includes(keyword)))) {
            return 'Coding and development work';
        } else if (domains.some(domain => socialKeywords.some(keyword => domain.includes(keyword)))) {
            return 'Social media browsing';
        } else if (domains.some(domain => productivityKeywords.some(keyword => domain.includes(keyword)))) {
            return 'Productivity and planning';
        } else if (domains.length === 1) {
            return `Worked on ${domains[0]}`;
        } else {
            return `Research and browsing (${domains.length} sites)`;
        }
    }

    async recordTaskAndShowHistory() {
        await this.recordTask();
        this.showHistory();
    }

    async recordTaskAndContinue() {
        await this.recordTask();
        this.showLanding();
    }

    async recordTask() {
        const taskText = document.getElementById('task-input').value.trim();
        if (!taskText) return;

        const now = new Date();
        const task = {
            id: Date.now(),
            text: taskText,
            timestamp: now.toISOString(),
            date: now.toDateString(),
            time: now.toLocaleTimeString()
        };

        try {
            const result = await chrome.storage.local.get(['logs']);
            const logs = result.logs || [];
            logs.push(task);
            await chrome.storage.local.set({ logs });

            // Clear the input
            document.getElementById('task-input').value = '';
        } catch (error) {
            console.error('Error saving task:', error);
        }
    }

    async loadActivityHistory() {
        try {
            const result = await chrome.storage.local.get(['logs']);
            const logs = result.logs || [];
            const historyList = document.getElementById('history-list');
            const emptyState = document.getElementById('empty-history');

            if (logs.length === 0) {
                historyList.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            historyList.classList.remove('hidden');
            emptyState.classList.add('hidden');

            // Group logs by date
            const groupedLogs = this.groupLogsByDate(logs);

            historyList.innerHTML = Object.entries(groupedLogs)
                .sort(([a], [b]) => new Date(b) - new Date(a))
                .map(([date, entries]) => `
                    <div class="date-group">
                        <h3 class="date-header">${this.formatDate(date)}</h3>
                        ${entries.map(entry => `
                            <div class="activity-entry">
                                <div class="activity-time">${entry.time}</div>
                                <div class="activity-text">${this.escapeHtml(entry.text)}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('');
        } catch (error) {
            console.error('Error loading activity history:', error);
        }
    }

    groupLogsByDate(logs) {
        return logs.reduce((groups, log) => {
            const date = log.date;
            if (!groups[date]) groups[date] = [];
            groups[date].push(log);
            return groups;
        }, {});
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString();
    }

    async exportData(format) {
        try {
            const result = await chrome.storage.local.get(['logs']);
            const logs = result.logs || [];

            if (logs.length === 0) {
                alert('No data to export!');
                return;
            }

            switch (format) {
                case 'json':
                    this.downloadJSON(logs);
                    break;
                case 'csv':
                    this.downloadCSV(logs);
                    break;
                case 'pdf':
                    this.downloadPDF(logs);
                    break;
            }
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    }

    downloadJSON(logs) {
        const data = JSON.stringify(logs, null, 2);
        this.downloadFile(data, 'justdid-log.json', 'application/json');
    }

    downloadCSV(logs) {
        const headers = ['Date', 'Time', 'Activity'];
        const rows = logs.map(log => [
            log.date,
            log.time,
            `"${log.text.replace(/"/g, '""')}"`
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        this.downloadFile(csv, 'justdid-log.csv', 'text/csv');
    }

    downloadPDF(logs) {
        // Simple text-based PDF alternative (would need jsPDF library for actual PDF)
        const content = `JustDid Activity Log\n\n${logs.map(log => 
            `${log.date} ${log.time}\n${log.text}\n`
        ).join('\n')}`;

        this.downloadFile(content, 'justdid-log.txt', 'text/plain');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new JustDidApp();
});