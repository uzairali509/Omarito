// ===== BACKEND API BASE =====
// Served by the Express backend (port 3000) -> same-origin relative URLs.
// Opened via Live Server / other static host -> point at the local backend.
const API_BASE = (window.location.port === "3000") ? "" : "http://localhost:3000";

// ===== NUMBER FORMATTING (K/M/B) =====
// Always shows up to 2 significant decimal places, strips trailing zeros.
// Examples: 59000000â†’59M, 32828396â†’32.83M, 3862164â†’3.86M, 1500â†’1.5K
function formatStat(num) {
    if (num === null || num === undefined) return "0";
    const n = Number(num);
    if (isNaN(n)) return "0";
    if (n < 1000) return n.toString();
    function clean(val, suffix) {
        // Use 2 decimal places always; trailing zeros stripped below
        let s = val < 1000 ? val.toFixed(2) : Math.round(val).toString();
        // Remove trailing zeros after decimal point
        if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
        return s + suffix;
    }
    if (n < 1000000) return clean(n / 1000, "K");
    if (n < 1000000000) return clean(n / 1000000, "M");
    return clean(n / 1000000000, "B");
}

// ===== MENU TOGGLE LOGIC =====
const toggle = document.getElementById("menuToggle");
const menu = document.getElementById("menu");

if (toggle && menu) {
    toggle.addEventListener("click", () => { menu.classList.toggle("active"); });
    toggle.addEventListener("mouseenter", () => { setTimeout(() => { menu.classList.toggle('active'); }, 100); });
    menu.addEventListener("mouseleave", () => { setTimeout(() => { menu.classList.toggle('active'); }, 100); });
}

// ===== TIKTOK DATA FETCH =====
async function getTikTokData() {
    try {
        const response = await fetch(API_BASE + "/tiktok-data"); // âœ… Localhost hata diya
        const data = await response.json();
        const followersEl = document.getElementById("followersCount");
        const likesEl = document.getElementById("likesCount");
        if (followersEl) followersEl.innerText = formatStat(data.followers);
        if (likesEl) likesEl.innerText = formatStat(data.likes);
    } catch (e) { console.log("TikTok Data fetch error"); }
}
getTikTokData();
setInterval(getTikTokData, 60000);

// ===== NOTIFICATION SYSTEM =====
async function fetchNotifications() {
    try {
        const response = await fetch(API_BASE + '/notifications');
        const data = await response.json();
        if (data.success && data.notifications) {
            renderNotifications(data.notifications);
            updateNotificationBadge(data.notifications);
        }
    } catch (e) {
        console.log('Notification fetch error:', e);
    }
}

function renderNotifications(notifications) {
    const list = document.getElementById('notificationList');
    if (!list) return;
    
    if (!notifications || notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">No new updates</div>';
        return;
    }
    
    list.innerHTML = notifications.map(n => {
        const avatar = n.creatorAvatar || '/Public/Images/default-user.png';
        const platformIcon = n.platform === 'youtube' ? 'fab fa-youtube' : 'fab fa-tiktok';
        const platformName = n.platform === 'youtube' ? 'YouTube' : 'TikTok';
        return `
            <a href="/Codes/player.html?id=${n.videoId}" class="notification-item" data-id="${n.videoId}">
                <img src="${avatar}" alt="" class="notification-avatar">
                <div class="notification-content">
                    <div class="notification-title">
                        <span class="creator">${n.creator}</span>
                        <span class="platform">${platformName}</span>
                    </div>
                    <div class="notification-desc">${n.title || 'New video uploaded'}</div>
                    <div class="notification-time">${formatRelativeTime(n.createTime)}</div>
                </div>
            </a>
        `.trim();
    }).join('');
}

function updateNotificationBadge(notifications) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    const lastSeen = localStorage.getItem('lastNotificationSeen') || 0;
    const unreadCount = notifications.filter(n => new Date(n.createTime).getTime() > lastSeen).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        fetchNotifications();
        // Mark as seen when opened
        localStorage.setItem('lastNotificationSeen', Date.now().toString());
        updateNotificationBadge([]);
    } else {
        panel.style.display = 'none';
    }
}

// Close notification panel on outside click
window.addEventListener('click', function(e) {
    const panel = document.getElementById('notificationPanel');
    const btn = document.getElementById('notificationBtn');
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.style.display = 'none';
    }
});

// Close on Escape key
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const panel = document.getElementById('notificationPanel');
        if (panel) panel.style.display = 'none';
    }
});

// Fetch notifications on load
fetchNotifications();
// Refresh notifications every 5 minutes
setInterval(fetchNotifications, 300000);

// ===== ELECTRIC CURSOR LOGIC =====
const cursor = document.querySelector(".electric-cursor");
const canvas = document.getElementById("lightningCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

if (ctx) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
let mouse = { x: 0, y: 0 };
let particles = [];

if (cursor && canvas) {
    document.addEventListener("mousemove", (e) => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        cursor.style.left = mouse.x + "px"; cursor.style.top = mouse.y + "px";
        createParticle(mouse.x, mouse.y);
    });

    // âœ… Lightbox ke andar bhi cursor track kare
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener("mousemove", (e) => {
            mouse.x = e.clientX; mouse.y = e.clientY;
            cursor.style.left = mouse.x + "px";
            cursor.style.top = mouse.y + "px";
        });
    }
}

