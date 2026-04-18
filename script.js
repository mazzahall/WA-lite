const lineApp = {
  friends: [],
  currentChat: null,
  currentUser: null, // Menyimpan username yang sedang login
  isLoginMode: true, // Status toggle antara form Login atau Daftar

  init() {
    this.checkAuth();
  },

  // --- FITUR LOGIN & REGISTER ---
  checkAuth() {
    const loggedInUser = localStorage.getItem('lineAppLoggedIn');
    if (loggedInUser) {
      // Jika sudah login, sembunyikan layar login dan muat data
      this.currentUser = loggedInUser;
      document.getElementById('authScreen').style.display = 'none';
      
      this.loadData();
      this.setupEventListeners();
      this.activateID();
      this.setupMyAvatar();
    } else {
      // Jika belum, tampilkan layar login
      document.getElementById('authScreen').style.display = 'flex';
    }
  },

  toggleAuthMode() {
    this.isLoginMode = !this.isLoginMode;
    document.getElementById('authTitle').innerText = this.isLoginMode ? 'Login ke LINE' : 'Buat Akun Baru';
    document.getElementById('authBtn').innerText = this.isLoginMode ? 'Masuk' : 'Daftar';
    document.getElementById('authToggleText').innerText = this.isLoginMode ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Login di sini';
  },

  handleAuth() {
    const user = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();

    if (!user || !pass) {
      alert('Username dan Password tidak boleh kosong!');
      return;
    }

    // Mengambil daftar akun dari memori
    let accounts = JSON.parse(localStorage.getItem('lineAppAccounts') || '{}');

    if (this.isLoginMode) {
      // PROSES LOGIN
      if (accounts[user] && accounts[user] === pass) {
        localStorage.setItem('lineAppLoggedIn', user); // Simpan status login
        location.reload(); // Refresh halaman agar data termuat
      } else {
        alert('Username atau Password salah!');
      }
    } else {
      // PROSES REGISTER (DAFTAR)
      if (accounts[user]) {
        alert('Username sudah dipakai, coba nama lain!');
      } else {
        accounts[user] = pass;
        localStorage.setItem('lineAppAccounts', JSON.stringify(accounts));
        alert('Akun berhasil dibuat! Silakan Login.');
        this.toggleAuthMode(); // Pindah ke layar login
        document.getElementById('authPassword').value = ''; // Kosongkan password
      }
    }
  },

  logout() {
    if (confirm('Yakin ingin keluar dari akun ini?')) {
      localStorage.removeItem('lineAppLoggedIn'); // Hapus status login
      location.reload(); // Refresh untuk kembali ke layar login
    }
  },
  // -----------------------------

  loadData() {
    // Memuat data spesifik untuk user yang sedang login
    const data = localStorage.getItem(`lineAppData_${this.currentUser}`);
    if (data) {
      const parsed = JSON.parse(data);
      this.friends = (parsed.friends || []).map(friend => ({
        ...friend,
        isOnline: Math.random() > 0.3
      }));
      this.renderContacts();
    } else {
        this.friends = [];
        this.renderContacts();
    }
  },

  saveData() {
    // Menyimpan data khusus di akun user ini saja
    if (!this.currentUser) return;
    localStorage.setItem(`lineAppData_${this.currentUser}`, JSON.stringify({
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
    const name = document.getElementById('newFriendName').value.trim();
    const id = document.getElementById('friendId').value.trim();

    // 1. Validasi kalau input kosong
    if (!name || !id) {
      alert('Nama dan ID LINE tidak boleh kosong!');
      return; // Hentikan proses
    }

    // 2. Validasi format ID LINE (Hanya huruf, angka, titik, garis bawah, min 4 karakter)
    const idRegex = /^[a-zA-Z0-9_.-]{4,20}$/;
    if (!idRegex.test(id)) {
      alert('ID LINE salah! ID harus terdiri dari 4-20 karakter, tanpa spasi, dan hanya boleh menggunakan huruf, angka, titik (.), atau garis bawah (_).');
      return;
    }

    // 3. Validasi tidak boleh menambahkan diri sendiri
    const myID = localStorage.getItem(`lineAppMyID_${this.currentUser}`);
    if (id === myID) {
      alert('Kamu tidak bisa menambahkan ID-mu sendiri sebagai teman!');
      return;
    }

    // 4. Validasi apakah teman dengan ID tersebut sudah ada
    const isAlreadyFriend = this.friends.some(f => f.id === id);
    if (isAlreadyFriend) {
      alert('Gagal! Teman dengan ID tersebut sudah ada di kontakmu.');
      return;
    }

    // JIKA SEMUA VALIDASI LOLOS, TAMBAHKAN TEMAN
    const friend = {
      name,
      id,
      avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&size=56&background=00c300&color=fff',
      messages: [],
      lastMessage: '',
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isOnline: true // Teman baru otomatis Online
    };
    
    this.friends.push(friend);
    this.saveData();
    this.renderContacts();
    this.closeModal('addFriendModal');
    
    // Kosongkan form input
    document.getElementById('newFriendName').value = '';
    document.getElementById('friendId').value = '';
    
    alert(`Berhasil menambahkan ${name} ke daftar teman!`);
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
        <div class="contact-item" onclick="lineApp.openChat('${friend.id}')" style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee; cursor: pointer;">
          <div class="contact-avatar" style="position: relative; margin-right: 15px;">
            <img src="${friend.avatar}" alt="${friend.name}" style="width: 50px; height: 50px; border-radius: 50%;">
            <div class="status-online" style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: ${friend.isOnline ? '#00c300' : '#999999'}; border: 2px solid #fff; border-radius: 50%;"></div>
          </div>
          <div class="contact-info" style="flex: 1;">
            <div class="contact-name" style="font-weight: bold; margin-bottom: 5px;">${friend.name}</div>
            <div class="contact-last-message" style="font-size: 12px; color: #777;">${friend.lastMessage || 'Belum ada pesan'}</div>
          </div>
          <div class="contact-time" style="font-size: 10px; color: #aaa;">${friend.time}</div>
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
      document.querySelector('.messages-container').style.display = 'flex';
      document.querySelector('.message-input').style.display = 'flex';
    }
  },
  
  renderChat() {
    if (!this.currentChat) return;
    const header = document.querySelector('.chat-header');
    const statusText = this.currentChat.isOnline ? 'Online' : 'Offline';
    const statusColor = this.currentChat.isOnline ? '#00c300' : '#999999';

    header.innerHTML = `
      <img src="${this.currentChat.avatar}" alt="${this.currentChat.name}" class="contact-avatar">
      <div class="contact-info" style="flex: 1;">
        <div class="contact-name" style="font-weight: bold;">${this.currentChat.name}</div>
        <div class="contact-last-message" style="font-size: 12px; color: ${statusColor};">${statusText}</div>
      </div>
      <div class="chat-actions">
        <i class="fas fa-phone"></i>
        <i class="fas fa-video"></i>
        <i class="fas fa-info-circle"></i>
      </div>
    `;
    const messages = document.querySelector('.messages-container');
    
    messages.innerHTML = this.currentChat.messages.map(msg => {
      const readText = this.currentChat.isOnline ? 'Dibaca' : 'baca';
      return `
      <div class="message ${msg.sent ? 'sent' : 'received'}">
        ${msg.text}
        <div class="message-meta">
          ${msg.sent ? `<span class="message-read">${readText}</span>` : ''}
          <span class="message-time">${msg.time}</span>
        </div>
      </div>
      `;
    }).join('');
    messages.scrollTop = messages.scrollHeight;
  },

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (text && this.currentChat) {
      const message = {
        text,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        sent: true,
        read: true
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
    // Menyesuaikan dengan user yang sedang login
    document.getElementById('editUserName').value = this.currentUser || "Nama Saya";
    document.getElementById('editStatus').value = document.querySelector('.profile-status') ? document.querySelector('.profile-status').textContent : "";
  },

  saveProfile() {
    const name = document.getElementById('editUserName').value;
    const status = document.getElementById('editStatus').value;
    
    // Simpan nama ini juga di localStorage untuk user ini
    localStorage.setItem(`lineAppDisplayName_${this.currentUser}`, name);
    
    document.getElementById('currentUser').textContent = name;
    if(document.querySelector('.profile-status')) {
        document.querySelector('.profile-status').textContent = status;
    }
    this.closeModal('editProfileModal');
  },

  clearAllChats() {
    if (confirm('Hapus semua chat di akun ini?')) {
      this.friends.forEach(f => f.messages = []);
      this.saveData();
      this.renderContacts();
      if (this.currentChat) {
        this.currentChat.messages = [];
        this.renderChat();
      }
      this.closeModal('userMenu');
    }
  },

  clearAllData() {
    // Kita ubah fungsinya jadi Logout biar masuk akal
    this.logout();
  },

  showModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'flex';
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none';
  }
};

function openMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('mobileOverlay').style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

function focusSearch() { document.getElementById('searchInput').focus(); }
function showNewChat() { lineApp.showNewChat(); }
function showUserMenu() { lineApp.showUserMenu(); }
function closeNewChat() { lineApp.closeNewChat(); }
function closeEditProfile() { lineApp.closeModal('editProfileModal'); }

// Jalankan ketika halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  lineApp.init(); 
  // activateID dan setupMyAvatar sudah dipindah ke dalam lineApp.checkAuth() 
  // agar hanya berjalan kalau sudah berhasil login.
});

