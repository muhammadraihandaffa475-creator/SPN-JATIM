// SPN POLDA JATIM - Advanced Notification System
// Real-time notifications with WebSocket simulation and local notifications

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.listeners = new Set();
        this.permissionGranted = false;
        this.init();
    }

    async init() {
        // Request notification permission
        if ('Notification' in window) {
            this.permissionGranted = Notification.permission === 'granted';
            if (Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    this.permissionGranted = permission === 'granted';
                } catch (error) {
                    console.warn('Notification permission request failed:', error);
                }
            }
        }

        // Load existing notifications from database
        await this.loadNotifications();

        // Start real-time simulation
        this.startRealTimeUpdates();

        console.log('✅ Notification system initialized');
    }

    // Add notification listener
    addListener(callback) {
        this.listeners.add(callback);
    }

    // Remove notification listener
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    // Notify all listeners
    notifyListeners(notification) {
        this.listeners.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error('Notification listener error:', error);
            }
        });
    }

    // Create notification
    async createNotification(data) {
        const notification = {
            id: Date.now() + Math.random(),
            title: data.title || 'Notification',
            message: data.message || '',
            type: data.type || 'info', // success, error, warning, info
            icon: data.icon || this.getIconForType(data.type),
            timestamp: new Date().toISOString(),
            read: false,
            persistent: data.persistent || false,
            actions: data.actions || [],
            data: data.data || {},
            autoClose: data.autoClose !== false, // Default true
            duration: data.duration || 5000
        };

        // Add to notifications array
        this.notifications.unshift(notification);

        // Save to database
        await spnDB.saveData('notifications', notification);

        // Show browser notification if permission granted
        if (this.permissionGranted && !document.hasFocus()) {
            this.showBrowserNotification(notification);
        }

        // Show in-app notification
        this.showInAppNotification(notification);

        // Notify listeners
        this.notifyListeners(notification);

        // Auto-close if specified
        if (notification.autoClose && notification.duration > 0) {
            setTimeout(() => {
                this.markAsRead(notification.id);
            }, notification.duration);
        }

        return notification;
    }

    // Show browser notification
    showBrowserNotification(notification) {
        const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: notification.icon,
            badge: '/favicon.ico',
            tag: `spn-${notification.id}`,
            requireInteraction: notification.persistent,
            silent: false
        });

        browserNotification.onclick = () => {
            window.focus();
            this.markAsRead(notification.id);
            browserNotification.close();
        };

        // Auto-close browser notification
        if (!notification.persistent) {
            setTimeout(() => {
                browserNotification.close();
            }, 5000);
        }
    }

    // Show in-app notification
    showInAppNotification(notification) {
        // Create notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.type}`;
        notificationEl.setAttribute('data-id', notification.id);
        notificationEl.innerHTML = `
            <div class="notification-icon">
                <i class="${notification.icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                ${notification.actions.length > 0 ? `
                    <div class="notification-actions">
                        ${notification.actions.map(action => `
                            <button class="notification-action" data-action="${action.id}">${action.label}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <button class="notification-close" aria-label="Close notification">
                <i class="fa-solid fa-times"></i>
            </button>
        `;

        // Add event listeners
        const closeBtn = notificationEl.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.markAsRead(notification.id);
        });

        // Add action listeners
        notification.actions.forEach(action => {
            const actionBtn = notificationEl.querySelector(`[data-action="${action.id}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    if (action.callback) {
                        action.callback(notification);
                    }
                    this.markAsRead(notification.id);
                });
            }
        });

        // Add to notification container
        this.addToContainer(notificationEl);

        // Animate in
        setTimeout(() => {
            notificationEl.classList.add('show');
        }, 100);
    }

    // Add notification to container
    addToContainer(notificationEl) {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        container.appendChild(notificationEl);
    }

    // Mark notification as read
    async markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            await spnDB.saveData('notifications', notification);

            // Animate out
            const notificationEl = document.querySelector(`[data-id="${id}"]`);
            if (notificationEl) {
                notificationEl.classList.remove('show');
                setTimeout(() => {
                    notificationEl.remove();
                }, 300);
            }

            this.notifyListeners({ type: 'read', notification });
        }
    }

    // Mark all as read
    async markAllAsRead() {
        const unreadNotifications = this.notifications.filter(n => !n.read);
        for (const notification of unreadNotifications) {
            await this.markAsRead(notification.id);
        }
    }

    // Get notifications
    getNotifications(filter = {}) {
        let notifications = [...this.notifications];

        if (filter.read !== undefined) {
            notifications = notifications.filter(n => n.read === filter.read);
        }

        if (filter.type) {
            notifications = notifications.filter(n => n.type === filter.type);
        }

        if (filter.limit) {
            notifications = notifications.slice(0, filter.limit);
        }

        return notifications;
    }

    // Get unread count
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    // Load notifications from database
    async loadNotifications() {
        try {
            const savedNotifications = await spnDB.getData('notifications') || [];
            this.notifications = savedNotifications.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.error('Failed to load notifications:', error);
            this.notifications = [];
        }
    }

    // Start real-time updates simulation
    startRealTimeUpdates() {
        // Simulate real-time updates every 30 seconds
        setInterval(() => {
            this.simulateRealTimeUpdate();
        }, 30000);

        // Listen for storage changes (for multi-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'spn_notifications_update') {
                this.loadNotifications();
                this.notifyListeners({ type: 'sync' });
            }
        });
    }

    // Simulate real-time updates
    async simulateRealTimeUpdate() {
        const activities = [
            {
                title: 'File Upload Completed',
                message: 'Dokumen pengadaan berhasil diupload',
                type: 'success',
                icon: 'fa-solid fa-check-circle'
            },
            {
                title: 'New Spreadsheet Data',
                message: 'Data spreadsheet baru telah diimport',
                type: 'info',
                icon: 'fa-solid fa-file-spreadsheet'
            },
            {
                title: 'System Backup',
                message: 'Backup otomatis telah selesai',
                type: 'info',
                icon: 'fa-solid fa-shield-alt'
            },
            {
                title: 'High Activity Detected',
                message: 'Aktivitas pengguna meningkat signifikan',
                type: 'warning',
                icon: 'fa-solid fa-chart-line'
            }
        ];

        // Random chance to show notification (20%)
        if (Math.random() < 0.2) {
            const activity = activities[Math.floor(Math.random() * activities.length)];
            await this.createNotification(activity);
        }
    }

    // Get icon for notification type
    getIconForType(type) {
        const icons = {
            success: 'fa-solid fa-check-circle',
            error: 'fa-solid fa-exclamation-triangle',
            warning: 'fa-solid fa-exclamation-circle',
            info: 'fa-solid fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    // Clear old notifications (keep last 100)
    async cleanup() {
        if (this.notifications.length > 100) {
            const toDelete = this.notifications.slice(100);
            this.notifications = this.notifications.slice(0, 100);

            for (const notification of toDelete) {
                await spnDB.deleteData('notifications', notification.id);
            }
        }
    }

    // Export notifications
    async exportNotifications() {
        const data = {
            notifications: this.notifications,
            exportedAt: new Date().toISOString(),
            total: this.notifications.length,
            unread: this.getUnreadCount()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notifications_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return data;
    }
}

// Global notification system instance
const notificationSystem = new NotificationSystem();

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationSystem.init().catch(console.error);
    });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}