function createParticle(x, y) {
    particles.push({ x, y, size: Math.random() * 4 + 1, speedX: (Math.random() - 0.5) * 4, speedY: (Math.random() - 0.5) * 4, life: 30 });
}

function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,159,28," + p.life / 30 + ")"; ctx.fill();
        p.x += p.speedX; p.y += p.speedY; p.life--;
        if (p.life <= 0) { particles.splice(i, 1); i--; }
    }
    requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } });

document.querySelectorAll("a, button, li").forEach(el => {
    el.addEventListener("mouseenter", () => { if (cursor) { cursor.style.boxShadow = "0 0 20px #FF9F1C, 0 0 40px #FF9F1C, 0 0 60px #F4C430"; cursor.style.transform = "translate(-50%, -50%) scale(1.5)"; } });
    el.addEventListener("mouseleave", () => { if (cursor) { cursor.style.boxShadow = "0 0 10px #FF9F1C, 0 0 20px #FF9F1C, 0 0 40px #F4C430"; cursor.style.transform = "translate(-50%, -50%) scale(1)"; } });
});

// ===== MENU SLIDES LOGIC =====
const mainMenu = document.getElementById("mainMenu");
let originalMenu = mainMenu ? mainMenu.innerHTML : "";

function openJourney(link, title, desc) {
    const overlay = document.getElementById("journeyOverlay");
    if (!overlay) return;
    const finalTitle = title || "Enjoy Our Journey With the Deep Soul";
    const finalDesc = desc || "Explore the places Omarito has visited around the world.";
    typeText(document.getElementById("overlayTitle"), finalTitle, 40);
    typeText(document.getElementById("overlayDesc"), finalDesc, 20);
    overlay.classList.add("active");
    setTimeout(() => { window.open(link, "_blank"); overlay.classList.remove("active"); }, 4000);
}

function visitlink(link) { window.open(link, "_blank"); }

function attachMenuEvents() {
    const charactersBtn = document.getElementById("charactersBtn");
    const yearBtn = document.getElementById("yearBtn");
    const eventBtn = document.getElementById("eventBtn");
    const emailBtn = document.getElementById("emailBtn");
    const locationBtn = document.getElementById("locationBtn");
    const visitBtn = document.getElementById("visitBtn");
    const tiktokBtn = document.getElementById("tiktokBtn");

    // Playlist menu items - navigate to videos page with official numeric playlist ID
    const playlistItems = mainMenu ? mainMenu.querySelectorAll("li") : [];
    playlistItems.forEach(li => {
        const text = li.textContent.trim();
        const PLAYLIST_TEXT_TO_ID = {
            "Omarito.World": "7433396735386405638",
            "Omarito.Wow":   "7433667529204828933",
            "Omarito.Chef":  "7433392358749653766"
        };
        if (PLAYLIST_TEXT_TO_ID[text]) {
            li.style.cursor = "pointer";
            li.addEventListener("click", () => {
                window.location.href = `/Codes/videos.html?creator=Omar&playlistId=${PLAYLIST_TEXT_TO_ID[text]}`;
            });
        }
    });

    if (yearBtn) yearBtn.addEventListener("click", () => { openSubmenu(["2022", "2023", "2024", "2025", "2026"]); });
    if (eventBtn) eventBtn.addEventListener("click", () => { openSubmenu(["Christmas", "Halloween", "Independence Day", "New Year", "Ramadan"]); });
    if (emailBtn) emailBtn.addEventListener("click", () => { openSubmenu([`<span onclick="visitlink('https://mail.google.com/mail/?view=cm&to=omarito@qstar.kz')">omarito@qstar.kz</span>`, `<span onclick="visitlink('https://mail.google.com/mail/?view=cm&to=dilandyalievaaa@gmail.com')">dilandyalievaaa@gmail.com</span>`]); });
    if (locationBtn) locationBtn.addEventListener("click", () => { openSubmenu([`<span onclick="visitlink('https://www.google.com/maps/place/Almaty+Kazakhstan')">Alamty, Kazakhstan</span>`]); });
    if (visitBtn) visitBtn.addEventListener("click", () => { openSubmenu([`<span onclick="openJourney('https://www.instagram.com/stories/highlights/17886960027577786/')">South Korea</span>`,`<span onclick="openJourney('https://www.instagram.com/stories/highlights/17900528382245066/')">Qatar</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/17950245054003983/')">Indonesia</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/18124074073461615/')">China</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/18034139063358170/')">Azerbaijan</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/17893714956232937/')">Kyrgyztan</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/17892465525192636/')">Turkey</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/17909613041984299/')">Tajikistan</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/18063881989659947/')">Dubai</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/18189277981305948/')">Uzbekistan</span>`, `<span onclick="openJourney('https://www.instagram.com/stories/highlights/18247475899274262/')">Kazakhstan</span>`]); });

    let tiktokOpen = false;
    if (tiktokBtn) {
        tiktokBtn.addEventListener("click", () => {
            if (!tiktokOpen) { openSubmenu([`<span onclick="visitlink('https://www.tiktok.com/@omari.to')">@omari.to</span>`, `<span onclick="visitlink('https://www.tiktok.com/@omari_t02')">@omari_t02</span>`, `<span onclick="visitlink('https://www.tiktok.com/@dilandyalieva')">@dilandyalieva</span>`]); tiktokOpen = true; }
            else { goBack(); tiktokOpen = false; }
        });
    }
}

