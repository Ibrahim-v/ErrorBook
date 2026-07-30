// ==========================================================
// app.js - دفتر أخطاء القدرات
// ==========================================================
import {
    auth,
    db,
    signOut,
    onAuthStateChanged,
    updateProfile,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where
} from "./firebase.js";

let currentUser = null;
let cachedErrors = []; // كاش للأخطاء المحمّلة في الصفحة الحالية

// ----------------------------------------------------------
// أدوات مساعدة عامة
// ----------------------------------------------------------
function showToast(message, type = "success") {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return alert(message);
    toastEl.textContent = message;
    toastEl.className = type === "error" ? "toast-error" : "toast-success";
    toastEl.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.style.display = "none"; }, 3000);
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

async function fetchUserErrors() {
    if (!currentUser) return [];
    const q = query(collection(db, "errors"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return list;
}

// ----------------------------------------------------------
// المصادقة (Google فقط)
// ----------------------------------------------------------
function translateAuthError(code) {
    const map = {
        "auth/popup-closed-by-user": "تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية",
        "auth/cancelled-popup-request": "تم إلغاء الطلب، حاول مرة أخرى",
        "auth/popup-blocked": "المتصفح منع فتح نافذة تسجيل الدخول، تحقق من إعدادات النوافذ المنبثقة",
        "auth/network-request-failed": "تحقق من اتصالك بالإنترنت",
        "auth/account-exists-with-different-credential": "هذا البريد مسجل مسبقاً بطريقة دخول أخرى"
    };
    return map[code] || ("حدث خطأ غير متوقع: " + code);
}

function setupAuth() {
    const modal = document.getElementById("auth-modal");
    const googleBtn = document.getElementById("google-login-btn");

    if (googleBtn) {
        googleBtn.onclick = async () => {
            const originalText = googleBtn.innerHTML;
            googleBtn.disabled = true;
            googleBtn.classList.add("loading");
            googleBtn.innerHTML = "جاري الاتصال بجوجل...";
            try {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            } catch (err) {
                if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
                    showToast(translateAuthError(err.code), "error");
                }
            } finally {
                googleBtn.disabled = false;
                googleBtn.classList.remove("loading");
                googleBtn.innerHTML = originalText;
            }
        };
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (modal) modal.style.display = user ? "none" : "flex";
        updateAvatarUI(user);
        refreshCurrentPageData();
    });
}

function updateAvatarUI(user) {
    const img = document.getElementById("profile-avatar-img");
    const fallback = document.getElementById("profile-avatar-fallback");
    if (!img || !fallback) return;
    if (user && user.photoURL) {
        img.src = user.photoURL;
        img.style.display = "block";
        fallback.style.display = "none";
    } else {
        img.style.display = "none";
        fallback.style.display = "flex";
        fallback.textContent = user && user.email ? user.email.charAt(0).toUpperCase() : "؟";
    }
}


function setupMobileNav() {
    const burger = document.getElementById("nav-burger");
    const links = document.querySelector(".nav-links");
    if (!burger || !links) return;

    burger.onclick = (e) => {
        e.stopPropagation();
        links.classList.toggle("open");
        burger.classList.toggle("open");
    };

    links.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
            links.classList.remove("open");
            burger.classList.remove("open");
        });
    });

    document.addEventListener("click", (e) => {
        if (!links.contains(e.target) && e.target !== burger) {
            links.classList.remove("open");
            burger.classList.remove("open");
        }
    });
}

