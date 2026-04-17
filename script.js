const lineApp = {
  friends: [],
  currentChat: null,

  init() {
    this.loadData();
    this.setupEventListeners();
  },

  loadData() {
    const data = localStorage.getItem('lineAppData');
    if (data) {
      const parsed = JSON.parse(data);
      this.friends = parsed.friends || [];
      this.renderContacts();
    }
  },

  saveData() {
    localStorage.setItem('lineAppData', JSON.stringify({
      friends: this.friends
    }));
  },

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterContacts(e.target.value);
    });
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
    document.querySelector('.send-btn').addEventListener('click', () => {
      this.sendMessage();
    });
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });
  },

  addNewFriend() {
    const name = document.getElementById('newFriendName').value;
    const id = document.getElementById('friendId').value;
    if (name && id) {
      const friend = {
        name,
        id,
        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&size=56&background=00c300&color=fff',
        messages: [],
        lastMessage: '',
        time: new Date().toLocaleTimeString()
      };
      this.friends.push(friend);
      this.saveData();
      this.renderContacts();
      this.closeModal('addFriendModal');
      document.getElementById('newFriendName').value = '';
      document.getElementById('friendId').value = '';
    }
  },

  renderContacts() {
    const list = document.getElementById('contactsList');
    if (this.friends.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <i class="fas fa-user-plus"></i>
        <h3>Tambahkan teman baru</h3>
        <p>Klik ikon + untuk menambahkan teman chat</p>
      </div>`;
    } else {
      list.innerHTML = this.friends.map(friend => `
        <div class="contact-item" onclick="lineApp.openChat('${friend.id}')">
          <div class="contact-avatar">
            <img src="${friend.avatar}" alt="${friend.name}">
            <div class="status-online"></div>
          </div>
          <div class="contact-info">
            <div class="contact-name">${friend.name}</div>
            <div class="contact-last-message">${friend.lastMessage || 'Belum ada pesan'}</div>
          </div>
          <div class="contact-time">${friend.time}</div>
        </div>
      `).join('');
    }
  },

  openChat(friendId) {
    const friend = this.friends.find(f => f.id === friendId);
    if (friend) {
      this.currentChat = friend;
      this.renderChat();
      document.querySelector('.welcome-screen').style.display = 'none';
      document.querySelector('.chat-header').style.display = 'flex';
      document.querySelector('.message-input').style.display = 'flex';
    }
  },

  renderChat() {
    if (!this.currentChat) return;
    const header = document.querySelector('.chat-header');
    header.innerHTML = `
      <img src="${this.currentChat.avatar}" alt="${this.currentChat.name}" class="contact-avatar">
      <div class="contact-info">
        <div class="contact-name">${this.currentChat.name}</div>
        <div class="contact-last-message">Online</div>
      </div>
      <div class="chat-actions">
        <i class="fas fa-phone"></i>
        <i class="fas fa-video"></i>
        <i class="fas fa-info-circle"></i>
      </div>
    `;
    const messages = document.querySelector('.messages-container');
    messages.innerHTML = this.currentChat.messages.map(msg => `
      <div class="message ${msg.sent ? 'sent' : 'received'}">
        ${msg.text}
        <div class="message-time">${msg.time}</div>
      </div>
    `).join('');
    messages.scrollTop = messages.scrollHeight;
  },

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (text && this.currentChat) {
      const message = {
        text,
        time: new Date().toLocaleTimeString(),
        sent: true
      };
      this.currentChat.messages.push(message);
      this.currentChat.lastMessage = text;
      this.currentChat.time = message.time;
      this.saveData();
      this.renderChat();
      this.renderContacts();
      input.value = '';
    }
  },

  filterContacts(query) {
    const items = document.querySelectorAll('.contact-item');
    items.forEach(item => {
      const name = item.querySelector('.contact-name').textContent.toLowerCase();
      item.style.display = name.includes(query.toLowerCase()) ? 'flex' : 'none';
    });
  },

  switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  },

  showNewChat() {
    this.showModal('addFriendModal');
  },

  closeNewChat() {
    this.closeModal('addFriendModal');
  },

  showUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  },

  changeProfile() {
    this.closeModal('userMenu');
    this.showModal('editProfileModal');
    document.getElementById('editUserName').value = document.getElementById('currentUser').textContent;
    document.getElementById('editStatus').value = document.querySelector('.profile-status').textContent;
  },

  saveProfile() {
    const name = document.getElementById('editUserName').value;
    const status = document.getElementById('editStatus').value;
    document.getElementById('currentUser').textContent = name;
    document.querySelector('.profile-status').textContent = status;
    this.closeModal('editProfileModal');
  },

  clearAllChats() {
    if (confirm('Hapus semua chat?')) {
      this.friends.forEach(f => f.messages = []);
      this.saveData();
      this.renderContacts();
      if (this.currentChat) {
        this.currentChat.messages = [];
        this.renderChat();
      }
    }
  },

  clearAllData() {
    if (confirm('Reset semua data?')) {
      localStorage.removeItem('lineAppData');
      this.friends = [];
      this.currentChat = null;
      this.renderContacts();
      document.querySelector('.welcome-screen').style.display = 'flex';
      document.querySelector('.chat-header').style.display = 'none';
      document.querySelector('.message-input').style.display = 'none';
    }
  },

  showModal(id) {
    document.getElementById(id).style.display = 'flex';
  },

  closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }
};

function openMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('mobileOverlay').style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

function focusSearch() {
  document.getElementById('searchInput').focus();
}

function showNewChat() {
  lineApp.showNewChat();
}

function showUserMenu() {
  lineApp.showUserMenu();
}

function closeNewChat() {
  lineApp.closeNewChat();
}

function showUserList() {
  lineApp.showModal('friendListModal');
  const list = document.getElementById('friendListContent');
  list.innerHTML = lineApp.friends.map(f => `<div class="friend-item">${f.name} (${f.id})</div>`).join('');
}

function closeFriendList() {
  lineApp.closeModal('friendListModal');
}

function closeEditProfile() {
  lineApp.closeModal('editProfileModal');
}

document.addEventListener('DOMContentLoaded', () => {
  lineApp.init();
});

lineApp.activateID = function() {
    let myID = localStorage.getItem('lineAppMyID');
    if (!myID) {
        myID = 'LINE-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        localStorage.setItem('lineAppMyID', myID);
    }
    
    const idDisplay = document.getElementById('myUniqueId');
    if (idDisplay) {
        idDisplay.innerText = "ID: " + myID;
    }
};

lineApp.setupMyAvatar = function() {
    const profileImg = document.getElementById('profileImg');
    const savedAvatar = localStorage.getItem('myProfileAvatar');
    if (savedAvatar && profileImg) profileImg.src = savedAvatar;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'hiddenAvatarInput'; 
    input.style.display = 'none';
    if(!document.getElementById('hiddenAvatarInput')) document.body.appendChild(input);

    if (profileImg) {
        profileImg.style.cursor = 'pointer';
        profileImg.onclick = (e) => {
            e.stopPropagation(); 
            input.click();
        };
    }

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profileImg.src = event.target.result;
                localStorage.setItem('myProfileAvatar', event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };
};

lineApp.activateID();
lineApp.setupMyAvatar();

if (typeof lineApp.init === 'function') {
    lineApp.init();
}