function openSubmenu(items) {
    if (!mainMenu) return;
    mainMenu.classList.remove("reset-position"); mainMenu.classList.add("slide-out-left");
    setTimeout(() => {
        mainMenu.innerHTML = `<li id="backBtn">â† Back</li>${items.map(item => `<li>${item}</li>`).join("")}`;
        mainMenu.scrollTop = 0; mainMenu.classList.remove("slide-out-left"); mainMenu.classList.add("slide-out-right");
        void mainMenu.offsetWidth; mainMenu.classList.remove("slide-out-right"); mainMenu.classList.add("reset-position");
        document.getElementById("backBtn").addEventListener("click", goBack);
    }, 400);
}

function goBack() {
    if (!mainMenu) return;
    mainMenu.classList.remove("reset-position"); mainMenu.classList.add("slide-out-right");
    setTimeout(() => {
        mainMenu.innerHTML = originalMenu; mainMenu.classList.remove("slide-out-right"); mainMenu.classList.add("slide-out-left");
        void mainMenu.offsetWidth; mainMenu.classList.remove("slide-out-left"); mainMenu.classList.add("reset-position");
        attachMenuEvents();
    }, 400);
}
if (mainMenu) attachMenuEvents();

function openCharacter(character) {
    const creators = {
        'omar': 'Omar',
        'dylan': 'Dylan',
        'sufiya': 'Sufiya'
    };

    // Redirect to videos.html with creator filter parameter
    window.location.href = `/Codes/videos.html?creator=${creators[character]}`;
}

// Update the charactersBtn click handler in your existing code
if (charactersBtn) {
    charactersBtn.addEventListener("click", () => {
        openSubmenu([
            `<span onclick="openCharacter('omar')">Omar</span>`,
            `<span onclick="openCharacter('dylan')">Dylan</span>`,
            `<span onclick="openCharacter('sufiya')">Sufiya</span>`
        ]);
    });
}

// ===== ðŸ”¥ PROFILE PANEL TOGGLE & DATA FETCHING =====
function toggleProfilePanel() {
    const panel = document.getElementById("profilePanel");
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

window.addEventListener('click', function (e) {
    const panel = document.getElementById("profilePanel");
    const navProfileBox = document.getElementById("navProfileBox");
    if (panel && navProfileBox && !panel.contains(e.target) && !navProfileBox.contains(e.target)) {
        panel.style.display = 'none';
    }
});

const deleteAccBtn = document.getElementById('deleteAccBtn');
if (deleteAccBtn) {
    deleteAccBtn.addEventListener('click', async () => {
        const confirmDelete = confirm("Are you sure you want to delete your account?");
        if (!confirmDelete) return;
        try {
            const res = await fetch(API_BASE + '/delete-account', { method: 'DELETE', credentials: 'include' }); // âœ… Localhost hata diya
            const data = await res.json();
            if (data.success) {
                alert("Account Deleted");
                window.location.href = "/Codes/SignIn.html";
            }
        } catch (err) { console.log(err); }
    });
}

// ===== FORM HANDLING LOGIC =====
const signupForm = document.getElementById("signinForm");
const loginForm = document.getElementById("loginForm");

function handleForm(form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorSpan = form.querySelector(".error");
        if (errorSpan) errorSpan.textContent = "";
        try {
            const formData = new FormData(form);
            const response = await fetch(form.action, { method: form.method, body: formData, credentials: "include" });
            const data = await response.json();
            if (data.errors && data.errors.length > 0) { if (errorSpan) errorSpan.textContent = data.errors[0].msg; }
            else if (data.error && data.error.length > 0) { if (errorSpan) errorSpan.textContent = data.error[0]; }
            else if (data.success) {
                if (form.id === "signinForm") { window.location.href = "/Codes/Login.html"; }
                else { window.location.href = "/"; }
            }
        } catch (err) {
            console.log(err);
            if (errorSpan) errorSpan.textContent = "Server Error";
        }
    });
}
if (signupForm) handleForm(signupForm);
if (loginForm) handleForm(loginForm);

const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");
if (togglePassword && password) {
    togglePassword.addEventListener("click", () => {
        const type = password.type === "password" ? "text" : "password";
        password.type = type;
        togglePassword.classList.toggle("fa-eye"); togglePassword.classList.toggle("fa-eye-slash");
    });
}

function typeText(element, text, speed = 40) {
    if (!element) return;
    element.innerHTML = ""; let i = 0;
    function typing() { if (i < text.length) { element.innerHTML += text.charAt(i); i++; setTimeout(typing, speed); } }
    typing();
}

const imageInput = document.getElementById('photo');
const fileNameSpan = document.getElementById('fileName');
if (imageInput && fileNameSpan) {
    imageInput.addEventListener('change', function () {
        if (this.files && this.files.length > 0) { fileNameSpan.textContent = this.files[0].name; }
        else { fileNameSpan.textContent = ""; }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(API_BASE + '/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); // âœ… Localhost hata diya
            if (response.ok) { localStorage.removeItem('token'); window.location.href = '/Codes/Login.html'; }
            else { alert("Logout failed, try again!"); }
        } catch (err) {
            localStorage.removeItem('token');
            window.location.href = '/Codes/Login.html';
        }
    });
}