function setupProfileMenu() {
    const avatarBtn = document.getElementById("profile-avatar-btn");
    const menu = document.getElementById("profile-menu");
    const editBtn = document.getElementById("menu-edit-profile");
    const logoutBtn = document.getElementById("menu-logout");
    const profileModal = document.getElementById("profile-modal");
    const closeProfileBtn = document.getElementById("btn-close-profile");
    const saveProfileBtn = document.getElementById("btn-save-profile");
    const profileImageInput = document.getElementById("profile-image-input");
    const profileModalAvatar = document.getElementById("profile-modal-avatar");

    if (avatarBtn && menu) {
        avatarBtn.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle("open");
        };
        document.addEventListener("click", () => menu.classList.remove("open"));
        menu.addEventListener("click", (e) => e.stopPropagation());
    }

    if (editBtn && profileModal) {
        editBtn.onclick = () => {
            menu.classList.remove("open");
            if (profileModalAvatar) {
                if (currentUser && currentUser.photoURL) {
                    profileModalAvatar.src = currentUser.photoURL;
                    profileModalAvatar.style.display = "block";
                } else {
                    profileModalAvatar.style.display = "none";
                }
            }
            profileModal.style.display = "flex";
        };
    }

    if (closeProfileBtn && profileModal) {
        closeProfileBtn.onclick = () => { profileModal.style.display = "none"; };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            menu.classList.remove("open");
            signOut(auth);
        };
    }

    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            const file = profileImageInput ? profileImageInput.files[0] : null;
            if (!currentUser) return;
            if (!file) return showToast("اختر صورة أولاً", "error");

            const IMGBB_API_KEY = "8c2357905aa5559dc2e6b07bf35c8f9f";
            const originalText = saveProfileBtn.textContent;
            saveProfileBtn.disabled = true;
            saveProfileBtn.textContent = "جاري الرفع...";

            try {
                const formData = new FormData();
                formData.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
                const data = await res.json();
                if (!data.success) throw new Error("فشل رفع الصورة");

                await updateProfile(currentUser, { photoURL: data.data.url });
                updateAvatarUI(currentUser);
                showToast("تم تحديث الصورة الشخصية بنجاح");
                if (profileModal) profileModal.style.display = "none";
                if (profileImageInput) profileImageInput.value = "";
            } catch (err) {
                showToast("حدث خطأ: " + err.message, "error");
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = originalText;
            }
        };
    }
}

function setupDeleteAccount() {
    const deleteBtn = document.getElementById("menu-delete-account");
    const menu = document.getElementById("profile-menu");
    if (!deleteBtn) return;

    deleteBtn.onclick = async () => {
        if (menu) menu.classList.remove("open");
        if (!currentUser) return;

        const confirmed = confirm(
            "سيتم حذف حسابك وكل بياناتك (الأخطاء المحفوظة) نهائياً ولا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟"
        );
        if (!confirmed) return;

        const originalText = deleteBtn.textContent;
        deleteBtn.disabled = true;
        deleteBtn.textContent = "جاري الحذف...";

        try {
            const errors = await fetchUserErrors();
            for (const item of errors) {
                await deleteDoc(doc(db, "errors", item.id));
            }
            await deleteUser(currentUser);
            showToast("تم حذف الحساب نهائياً");
        } catch (err) {
            if (err.code === "auth/requires-recent-login") {
                showToast("لأمان حسابك، يرجى تسجيل الخروج والدخول مرة أخرى ثم إعادة محاولة الحذف مباشرة", "error");
            } else {
                showToast("تعذر حذف الحساب: " + err.message, "error");
            }
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = originalText;
        }
    };
}