lineApp.activateID = function() {
  // Bikin ID LINE spesifik untuk akun yang login
  let myID = localStorage.getItem(`lineAppMyID_${this.currentUser}`);
  if (!myID) {
    myID = 'LINE-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    localStorage.setItem(`lineAppMyID_${this.currentUser}`, myID);
  }
  
  const idDisplay = document.getElementById('myUniqueId');
  if (idDisplay) idDisplay.innerText = "ID: " + myID;

  // Setup nama profil sesuai user login
  const savedName = localStorage.getItem(`lineAppDisplayName_${this.currentUser}`);
  const nameDisplay = document.getElementById('currentUser');
  if (nameDisplay) nameDisplay.innerText = savedName || this.currentUser;
};

lineApp.setupMyAvatar = function() {
  const profileImg = document.getElementById('profileImg');
  const savedAvatar = localStorage.getItem(`myProfileAvatar_${this.currentUser}`);
  if (savedAvatar && profileImg) profileImg.src = savedAvatar;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.id = 'hiddenAvatarInput'; 
  input.style.display = 'none';
  if(!document.getElementById('hiddenAvatarInput')) document.body.appendChild(input);

  if (profileImg) {
    profileImg.style.cursor = 'pointer';
    profileImg.title = "Klik untuk ganti foto";
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
        // Simpan avatar spesifik untuk user ini
        localStorage.setItem(`myProfileAvatar_${lineApp.currentUser}`, event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
};