async function getUser() {
    try {
        const res = await fetch(API_BASE + "/user", { method: "GET", credentials: "include" });
        if (res.status === 401) return;
        const data = await res.json();

        if (data.success) {
            const user = data.user;
            document.getElementById("loginLink").style.display = "none";
            document.getElementById("navProfileBox").style.display = "flex";
            document.getElementById("navUserName").innerText = user.firstname;
            document.getElementById("userName").innerText = user.firstname + " " + user.lastname;
            document.getElementById("userEmail").innerText = user.email;
            document.getElementById("userAge").innerText = user.age;
            document.getElementById("userDate").innerText = user.date;

            let imageUrl = "/Public/Images/default-user.png";
            if (user.image && user.image !== "default-user.png" && user.image !== "") {
                // Check if it's an external URL (Google/TikTok OAuth) or a local upload
                if (user.image.startsWith("http://") || user.image.startsWith("https://")) {
                    imageUrl = user.image; // External URL from OAuth (Google/TikTok)
                } else {
                    let cleanImage = user.image.replace("uploads/", "").replace("/uploads/", "");
                    imageUrl = `/uploads/${cleanImage}`;
                }
            }
            document.getElementById("navProfileImg").src = imageUrl;
            document.getElementById("panelProfileImg").src = imageUrl;

            // ðŸ”¥ BIRTHDAY LOGIC WITH LOCALSTORAGE
            if (data.birthdayStatus === "today") {
                const lastShown = localStorage.getItem("bdayShownTime");
                const now = Date.now();

                // Agar pehli baar hai, YA snooze ka time khatam ho gaya hai
                if (!lastShown || now >= parseInt(lastShown)) {
                    setTimeout(() => {
                        showBirthdayCelebration(user.firstname);
                    }, 1500);
                }
            }

            else if (data.birthdayStatus === "near") {
                // 1 week wala sirf 1 baar dikhayega (session mein)
                if (!sessionStorage.getItem("bdayNearShown")) {
                    setTimeout(() => {
                        Toastify({
                            text: `ðŸŽ‚ ðŸŽ‰ ${user.firstname}, Your Birthday is Coming Soon! Get Ready!`,
                            duration: 8000,
                            gravity: "top",
                            position: "center",
                            backgroundColor: "linear-gradient(to right, #FF9F1C, #F4C430)",
                            color: "#000",
                            stopOnFocus: true
                        }).showToast();
                    }, 2000);
                    sessionStorage.setItem("bdayNearShown", "true");
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
}

const updateForm = document.getElementById("updateForm");
if (updateForm) {
    updateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(updateForm);
        try {
            const res = await fetch(API_BASE + "/update-user", { method: "PUT", body: formData, credentials: "include" });
            const data = await res.json();
            if (data.success) { alert("Updated"); } else { alert(data.message); }
        } catch (err) { console.log(err); }
    });
}

getUser();


const statusBar = document.getElementById('connectionStatus');

function updateConnectionStatus() {
    if (!statusBar) return; // Agar element nahi mila toh error nahi dega

    if (navigator.onLine) {
        statusBar.textContent = "ðŸŸ¢ Online";
        statusBar.classList.remove('offline');
        statusBar.classList.add('online');
        statusBar.classList.remove('hide');

        // 2 seconds baad green bar chup jayega
        setTimeout(() => statusBar.classList.add('hide'), 2000);
    } else {
        statusBar.textContent = "ðŸ”´ Offline";
        statusBar.classList.remove('online');
        statusBar.classList.add('offline');
        statusBar.classList.remove('hide');
    }
}

// Event listeners
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// âœ… PAGE LOAD PAR PEHLI BAAR CHECK KARO (Yeh add nahi tha)
updateConnectionStatus();


window.addEventListener("load", () => {
    const loader = document.getElementById("loader");
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 200);
});


async function loadRanking() {
    try {
        const res = await fetch(API_BASE + "/omari-ranking");
        const data = await res.json();

        const asiaEl = document.getElementById("asiaRank");
        const worldEl = document.getElementById("worldRank");
        const kzEl = document.getElementById("kzRank");

        if (data.success && data.rankings) {
            // Show actual rank values, or "Updating..." if null
            if (asiaEl) asiaEl.innerText = data.rankings.asia !== null ? "#" + data.rankings.asia : "Updating...";
            if (worldEl) worldEl.innerText = data.rankings.world !== null ? "#" + data.rankings.world : "Updating...";
            if (kzEl) kzEl.innerText = data.rankings.kazakhstan !== null ? "#" + data.rankings.kazakhstan : "Updating...";
        } else {
            // No valid data yet - show "Updating..."
            if (asiaEl) asiaEl.innerText = "Updating...";
            if (worldEl) worldEl.innerText = "Updating...";
            if (kzEl) kzEl.innerText = "Updating...";
        }

    } catch (error) {
        console.log("Ranking Error:", error);
        // Show "Updating..." on error instead of fake fallback values
        document.getElementById("asiaRank").innerText = "Updating...";
        document.getElementById("worldRank").innerText = "Updating...";
        document.getElementById("kzRank").innerText = "Updating...";
    }
}


loadRanking();
// Refresh rankings every 10 minutes
setInterval(loadRanking, 10 * 60 * 1000);



// ===== BACKGROUND IMAGE SLIDER LOGIC =====
const bgSliderTrack = document.getElementById('bgSliderTrack');
const bgPrevBtn = document.getElementById('bgPrevBtn');
const bgNextBtn = document.getElementById('bgNextBtn');
const bgDots = document.querySelectorAll('.bg-dot');

if (bgSliderTrack) {
    let bgSlideIndex = 0;
    const bgSlides = document.querySelectorAll('.bg-slide');
    const bgTotalSlides = bgSlides.length;
    let bgIsDragging = false;
    let bgStartPos = 0;
    let bgCurrentTranslate = 0;
    let bgPrevTranslate = 0;
    let bgAnimationID = 0;
    let bgAutoSlideInterval;

    function bgGoToSlide(index) {
        if (index < 0) bgSlideIndex = bgTotalSlides - 1;
        else if (index >= bgTotalSlides) bgSlideIndex = 0;
        else bgSlideIndex = index;

        bgCurrentTranslate = -bgSlideIndex * bgSliderTrack.offsetWidth;
        bgPrevTranslate = bgCurrentTranslate;

        bgSliderTrack.style.transform = `translateX(${bgCurrentTranslate}px)`;

        bgDots.forEach(dot => dot.classList.remove('active'));
        bgDots[bgSlideIndex].classList.add('active');
    }

    bgNextBtn.addEventListener('click', () => { bgGoToSlide(bgSlideIndex + 1); bgResetAutoSlide(); });
    bgPrevBtn.addEventListener('click', () => { bgGoToSlide(bgSlideIndex - 1); bgResetAutoSlide(); });

    bgDots.forEach((dot, index) => {
        dot.addEventListener('click', () => { bgGoToSlide(index); bgResetAutoSlide(); });
    });

    // ===== TOUCH & MOUSE DRAG =====
    bgSliderTrack.addEventListener('touchstart', bgDragStart);
    bgSliderTrack.addEventListener('touchmove', bgDragMove);
    bgSliderTrack.addEventListener('touchend', bgDragEnd);

    bgSliderTrack.addEventListener('mousedown', bgDragStart);
    bgSliderTrack.addEventListener('mousemove', bgDragMove);
    bgSliderTrack.addEventListener('mouseup', bgDragEnd);
    bgSliderTrack.addEventListener('mouseleave', bgDragEnd);

    function bgDragStart(e) {
        bgIsDragging = true;
        bgStartPos = bgGetPositionX(e);
        bgSliderTrack.classList.add('dragging');
        bgAnimationID = requestAnimationFrame(bgAnimation);
        clearInterval(bgAutoSlideInterval);
    }

    function bgDragMove(e) {
        if (!bgIsDragging) return;
        const currentPosition = bgGetPositionX(e);
        bgCurrentTranslate = bgPrevTranslate + currentPosition - bgStartPos;
    }

    function bgDragEnd() {
        bgIsDragging = false;
        bgSliderTrack.classList.remove('dragging');
        cancelAnimationFrame(bgAnimationID);

        const movedBy = bgCurrentTranslate - bgPrevTranslate;
        if (movedBy < -100) bgGoToSlide(bgSlideIndex + 1);
        else if (movedBy > 100) bgGoToSlide(bgSlideIndex - 1);
        else bgGoToSlide(bgSlideIndex);

        bgResetAutoSlide();
    }

    function bgGetPositionX(e) {
        return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    }

    function bgAnimation() {
        if (bgIsDragging) {
            bgSliderTrack.style.transform = `translateX(${bgCurrentTranslate}px)`;
            requestAnimationFrame(bgAnimation);
        }
    }

    function bgStartAutoSlide() {
        bgAutoSlideInterval = setInterval(() => { bgGoToSlide(bgSlideIndex + 1); }, 5000);
    }

    function bgResetAutoSlide() {
        clearInterval(bgAutoSlideInterval);
        bgStartAutoSlide();
    }

    bgStartAutoSlide();
    window.addEventListener('resize', () => bgGoToSlide(bgSlideIndex));
}

// ===== PROFILES DROPDOWN LOGIC =====
const profilesToggle = document.getElementById('profilesToggle');
const profilesDropdown = document.getElementById('profilesDropdown');
const dropdownArrow = document.getElementById('dropdownArrow');

if (profilesToggle && profilesDropdown && dropdownArrow) {
    profilesToggle.addEventListener('click', () => {
        const isActive = profilesDropdown.classList.toggle('active');

        if (isActive) {
            dropdownArrow.style.transform = 'rotate(180deg)';
        } else {
            dropdownArrow.style.transform = 'rotate(0deg)';
        }
    });
}

// ===== IMAGE LIGHTBOX & QR CODE LOGIC =====
// Yeh code tumhare script.js mein pehle se hona chahiye

const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxName = document.getElementById('lightboxName');
const lightboxUsername = document.getElementById('lightboxUsername');
const qrDownloadBtn = document.getElementById('qrDownloadBtn');

let currentQRUsername = "";

function openLightbox(imgElement) {
    const name = imgElement.getAttribute('data-name');
    const username = imgElement.getAttribute('data-username');
    const imgSrc = imgElement.src;

    lightboxImage.src = imgSrc;
    lightboxName.innerText = name;
    lightboxUsername.innerText = username;

    currentQRUsername = username.replace('@', '');

    lightboxOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightboxOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
}

if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) {
            closeLightbox();
        }
    });
}