// ----------------------------------------------------------
// 1. إضافة خطأ جديد (index.html)
// ----------------------------------------------------------
function setupAddError() {
    const form = document.getElementById("add-error-form");
    if (!form) return;

    const IMGBB_API_KEY = "8c2357905aa5559dc2e6b07bf35c8f9f";

    form.onsubmit = async (e) => {
        e.preventDefault();

        if (!currentUser) return showToast("يرجى تسجيل الدخول أولاً", "error");

        const fileInput = document.getElementById("q-image");
        const file = fileInput ? fileInput.files[0] : null;
        if (!file) return showToast("يرجى اختيار صورة أولاً", "error");

        try {
            showToast("جاري رفع الصورة والبيانات...");

            const formData = new FormData();
            formData.append("image", file);

            const imgResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            const imgData = await imgResponse.json();
            if (!imgData.success) {
                throw new Error("فشل رفع الصورة، تأكد من اتصال الإنترنت أو المفتاح");
            }

            const imgUrl = imgData.data.url;
            const todayStr = new Date().toISOString().split("T")[0];
            const notesInput = document.getElementById("q-notes");

            await addDoc(collection(db, "errors"), {
                userId: currentUser.uid,
                imageUrl: imgUrl,
                qNumber: document.getElementById("q-number").value,
                section: document.getElementById("q-section").value,
                reason: document.getElementById("q-reason").value,
                topic: document.getElementById("q-topic").value,
                notes: notesInput ? notesInput.value : "",
                reviewed: false,
                isRepeated: false,
                dateStr: todayStr,
                createdAt: new Date().toISOString()
            });

            showToast("تم حفظ الخطأ ورَفع الصورة بنجاح! 🎉");
            form.reset();
        } catch (err) {
            showToast("حدث خطأ أثناء الحفظ: " + err.message, "error");
        }
    };
}

// ----------------------------------------------------------
// بطاقة عرض خطأ واحد (تُستخدم في عدة صفحات)
// ----------------------------------------------------------
function renderErrorCard(item) {
    const div = document.createElement("div");
    div.className = "card error-card" + (item.reviewed ? " reviewed" : "");
    div.innerHTML = `
        <img src="${item.imageUrl}" alt="سؤال رقم ${escapeHtml(item.qNumber)}">
        <div>
            <span class="badge">${escapeHtml(item.section)}</span>
            <span class="badge">${escapeHtml(item.topic)}</span>
            <span class="badge">${escapeHtml(item.reason)}</span>
            <span class="badge">سؤال #${escapeHtml(item.qNumber)}</span>
            <span class="badge">${escapeHtml(item.dateStr)}</span>
            ${item.isRepeated ? '<span class="badge" style="color:var(--danger);">متكرر</span>' : ""}
        </div>
        ${item.notes ? `<p style="margin-top:10px;color:var(--text-sub);">${escapeHtml(item.notes)}</p>` : ""}
        <div class="card-actions">
            <button class="btn-reviewed ${item.reviewed ? "btn-danger" : "btn-success"}">
                ${item.reviewed ? "إلغاء المراجعة" : "تمت المراجعة"}
            </button>
            <button class="btn-delete btn-danger">حذف</button>
        </div>
        <div class="card-actions" style="margin-top:8px; grid-template-columns:1fr;">
            <button class="btn-repeated">${item.isRepeated ? "إلغاء وسم التكرار" : "وسم كمتكرر"}</button>
        </div>
    `;

    div.querySelector(".btn-reviewed").onclick = async () => {
        await updateDoc(doc(db, "errors", item.id), { reviewed: !item.reviewed });
        showToast(!item.reviewed ? "تم تعليمه كمراجع" : "تم إلغاء المراجعة");
        refreshCurrentPageData();
    };
    div.querySelector(".btn-delete").onclick = async () => {
        if (!confirm("هل تريد حذف هذا الخطأ نهائياً؟")) return;
        await deleteDoc(doc(db, "errors", item.id));
        showToast("تم الحذف");
        refreshCurrentPageData();
    };
    div.querySelector(".btn-repeated").onclick = async () => {
        await updateDoc(doc(db, "errors", item.id), { isRepeated: !item.isRepeated });
        showToast(!item.isRepeated ? "تم وسمه كمتكرر" : "تم إلغاء الوسم");
        refreshCurrentPageData();
    };

    return div;
}

