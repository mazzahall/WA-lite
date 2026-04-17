class LINEApp {
    constructor() {
        this.currentUser = localStorage.getItem('lineCurrentUser') || 'You';
        this.userStatus = localStorage.getItem('lineUserStatus') || '● Online';
        this.friends = JSON.parse(localStorage.getItem('lineFriends')) || [];
        this.messages = JSON.parse(localStorage.getItem('lineMessages')) || {};
        this.currentChatFriend = null;
        this.init();
    }

    init() {
        this.updateProfile();
        this.renderFriends();
        this.setupEventListeners();
        this.loadTab('friends');
    }

    setupEventListeners() {
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchFriends(e.target.value);
        });

        // Global save
        window.addEventListener('beforeunload', () => this.saveAllData());
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.loadTab(tabName);
            });
        });
    }

    updateProfile() {
        document.getElementById('currentUser').textContent = this.currentUser;
        document.querySelector('.profile-status').textContent = this.userStatus;
        document.getElementById('profileImg').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser)}&size=44&background=00c300&color=fff`;
    }

    // === FRIEND MANAGEMENT ===
    addNewFriend() {
        const name = document.getElementById('newFriendName').value.trim();
        const id = document.getElementById('friendId').value.trim();
        const isGroup = document.getElementById('isGroup').checked;
        const avatarFile = document.getElementById('friendAvatar').files[0];

        if (!name) {
            this.showNotification('Nama teman tidak boleh kosong!', 'error');
            return;
        }

        if (this.friends.find(f => f.name.toLowerCase() === name.toLowerCase())) {
            this.showNotification('Teman sudah ada!', 'error');
            return;
        }

        const friend = {
            id: id || `friend_${Date.now()}`,
            name: name,
            avatar: avatarFile ? URL.createObjectURL(avatarFile) : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=56&background=${this.randomColor()}&color=fff`,
            status: '● Online',
            isGroup: isGroup,
            lastMessage: '',
            lastTime: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
            unreadCount: 0,
            timestamp: Date.now()
        };

        this.friends.push(friend);
        this.messages[friend.name] = [];
        this.saveAllData();
        this.renderFriends();
        this.closeNewChat();
        this.showNotification(`Teman ${name} berhasil ditambahkan!`, 'success');
        
        // Reset form
        document.getElementById('newFriendName').value = '';
        document.getElementById('friendId').value = '';
        document.getElementById('friendAvatar').value = '';
        document.getElementById('isGroup').checked = false;
    }

    changeProfile() {
        document.getElementById('editUserName').value = this.currentUser;
        document.getElementById('editStatus').value = this.userStatus;
        document.getElementById('editProfileModal').style.display = 'flex';
    }

    saveProfile() {
        this.currentUser = document.getElementById('editUserName').value || 'You';
        this.userStatus = document.getElementById('editStatus').value;
        this.updateProfile();
        this.saveAllData();
        this.closeEditProfile();
        this.showNotification('Profil berhasil diupdate!', 'success');
    }

    // === CHAT FUNCTIONALITY ===
    openChat(friendName) {
        this.currentChatFriend = friendName;
        this.renderFriends();
        this.renderChat();
        this.scrollToBottom();
    }

    renderFriends() {
        const container = document.getElementById('contactsList');
        
        if (this.friends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <h3>Tambahkan teman baru</h3>
                    <p>Klik ikon + untuk menambahkan teman chat</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.friends
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(friend => {
                const isActive = this.currentChatFriend === friend.name;
                const messages = this.messages[friend.name] || [];
                const unreadCount = friend.unreadCount || messages.filter(m => m.sender !== this.currentUser && !m.read).length;
                
                return `
                    <div class="contact-item ${isActive ? 'active' : ''}" onclick="lineApp.openChat('${friend.name}')">
                        <div class="contact-avatar">
                            <img src="${friend.avatar}" alt="${friend.name}">
                            <div class="status-online"></div>
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${friend.name}</div>
                            <div class="contact-last-message">${friend.lastMessage || 'Belum ada pesan'}</div>
                        </div>
                        ${unreadCount > 0 ? `<div class="unread-count">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
                        <div class="contact-time">${friend.lastTime}</div>
                    </div>
                `;
            }).join('');
    }

    renderChat() {
        const mainChat = document.getElementById('mainChat');
        
        if (!this.currentChatFriend) {
            mainChat.innerHTML = `
                <div class="welcome-screen">
                    <div class="welcome-content">
                        <img src="https://via.placeholder.com/100x100/00c300/FFFFFF?text=LINE" alt="LINE" class="welcome-logo">
                        <h1>LINE</h1>
                        <h2>Pilih teman untuk memulai chat</h2>
                        <div class="quick-actions">
                            <button class="quick-btn primary" onclick="showNewChat()">
                                <i class="fas fa-plus"></i> Tambah Teman
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const friend = this.friends.find(f => f.name === this.currentChatFriend);
        const chatHeader = `
            <div class="chat-header">
                <div class="profile-section">
                    <img src="${friend.avatar}" alt="${friend.name}" class="profile-img">
                    <div class="profile-info">
                        <div class="profile-name">${friend.name}</div>
                        <div class="profile-status">${friend.status}</div>
                    </div>
                </div>
                <div class="chat-actions">
                    <i class="fas fa-phone"></i>
                    <i class="fas fa-video"></i>
                    <i class="fas fa-ellipsis-vertical"></i>
                </div>
            </div>
        `;

        const messagesContainer = `
            <div class="messages-container" id="messagesContainer">
                ${this.renderMessages()}
            </div>
            <div class="message-input">
                <div class="message-input-container">
                    <i class="fas fa-smile"></i>
                    <input type="text" id="messageInput" placeholder="Ketik pesan...">
                    <i class="fas fa-camera"></i>
                    <i class="fas fa-paperclip"></i>
                </div>
                <button class="send-btn" onclick="lineApp.sendMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        mainChat.innerHTML = chatHeader + messagesContainer;
        
        // Event listeners
        const input = document.getElementById('messageInput');
        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        input.addEventListener('input', () => {
            // Typing indicator
            const friendIndex = this.friends.findIndex(f => f.name === this.currentChatFriend);
            if (friendIndex !== -1) {
                this.friends[friendIndex].status = '● Mengetik...';
                this.renderFriends();
            }
        });
    }

    renderMessages() {
        if (!this.currentChatFriend) return '';
        
        const messages = this.messages[this.currentChatFriend] || [];
        return messages.map(msg => {
            const isSent = msg.sender === this.currentUser;
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    ${msg.text}
                    <div class="message-time">${this.formatTime(msg.timestamp)}</div>
                    ${isSent ? '<i class="fas fa-check-double"></i>' : ''}
                </div>
            `;
        }).join('');
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text || !this.currentChatFriend) return;

        const message = {
            text,
            sender: this.currentUser,
            timestamp: new Date().toISOString(),
            read: false
        };

        if (!this.messages[this.currentChatFriend]) {
            this.messages[this.currentChatFriend] = [];
        }
        
        this.messages[this.currentChatFriend].push(message);
        
        // Update friend info
        const friendIndex = this.friends.findIndex(f => f.name === this.currentChatFriend);
        if (friendIndex !== -1) {
            this.friends[friendIndex].lastMessage = text.length > 20 ? text.substring(0, 20) + '...' : text;
            this.friends[friendIndex].lastTime = this.formatTime();
            this.friends[friendIndex].timestamp = Date.now();
            this.friends[friendIndex].status = '● Online';
        }

        input.value = '';
        this.renderChat();
        this.scrollToBottom();
        this.saveAllData();
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }

    // === UTILITY FUNCTIONS ===
    searchFriends(query) {
        const items = document.querySelectorAll('.contact-item');
        items.forEach(item => {
            const name = item.querySelector('.contact-name').textContent.toLowerCase();
            item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
        });
    }

    loadTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Filter friends (Friends vs Groups)
        const filteredFriends = tabName === 'groups' 
            ? this.friends.filter(f => f.isGroup)
            : this.friends.filter(f => !f.isGroup);
        
        // Temporary render logic for groups
        const container = document.getElementById('contactsList');
        if (filteredFriends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${tabName === 'groups' ? 'user-friends' : 'user-plus'}"></i>
                    <h3>${tabName === 'groups' ? 'Belum ada grup' : 'Belum ada teman'}</h3>
                    <p>${tabName === 'groups' ? 'Buat grup chat baru' : 'Tambahkan teman baru'}</p>
                </div>
            `;
        } else {
            this.renderFriends(); // Simplified for now
        }
    }

    formatTime(timestamp = null) {
        const date = timestamp ? new Date(timestamp) : new Date();
        return date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    randomColor() {
        const colors = ['00c300', 'ff6600', 'ffcc00', '9933ff', '00ccff', 'ff3399'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // === MODAL FUNCTIONS ===
    showNewChat() {
        document.getElementById('addFriendModal').style.display = 'flex';
        document.getElementById('newFriendName').focus();
    }

    closeNewChat() {
        document.getElementById('addFriendModal').style.display = 'none';
    }

    changeProfile() {
        document.getElementById('editProfileModal').style.display = 'flex';
    }

    closeEditProfile() {
        document.getElementById('editProfileModal').style.display = 'none';
    }

    showUserList() {
        this.renderFriendList();
        document.getElementById('friendListModal').style.display = 'flex';
    }

    closeFriendList() {
        document.getElementById('friendListModal').style.display = 'none';
    }

    renderFriendList() {
        const container = document.getElementById('friendListContent');
        container.innerHTML = this.friends.map(friend => `
            <div class="friend-item">
                <img src="${friend.avatar}" alt="${friend.name}" class="friend-avatar">
                <div class="friend-info">
                    <div class="friend-name">${friend.name}</div>
                    <div class="friend-id">${friend.id}</div>
                </div>
                <div class="friend-status">${friend.status}</div>
            </div>
        `).join('');
    }

    // === DATA MANAGEMENT ===
    saveAllData() {
        localStorage.setItem('lineCurrentUser', this.currentUser);
        localStorage.setItem('lineUserStatus', this.userStatus);
        localStorage.setItem('lineFriends', JSON.stringify(this.friends));
        localStorage.setItem('lineMessages', JSON.stringify(this.messages));
    }

    clearAllChats() {
        if (confirm('Hapus semua chat? Pesan akan hilang permanen.')) {
            Object.keys(this.messages).forEach(key => {
                this.messages[key] = [];
            });
            this.friends.forEach(friend => {
                friend.unreadCount = 0;
                friend.lastMessage = '';
            });
            this.saveAllData();
            if (this.currentChatFriend) {
                this.renderChat();
            }
            this.showNotification('Semua chat dihapus!', 'success');
        }
    }

    clearAllData() {
        if (confirm('RESET SEMUA DATA? Semua teman dan chat akan hilang!')) {
            localStorage.clear();
            location.reload();
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#00c300' : '#ff4444'};
            color: white;
            padding: 16px 24px;
            border-radius: 25px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// Global functions
const lineApp = new LINEApp();

function openMobileMenu() {
    document.getElementById('sidebar').style.transform = 'translateX(0)';
    document.getElementById('mobileOverlay').style.display = 'block';
}

function closeMobileMenu() {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
    document.getElementById('mobileOverlay').style.display = 'none';
}

function focusSearch() {
    document.getElementById('searchInput').focus();
}

function showNewChat() {
    lineApp.showNewChat();
}

function closeNewChat() {
    lineApp.closeNewChat();
}

function showUserList() {
    lineApp.showUserList();
}

function closeFriendList() {
    lineApp.closeFriendList();
}

function closeEditProfile() {
    lineApp.closeEditProfile();
}

// Auto-focus message input
document.addEventListener('click', function(e) {
    if (e.target.closest('.message-input input')) {
        e.target.focus();
    }
});

// Responsive sidebar
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar').style.transform = 'translateX(0)';
        document.getElementById('mobileOverlay').style.display = 'none';
    }
});