// QR Download Logic
// ðŸ”¥ QR CODE DOWNLOAD LOGIC (Direct Image Download)
if (qrDownloadBtn) {
    qrDownloadBtn.addEventListener('click', async () => {

        // Lightbox mein jo image dikh rahi hai, uska source le lo
        const imgSrc = lightboxImage.src;

        if (!imgSrc) {
            alert("No QR image found!");
            return;
        }

        try {
            // Image ko fetch karke blob (downloadable file) mein convert karo
            const response = await fetch(imgSrc);
            const blob = await response.blob();

            // Blob ka ek temporary download link banao
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            // File ka naam set karo (e.g., @omari.to-QR-Code.png)
            link.download = `${currentQRUsername}-QR-Code.png`;

            // Link par click karke download force karo
            document.body.appendChild(link);
            link.click();

            // Link hata do aur memory free karo
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            console.error("QR Download Error:", error);
            alert("Failed to download QR Code. Try again!");
        }
    });
}

// ===== LEGENDS CATEGORY FILTER =====
function filterLegends(category, btn) {
    // Buttons active state
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Filter rows
    const rows = document.querySelectorAll('.legend-row');

    rows.forEach(row => {
        if (category === 'all') {
            row.classList.remove('hidden');
        } else {
            if (row.getAttribute('data-category') === category) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        }
    });
}