function renderErrorList(container, list) {
    container.innerHTML = "";
    if (!currentUser) {
        container.innerHTML = `<p style="color:var(--text-sub);">الرجاء تسجيل الدخول لعرض الأخطاء.</p>`;
        return;
    }
    if (list.length === 0) {
        container.innerHTML = `<p style="color:var(--text-sub);">لا توجد أخطاء لعرضها.</p>`;
        return;
    }
    list.forEach((item) => container.appendChild(renderErrorCard(item)));
}

// ----------------------------------------------------------
// day.html - أخطاء يوم محدد + بحث وفلاتر
// ----------------------------------------------------------
async function loadDayPage() {
    const container = document.getElementById("errors-container");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const dateStr = params.get("date");
    const titleEl = document.getElementById("day-title");
    if (titleEl) {
        titleEl.textContent = dateStr ? `أخطاء يوم ${dateStr}` : "أخطاء اليوم";
    }

    cachedErrors = (await fetchUserErrors()).filter((e) => !dateStr || e.dateStr === dateStr);
    applyDayFilters();

    const searchInput = document.getElementById("search-input");
    const filterSection = document.getElementById("filter-section");
    const filterReason = document.getElementById("filter-reason");
    const filterTopic = document.getElementById("filter-topic");

    [searchInput, filterSection, filterReason, filterTopic].forEach((el) => {
        if (el) el.oninput = applyDayFilters;
    });
}

