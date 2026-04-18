// ==========================================
// 1. KONFIGURASI FIREBASE LO
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCJfkLjxu76_cClSawTUTe25HG8kXXSMjs",
  authDomain: "line-web-703cd.firebaseapp.com",
  databaseURL: "https://line-web-703cd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "line-web-703cd",
  storageBucket: "line-web-703cd.firebasestorage.app",
  messagingSenderId: "158526449599",
  appId: "1:158526449599:web:7948675269a4b6cbd9a30a"
};

// Inisialisasi Firebase & Database
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ==========================================
// 2. LOGIKA UTAMA APLIKASI
// ==========================================
const lineApp = {
  friends: [],
  currentChat: null,
  currentUser: null,
  currentChatNode: null,
  isLoginMode: true,
  peer: null,
  currentCall: null,
  localStream: null,

  init() {
    this.checkAuth();
  },

  // --- FITUR LOGIN & REGISTER (ANTI-CRASH) ---
  checkAuth() {
    try {
      const loggedInUser = localStorage.getItem('lineAppLoggedIn');
      if (loggedInUser) {
        this.currentUser = loggedInUser;
        document.getElementById('authScreen').style.display = 'none';
        
        this.setupEventListeners();
        this.activateID();
        this.setupMyAvatar();
        
        // Jalankan fitur utama
        this.loadFriends();
        
        // Pisahkan PeerJS agar kalau error, web nggak ikut mogok
        try {
            this.initPeerJS(); 
        } catch (peerErr) {
            console.error("Gagal load fitur telepon:", peerErr);
        }

        // Update status ONLINE di Database
        const userStatusRef = database.ref('users/' + this.currentUser + '/isOnline');
        userStatusRef.set(true).catch(err => console.error("Error update status:", err));
        userStatusRef.onDisconnect().set(false);
      } else {
        document.getElementById('authScreen').style.display = 'flex';
      }
    } catch (error) {
      console.error("Gagal memuat sesi:", error);
      localStorage.removeItem('lineAppLoggedIn');
      alert("Terjadi kesalahan pada sesi kamu, silakan login ulang.");
      location.reload();
    }
  },

  toggleAuthMode() {
    this.isLoginMode = !this.isLoginMode;
    document.getElementById('authTitle').innerText = this.isLoginMode ? 'Login ke LINE' : 'Buat Akun Baru';
    document.getElementById('authBtn').innerText = this.isLoginMode ? 'Masuk' : 'Daftar';
    document.getElementById('authToggleText').innerText = this.isLoginMode ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Login di sini';
  },

  async handleAuth() {
    const user = document.getElementById('authUsername').value.trim();
    const pass = document.getElementById('authPassword').value.trim();

    if (!user || !pass) return alert('Username dan Password tidak boleh kosong!');

    const userRef = database.ref('users/' + user);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (this.isLoginMode) {
      if (userData && userData.password === pass) {
        localStorage.setItem('lineAppLoggedIn', user);
        location.reload(); 
      } else {
        alert('Username atau Password salah!');
      }
    } else {
      if (userData) {
        alert('Username sudah dipakai, coba nama lain!');
      } else {
        const myID = 'LINE-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        await userRef.set({
          password: pass,
          myID: myID,
          displayName: user,
          isOnline: false,
          avatar: 'https://ui-avatars.com/api/?name=' + user + '&background=00c300&color=fff'
        });
        await database.ref('userIds/' + myID).set(user);
        
        alert('Akun berhasil dibuat! Silakan Login.');
        this.toggleAuthMode(); 
        document.getElementById('authPassword').value = ''; 
      }
    }
  },

  logout() {
    if (confirm('Yakin ingin keluar?')) {
      database.ref('users/' + this.currentUser + '/isOnline').set(false).then(() => {
        localStorage.removeItem('lineAppLoggedIn'); 
        location.reload();
      });
    }
  },

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterContacts(e.target.value);
    });
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    document.querySelector('.send-btn').addEventListener('click', () => {
      this.sendMessage();
    });
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // --- TAMBAHAN KODE UNTUK TOMBOL GAMBAR ---
    const imageInput = document.getElementById('chatImageInput');
    if(imageInput) {
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.sendImage(file);
          e.target.value = ''; // Reset input biar bisa kirim gambar yang sama lagi
        }
      });
    }
  },

  loadFriends() {
    database.ref('user_friends/' + this.currentUser).on('value', (snap) => {
      const friendsData = snap.val() || {};
      const friendUsernames = Object.keys(friendsData);
      
      this.friends = [];
      if (friendUsernames.length === 0) {
        this.renderContacts();
        return;
      }

      friendUsernames.forEach(fUser => {
        database.ref('users/' + fUser).on('value', (uSnap) => {
          const uData = uSnap.val();
          if (uData) {
            const existingIndex = this.friends.findIndex(f => f.username === fUser);
            const friendObj = {
              username: fUser,
              id: uData.myID,
              name: uData.displayName || fUser,
              avatar: uData.avatar,
              isOnline: uData.isOnline || false
            };

            if (existingIndex > -1) {
              this.friends[existingIndex] = friendObj; 
            } else {
              this.friends.push(friendObj); 
            }
            this.renderContacts();
            
            if (this.currentChat && this.currentChat.username === fUser) {
              this.currentChat = friendObj;
              this.renderChatHeader();
            }
          }
        });
      });
    });
  },

  async addNewFriend() {
    const idInput = document.getElementById('friendId').value.trim();
    if (!idInput) return alert('Masukkan ID LINE!');

    const idSnap = await database.ref('userIds/' + idInput).once('value');
    const friendUsername = idSnap.val();

    if (!friendUsername) return alert('Gagal! Teman dengan ID tersebut tidak ditemukan.');
    if (friendUsername === this.currentUser) return alert('Kamu tidak bisa menambahkan diri sendiri!');

    const isFriend = await database.ref('user_friends/' + this.currentUser + '/' + friendUsername).once('value');
    if (isFriend.exists()) return alert('Dia sudah ada di daftar temanmu!');

    await database.ref('user_friends/' + this.currentUser + '/' + friendUsername).set(true);
    await database.ref('user_friends/' + friendUsername + '/' + this.currentUser).set(true);

    this.closeModal('addFriendModal');
    document.getElementById('newFriendName').value = '';
    document.getElementById('friendId').value = '';
    alert('Berhasil menambahkan teman!');
  },

  renderContacts() {
    const list = document.getElementById('contactsList');
    if (this.friends.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <i class="fas fa-user-plus"></i>
        <h3>Belum ada teman</h3>
        <p>Tambahkan teman pakai ID LINE-nya</p>
      </div>`;
    } else {
      list.innerHTML = this.friends.map(friend => `
        <div class="contact-item" onclick="lineApp.openChat('${friend.username}')" style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee; cursor: pointer;">
          <div class="contact-avatar" style="position: relative; margin-right: 15px;">
            <img src="${friend.avatar}" alt="${friend.name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
            <div class="status-online" style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: ${friend.isOnline ? '#00c300' : '#999999'}; border: 2px solid #fff; border-radius: 50%;"></div>
          </div>
          <div class="contact-info" style="flex: 1;">
            <div class="contact-name" style="font-weight: bold; margin-bottom: 5px;">${friend.name}</div>
            <div class="contact-last-message" style="font-size: 12px; color: #777;">Ketuk untuk chat</div>
          </div>
        </div>
      `).join('');
    }
  },

  getChatNodeId(user1, user2) {
    return [user1, user2].sort().join('_');
  },

  // --- LOGIKA BUKA CHAT & MOBILE SUPPORT ---
  openChat(friendUsername) {
    const friend = this.friends.find(f => f.username === friendUsername);
    if (!friend) return;
    
    this.currentChat = friend;
    this.currentChatNode = this.getChatNodeId(this.currentUser, friendUsername);
    
    document.querySelector('.welcome-screen').style.display = 'none';
    document.querySelector('.chat-header').style.display = 'flex';
    document.querySelector('.messages-container').style.display = 'flex';
    document.querySelector('.message-input').style.display = 'flex';
    
    this.renderChatHeader();

    // Logika tarik layar chat untuk HP
    if (window.innerWidth <= 768) {
      const mainChatArea = document.querySelector('.main-chat') || document.getElementById('mainChat');
      if (mainChatArea) {
        mainChatArea.classList.add('buka-di-hp'); 
      }
    }

    const msgsRef = database.ref('chats/' + this.currentChatNode);
    msgsRef.off(); 
    msgsRef.on('value', snap => {
      const msgs = snap.val() || {};
      this.renderMessages(msgs);
    });
  },

  renderChatHeader() {
    if (!this.currentChat) return;
    const header = document.querySelector('.chat-header');
    const statusText = this.currentChat.isOnline ? 'Online' : 'Offline';
    const statusColor = this.currentChat.isOnline ? '#00c300' : '#999999';

    header.innerHTML = `
      <div class="back-btn-hp" onclick="lineApp.tutupChatHp()" style="font-size: 20px; cursor: pointer; margin-right: 15px; color: #555;">
        <i class="fas fa-arrow-left"></i>
      </div>
      <img src="${this.currentChat.avatar}" alt="${this.currentChat.name}" class="contact-avatar" style="object-fit: cover;">
      <div class="contact-info" style="flex: 1;">
        <div class="contact-name" style="font-weight: bold;">${this.currentChat.name}</div>
        <div class="contact-last-message" style="font-size: 12px; color: ${statusColor};">${statusText}</div>
      </div>
      <div class="chat-actions">
        <i class="fas fa-phone" onclick="lineApp.startCall(false)" style="cursor:pointer;" title="Voice Call"></i>
        <i class="fas fa-video" onclick="lineApp.startCall(true)" style="cursor:pointer;" title="Video Call"></i>
        <i class="fas fa-info-circle"></i>
      </div>
    `;
  },

  tutupChatHp() {
    const mainChatArea = document.querySelector('.main-chat') || document.getElementById('mainChat');
    if (mainChatArea) {
      mainChatArea.classList.remove('buka-di-hp'); 
    }
  },

  renderMessages(msgsObj) {
    const messagesContainer = document.querySelector('.messages-container');
    const msgsArray = Object.values(msgsObj).sort((a, b) => a.timestamp - b.timestamp);
    
    messagesContainer.innerHTML = msgsArray.map(msg => {
      const isSentByMe = msg.sender === this.currentUser;
      const readText = this.currentChat.isOnline ? 'Dibaca' : 'baca'; 
      
      // --- CEK APAKAH INI GAMBAR ATAU TEKS ---
      let isiPesan = msg.text;
      if (msg.imageUrl) {
        // Kalau ada gambar, tampilkan tag <img>
        isiPesan = `<img src="${msg.imageUrl}" style="max-width: 220px; width: 100%; border-radius: 8px; cursor: pointer; display: block; margin-bottom: 5px;" onclick="window.open('${msg.imageUrl}', '_blank')">`;
      }
      
      return `
      <div class="message ${isSentByMe ? 'sent' : 'received'}">
        ${isiPesan}
        <div class="message-meta">
          ${isSentByMe ? `<span class="message-read">${readText}</span>` : ''}
          <span class="message-time">${msg.time}</span>
        </div>
      </div>
      `;
    }).join('');
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight; 
  },

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !this.currentChatNode) return;

    const msgRef = database.ref('chats/' + this.currentChatNode).push();
    msgRef.set({
      sender: this.currentUser,
      text: text,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    input.value = ''; 
  },

  sendImage(file) {
    if (!file || !this.currentChatNode) return;
    
    // Ubah teks input sementara biar user tau lagi proses
    const input = document.getElementById('messageInput');
    const oriPlaceholder = input.placeholder;
    input.placeholder = "Mengirim gambar...";
    input.disabled = true;

    // Baca gambar dan jadikan Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Img = e.target.result;
      const msgRef = database.ref('chats/' + this.currentChatNode).push();
      
      msgRef.set({
        sender: this.currentUser,
        text: '', // Kosongkan teks karena yang dikirim gambar
        imageUrl: base64Img, // Simpan data gambarnya di sini
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }).then(() => {
        input.placeholder = oriPlaceholder;
        input.disabled = false;
        input.focus();
      });
    };
    reader.readAsDataURL(file);
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

  showUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  },

  changeProfile() {
    this.closeModal('userMenu');
    this.showModal('editProfileModal');
    document.getElementById('editUserName').value = document.getElementById('currentUser').textContent;
  },

  async saveProfile() {
    const name = document.getElementById('editUserName').value;
    await database.ref('users/' + this.currentUser).update({
      displayName: name
    });
    document.getElementById('currentUser').textContent = name;
    this.closeModal('editProfileModal');
  },

  showModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'flex';
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none';
  },

  // ==========================================
  // 3. FITUR PANGGILAN SUARA & VIDEO (PEERJS)
  // ==========================================
  initPeerJS() {
    this.peer = new Peer(this.currentUser); 
    
    this.peer.on('call', (call) => {
      this.currentCall = call;
      document.getElementById('callScreen').style.display = 'flex';
      document.getElementById('callStatus').innerText = call.peer + " menelepon...";
      document.getElementById('answerBtn').style.display = 'block'; 

      document.getElementById('answerBtn').onclick = () => {
        this.answerCall(call);
      };
    });
  },

  async getMedia(isVideo) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true
      });
      this.localStream = stream;
      
      const localVideo = document.getElementById('localVideo');
      localVideo.srcObject = stream;
      localVideo.style.display = isVideo ? 'block' : 'none'; 
      
      return stream;
    } catch (err) {
      alert('Gagal! Pastikan kamu memberikan izin untuk mengakses Kamera dan Mikrofon di browser.');
      return null;
    }
  },

  async startCall(isVideo) {
    if (!this.currentChat) return alert('Buka chat teman dulu!');
    if (!this.currentChat.isOnline) return alert('Teman sedang offline, tidak bisa ditelepon.');
    
    const stream = await this.getMedia(isVideo);
    if (!stream) return;

    document.getElementById('callScreen').style.display = 'flex';
    document.getElementById('callStatus').innerText = "Memanggil " + this.currentChat.name + "...";
    document.getElementById('answerBtn').style.display = 'none'; 

    const call = this.peer.call(this.currentChat.username, stream);
    this.currentCall = call;

    call.on('stream', (remoteStream) => {
      document.getElementById('callStatus').innerText = isVideo ? "Video Call Tersambung" : "Voice Call Tersambung";
      document.getElementById('remoteVideo').srcObject = remoteStream;
    });

    call.on('close', () => this.endCall());
  },

  async answerCall(call) {
    document.getElementById('answerBtn').style.display = 'none';
    document.getElementById('callStatus').innerText = "Menyambungkan...";

    const stream = await this.getMedia(true); 
    if (!stream) return;

    call.answer(stream); 

    call.on('stream', (remoteStream) => {
      document.getElementById('callStatus').innerText = "Tersambung";
      document.getElementById('remoteVideo').srcObject = remoteStream;
    });

    call.on('close', () => this.endCall());
  },

  endCall() {
    if (this.currentCall) this.currentCall.close(); 
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop()); 
    }
    
    document.getElementById('callScreen').style.display = 'none';
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('localVideo').srcObject = null;
    this.currentCall = null;
    this.localStream = null;
  }
};

// ==========================================
// 4. FUNGSI BAWAAN UI & PROFIL
// ==========================================
function openMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('mobileOverlay').style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}
function focusSearch() { document.getElementById('searchInput').focus(); }
function showNewChat() { lineApp.showModal('addFriendModal'); }
function showUserMenu() { lineApp.showUserMenu(); }
function closeNewChat() { lineApp.closeModal('addFriendModal'); }
function closeEditProfile() { lineApp.closeModal('editProfileModal'); }

// Jalankan sistem
document.addEventListener('DOMContentLoaded', () => {
  lineApp.init(); 
});

lineApp.activateID = function() {
  database.ref('users/' + this.currentUser).once('value').then(snap => {
    const data = snap.val();
    if(data) {
        document.getElementById('myUniqueId').innerText = "ID: " + data.myID;
        document.getElementById('currentUser').innerText = data.displayName || this.currentUser;
    }
  });
};

lineApp.setupMyAvatar = function() {
  const profileImg = document.getElementById('profileImg');
  
  database.ref('users/' + this.currentUser + '/avatar').on('value', (snap) => {
    const url = snap.val();
    if (url && profileImg) profileImg.src = url;
  });

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
        const base64Img = event.target.result;
        profileImg.src = base64Img;
        database.ref('users/' + lineApp.currentUser).update({
          avatar: base64Img
        });
      };
      reader.readAsDataURL(file);
    }
  };
};