// ===== ðŸ”¥ MESSAGE SECTION LOGIC (With All Countries/Cities API & DB Save) =====

// 1. Token Check (Sirf logged in users ko section dikhana)
async function checkTokenAndShowMessage() {
    try {
        const res = await fetch(API_BASE + "/user", { method: "GET", credentials: "include" });
        if (res.status === 200) {
            const data = await res.json();
            if (data.success) {
                document.getElementById("messageSection").style.display = "block";
                loadCountries(); // âœ… User login hai, countries load karo
            }
        }
    } catch (err) {
        console.log("User not logged in, Message section hidden");
    }
}
checkTokenAndShowMessage();


// 2. Load All Countries from API
const countrySelect = document.getElementById("countrySelect");
const citySelect = document.getElementById("citySelect");

async function loadCountries() {
    if (!countrySelect) return;
    try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries/positions");
        const data = await res.json();

        if (data.error === false) {
            // Sort countries A-Z
            const countries = data.data.sort((a, b) => a.name.localeCompare(b.name));

            countries.forEach(country => {
                const option = document.createElement("option");
                option.value = country.name;
                option.textContent = country.name;
                countrySelect.appendChild(option);
            });
        }
    } catch (err) {
        console.log("Countries fetch error", err);
    }
}

// 3. Load Cities Based on Selected Country
if (countrySelect) {
    countrySelect.addEventListener("change", async function () {
        const selectedCountry = this.value;
        citySelect.innerHTML = '<option value="">-- Loading Cities... --</option>';
        citySelect.disabled = true;

        if (!selectedCountry) {
            citySelect.innerHTML = '<option value="">-- Choose City --</option>';
            return;
        }

        try {
            // API ko country ka name bhejenge, woh cities return karegi
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ country: selectedCountry })
            });

            const data = await res.json();

            if (data.error === false && data.data.length > 0) {
                citySelect.innerHTML = '<option value="">-- Choose City --</option>';
                // Sort cities A-Z
                const cities = data.data.sort((a, b) => a.localeCompare(b));

                cities.forEach(city => {
                    const option = document.createElement("option");
                    option.value = city;
                    option.textContent = city;
                    citySelect.appendChild(option);
                });

                citySelect.disabled = false;
            } else {
                citySelect.innerHTML = '<option value="">No cities found</option>';
            }
        } catch (err) {
            console.log("Cities fetch error", err);
            citySelect.innerHTML = '<option value="">Error loading cities</option>';
        }
    });
}

// 4. Form Submit & Save to MongoDB
const messageForm = document.getElementById("messageForm");

if (messageForm) {
    messageForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const country = countrySelect.value;
        const city = citySelect.value;
        const message = document.getElementById("msgText").value;

        if (!country || !city || !message) {
            Toastify({
                text: "âš ï¸ Please fill all fields!",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#ff4d4d"
            }).showToast();
            return;
        }

        try {
            // Backend ko data bhejna
            const response = await fetch(API_BASE + "/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include" // Cookie (token) bhi jayegi
            });

            // âœ… FIX: Body ko pehle string mein convert karo, phir bhejo
            const res = await fetch(API_BASE + "/save-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ country, city, message }) // Data bhi bheja
            });

            const data = await res.json();

            if (data.success) {
                Toastify({
                    text: "âœ… Message Sent Successfully!",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(to right, #d4bf86, #FF9F1C)"
                }).showToast();

                // Form clear karo
                messageForm.reset();
                citySelect.disabled = true;
                citySelect.innerHTML = '<option value="">-- Choose City --</option>';
            } else {
                Toastify({
                    text: "âŒ " + (data.message || "Failed to send"),
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#ff4d4d"
                }).showToast();
            }
        } catch (err) {
            console.log(err);
            Toastify({
                text: "âš ï¸ Network Error!",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#ff4d4d"
            }).showToast();
        }
    });
}