function applyDayFilters() {
    const container = document.getElementById("errors-container");
    if (!container) return;

    const search = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
    const section = document.getElementById("filter-section")?.value || "";
    const reason = document.getElementById("filter-reason")?.value || "";
    const topic = document.getElementById("filter-topic")?.value || "";

    const filtered = cachedErrors.filter((e) => {
        if (section && e.section !== section) return false;
        if (reason && e.reason !== reason) return false;
        if (topic && e.topic !== topic) return false;
        if (search) {
            const hay = `${e.qNumber} ${e.topic} ${e.reason} ${e.notes || ""}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    renderErrorList(container, filtered);
}

// ----------------------------------------------------------
// history.html - قائمة الأيام
// ----------------------------------------------------------
async function loadHistoryPage() {
    const list = document.getElementById("days-list");
    if (!list) return;

    const errors = await fetchUserErrors();
    if (!currentUser) {
        list.innerHTML = `<p style="color:var(--text-sub);">الرجاء تسجيل الدخول لعرض السجل.</p>`;
        return;
    }

    const counts = {};
    errors.forEach((e) => {
        counts[e.dateStr] = (counts[e.dateStr] || 0) + 1;
    });

    const dates = Object.keys(counts).sort((a, b) => b.localeCompare(a));
    if (dates.length === 0) {
        list.innerHTML = `<p style="color:var(--text-sub);">لا يوجد سجل بعد.</p>`;
        return;
    }

    list.innerHTML = "";
    dates.forEach((d) => {
        const a = document.createElement("a");
        a.href = `day.html?date=${encodeURIComponent(d)}`;
        a.className = "card";
        a.style.display = "block";
        a.style.textDecoration = "none";
        a.style.color = "var(--text-main)";
        a.innerHTML = `<strong>${d}</strong> <span class="badge" style="float:left;">${counts[d]} خطأ</span>`;
        list.appendChild(a);
    });
}

// ----------------------------------------------------------
// unreviewed.html و repeated.html
// ----------------------------------------------------------
async function loadUnreviewedPage() {
    const container = document.getElementById("errors-container");
    if (!container || !window.location.pathname.endsWith("unreviewed.html")) return;
    const errors = await fetchUserErrors();
    renderErrorList(container, errors.filter((e) => !e.reviewed));
}

async function loadRepeatedPage() {
    const container = document.getElementById("errors-container");
    if (!container || !window.location.pathname.endsWith("repeated.html")) return;
    const errors = await fetchUserErrors();
    renderErrorList(container, errors.filter((e) => e.isRepeated));
}

// ----------------------------------------------------------
// stats.html - إحصائيات + نسخ احتياطي
// ----------------------------------------------------------
let reasonsChartInstance = null;
let topicsChartInstance = null;

async function loadStatsPage() {
    const summary = document.getElementById("stats-summary");
    if (!summary) return;

    const errors = await fetchUserErrors();

    if (!currentUser) {
        summary.innerHTML = `<p style="color:var(--text-sub);">الرجاء تسجيل الدخول لعرض الإحصائيات.</p>`;
        return;
    }

    const total = errors.length;
    const reviewed = errors.filter((e) => e.reviewed).length;
    const repeated = errors.filter((e) => e.isRepeated).length;

    summary.innerHTML = `
        <p>إجمالي الأخطاء: <strong>${total}</strong></p>
        <p>تمت مراجعتها: <strong>${reviewed}</strong></p>
        <p>غير مراجعة: <strong>${total - reviewed}</strong></p>
        <p>متكررة: <strong>${repeated}</strong></p>
    `;

    const reasonCounts = {};
    const topicCounts = {};
    errors.forEach((e) => {
        reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1;
        topicCounts[e.topic] = (topicCounts[e.topic] || 0) + 1;
    });

    if (window.Chart) {
        const reasonsCtx = document.getElementById("reasonsChart");
        const topicsCtx = document.getElementById("topicsChart");

        if (reasonsChartInstance) reasonsChartInstance.destroy();
        if (topicsChartInstance) topicsChartInstance.destroy();

        if (reasonsCtx) {
            reasonsChartInstance = new Chart(reasonsCtx, {
                type: "bar",
                data: {
                    labels: Object.keys(reasonCounts),
                    datasets: [{ label: "عدد الأخطاء حسب السبب", data: Object.values(reasonCounts), backgroundColor: "#6366f1" }]
                }
            });
        }
        if (topicsCtx) {
            topicsChartInstance = new Chart(topicsCtx, {
                type: "pie",
                data: {
                    labels: Object.keys(topicCounts),
                    datasets: [{ data: Object.values(topicCounts), backgroundColor: ["#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#3b82f6", "#a855f7"] }]
                }
            });
        }
    }

    setupBackup(errors);
}

function setupBackup(errors) {
    const exportBtn = document.getElementById("btn-export");
    const importInput = document.getElementById("import-file");

    if (exportBtn) {
        exportBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(errors, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `errorbook-backup-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    if (importInput) {
        importInput.onchange = async () => {
            const file = importInput.files[0];
            if (!file || !currentUser) return;
            try {
                const text = await file.text();
                const items = JSON.parse(text);
                if (!Array.isArray(items)) throw new Error("صيغة الملف غير صحيحة");
                if (!confirm(`سيتم استيراد ${items.length} خطأ. متابعة؟`)) return;

                showToast("جاري الاستيراد...");
                for (const item of items) {
                    const { id, ...data } = item;
                    await addDoc(collection(db, "errors"), { ...data, userId: currentUser.uid });
                }
                showToast("تم الاستيراد بنجاح!");
                refreshCurrentPageData();
            } catch (err) {
                showToast("فشل الاستيراد: " + err.message, "error");
            } finally {
                importInput.value = "";
            }
        };
    }
}

// ----------------------------------------------------------
// تحديث بيانات الصفحة الحالية عند تغيّر حالة المصادقة أو البيانات
// ----------------------------------------------------------
function refreshCurrentPageData() {
    const path = window.location.pathname;
    if (path.endsWith("day.html")) loadDayPage();
    else if (path.endsWith("history.html")) loadHistoryPage();
    else if (path.endsWith("unreviewed.html")) loadUnreviewedPage();
    else if (path.endsWith("repeated.html")) loadRepeatedPage();
    else if (path.endsWith("stats.html")) loadStatsPage();
}

// ----------------------------------------------------------
// نقطة البداية
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    setupAuth();
    setupProfileMenu();
    setupDeleteAccount();
    setupMobileNav();
    setupAddError();
});