// ===== ðŸ”¥ SIMPLE DARK MAP WITH CUSTOM LOCATIONS =====

const mapDiv = document.getElementById('map');

if (mapDiv) {
    // 1. Map Initialize (Poori duniya ka view)
    const leafletMap = L.map('map', {
        scrollWheelZoom: false,
        zoomControl: true
    }).setView([35, 60], 3); // Center view adjusted taake sab locations sahi dikhain

    // 2. Black / Dark Map Theme (Free, No API Key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 18
    }).addTo(leafletMap);

    // ðŸ”¥ 3. GOLDEN MARKER (For Visited Destinations)
    const goldenIcon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot" style="color: #d4bf86; font-size: 30px; filter: drop-shadow(0 0 8px rgba(255,159,28,0.8));"></i>',
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    // ðŸ”¥ 4. RED MARKER (For Homeland - Kazakhstan)
    const homeIcon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot" style="color: #ff4d4d; font-size: 36px; filter: drop-shadow(0 0 10px rgba(255,0,0,0.8));"></i>',
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });

    // ðŸ”¥ 5. CUSTOM LOCATIONS ARRAY
    const customLocations = [
        // Visited Destinations (Golden Color)
        { lat: -6.2088, lng: 106.8456, name: "Jakarta", desc: "Indonesia", isHome: false },
        { lat: 39.9042, lng: 116.4074, name: "Beijing", desc: "China", isHome: false },
        { lat: 40.4093, lng: 49.8672, name: "Baku", desc: "Azerbaijan", isHome: false },
        { lat: 42.8746, lng: 74.5698, name: "Bishkek", desc: "Kyrgyzstan", isHome: false },
        { lat: 41.0082, lng: 28.9784, name: "Istanbul", desc: "Turkey", isHome: false },
        { lat: 38.5598, lng: 68.7740, name: "Dushanbe", desc: "Tajikistan", isHome: false },
        { lat: 25.2048, lng: 55.2708, name: "Dubai", desc: "UAE", isHome: false },
        { lat: 41.2995, lng: 69.2401, name: "Tashkent", desc: "Uzbekistan", isHome: false },

        // ðŸ  Homeland (Red Color)
        { lat: 43.2389, lng: 76.8895, name: "Almaty", desc: "Kazakhstan   Homeland", isHome: true }
    ];

    // 6. Map par markers lagao
    customLocations.forEach(location => {
        // Agar location home hai toh red icon, warna golden icon
        const iconToUse = location.isHome ? homeIcon : goldenIcon;

        L.marker([location.lat, location.lng], { icon: iconToUse })
            .addTo(leafletMap)
            .bindPopup(`
                <b style="color:${location.isHome ? '#ff4d4d' : '#d4bf86'}; font-size:16px;">
                    ${location.name}
                </b>
                <p style="margin:5px 0 0 0; color:#aaa; font-size:13px;">
                    ${location.desc}
                </p>
            `);
    });

    // 7. Map rendering fix
    setTimeout(() => {
        leafletMap.invalidateSize();
    }, 1000);
}


// ===== ðŸ”¥ BIRTHDAY CELEBRATION MODAL & CONFETTI =====


// ===== ðŸ”¥ BIRTHDAY CELEBRATION, SNOOZE & CONFETTI =====

function showBirthdayCelebration(name) {
    startConfetti();

    const modal = document.createElement('div');
    modal.id = 'birthdayModalOverlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);z-index:999999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.5s ease;cursor:none;';

    modal.innerHTML = `
        <div style="background:linear-gradient(145deg, #1a1a1a, #0f0f0f);border:2px solid #d4bf86;border-radius:30px;padding:50px 40px;text-align:center;max-width:500px;width:90%;box-shadow:0 0 60px rgba(255,159,28,0.4);animation:scaleUp 0.5s ease;position:relative;overflow:hidden;">
            
            <div style="font-size:80px;margin-bottom:20px;animation:bounce 1s infinite alternate;">ðŸŽ‚</div>
            
            <h1 style="font-family:'Playfair Display',serif;font-size:48px;background:linear-gradient(90deg,#d4bf86,#F4C430,#ff004c,#d4bf86);-webkit-background-clip:text;background-clip:text;color:transparent;background-size:300% auto;animation:shimmer 2s linear infinite;margin-bottom:10px;">Happy Birthday!</h1>
            
            <h2 style="font-size:28px;color:white;margin-bottom:20px;">${name} ðŸŽ‰</h2>
            
            <p style="color:#bbb;font-size:16px;line-height:1.6;margin-bottom:30px;">Wishing you an amazing day filled with love, joy, and creativity. Omari.to family celebrates you today! ðŸ¥³</p>
            
            <button onclick="closeBirthdayModal()" style="padding:15px 40px;background:linear-gradient(45deg,#d4bf86,#dcc78e);color:black;border:none;border-radius:30px;font-size:18px;font-weight:600;cursor:pointer;transition:0.3s;margin-bottom:15px;">Let's Celebrate! ðŸŽˆ</button>
            
            <!-- ðŸ”¥ SNOOZE DROPDOWN BUTTON -->
            <div style="position:relative;display:inline-block;margin-left:10px;">
                <button onclick="toggleSnoozeDropdown()" style="padding:12px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:30px;font-size:14px;cursor:pointer;">
                    ðŸ”• Snooze <i class="fa-solid fa-chevron-down" style="font-size:10px;margin-left:5px;"></i>
                </button>
                
                <div id="snoozeDropdown" style="display:none;position:absolute;bottom:50px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #d4bf86;border-radius:15px;padding:10px 0;min-width:180px;box-shadow:0 10px 30px rgba(0,0,0,0.5);z-index:2;">
                    <div onclick="snoozeBirthday(2)" style="padding:10px 20px;color:#ccc;cursor:pointer;transition:0.2s;">Remind in 2 mins</div>
                    <div onclick="snoozeBirthday(5)" style="padding:10px 20px;color:#ccc;cursor:pointer;transition:0.2s;">Remind in 5 mins</div>
                    <div onclick="snoozeBirthday(10)" style="padding:10px 20px;color:#ccc;cursor:pointer;transition:0.2s;">Remind in 10 mins</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// âœ… Snooze Dropdown Toggle
// âœ… Snooze Dropdown Toggle
function toggleSnoozeDropdown() {
    const dropdown = document.getElementById('snoozeDropdown');
    if (dropdown) {
        // Agar dropdown hidden hai toh dikhao, warna chupao
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    }
}

// âœ… BAHIR CLICK PAR DROPDOWN BAND KARO (Global Event Listener)
window.addEventListener('click', function (e) {
    const dropdown = document.getElementById('snoozeDropdown');

    // Agar dropdown exist karta hai aur dikh raha hai
    if (dropdown && dropdown.style.display === 'block') {

        // Check karo ke click snooze button ya dropdown ke andar hua ya NAHI
        // e.target wo element hai jispar click hua
        const isClickInsideDropdown = dropdown.contains(e.target);
        const isClickOnSnoozeBtn = e.target.closest('[onclick="toggleSnoozeDropdown()"]');

        // Agar click BAHIR hua hai (na dropdown mein, na snooze button par)
        if (!isClickInsideDropdown && !isClickOnSnoozeBtn) {
            dropdown.style.display = 'none'; // Band karo
        }
    }
});

// âœ… Snooze Logic (Minutes mein time lo aur localStorage set karo)
function snoozeBirthday(minutes) {
    const remindTime = Date.now() + (minutes * 60 * 1000); // Current time + minutes
    localStorage.setItem("bdayShownTime", remindTime.toString());

    Toastify({
        text: `â° Got it! Will remind you in ${minutes} minutes.`,
        duration: 3000,
        gravity: "top",
        position: "center",
        backgroundColor: "#333",
        color: "#d4bf86"
    }).showToast();

    closeBirthdayModal();
}

// âœ… Close Modal (Agar celebrate kare toh aaj ke liye dikhana band)
function closeBirthdayModal() {
    const modal = document.getElementById('birthdayModalOverlay');
    if (modal) modal.remove();
    stopConfetti();

    // End of day tak ya next login tak dubsra na aaye
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    localStorage.setItem("bdayShownTime", endOfDay.getTime().toString());
}

// ===== CONFETTI LOGIC =====
let confettiAnimationId;
const confettiCanvas = document.createElement('canvas');
confettiCanvas.id = 'confettiCanvas';
confettiCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999998;';
const confettiCtx = confettiCanvas.getContext('2d');
let confettiPieces = [];

function startConfetti() {
    if (document.getElementById('confettiCanvas')) return; // Duplicate na ho
    document.body.appendChild(confettiCanvas);
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ["#FF9F1C", "#F4C430", "#ff004c", "#28a745", "#ffffff", "#d4bf86"];

    for (let i = 0; i < 150; i++) {
        confettiPieces.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        });
    }

    animateConfetti();
}

function animateConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    confettiPieces.forEach((p, i) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rotation * Math.PI / 180);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confettiCtx.restore();

        if (p.y > confettiCanvas.height) {
            confettiPieces[i].y = -20;
        }
    });

    confettiAnimationId = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
    cancelAnimationFrame(confettiAnimationId);
    confettiPieces = [];
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    if (confettiCanvas.parentNode) {
        document.body.removeChild(confettiCanvas);
    }
}

async function loadVideos(page = 1) {
    const response = await fetch(`${API_BASE}/omari-videos?page=${page}&limit=30`);
    const data = await response.json();

    if (data.success) {
        const container = document.getElementById("videos-container");
        data.videos.forEach(video => {
            container.innerHTML += `
        <div class="video-card">
          <a href="${video.video_url}" target="_blank">
            <img src="${video.thumbnail}" alt="${video.title}">
            <p>${video.title}</p>
          </a>
        </div>
      `;
        });
    }
}

// Load first page
loadVideos(1);
