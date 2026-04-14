import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  where,
  serverTimestamp,
  updateDoc,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLjPiH-E2cB3ZA-xbZe_SlWm9YHsn5CFE",
  authDomain: "know-your-note.firebaseapp.com",
  projectId: "know-your-note",
  storageBucket: "know-your-note.firebasestorage.app",
  messagingSenderId: "660965229112",
  appId: "1:660965229112:web:00213037b4c8ddc6d91ccd",
  measurementId: "G-05X5ZW30MM",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authContainer = document.getElementById("authContainer");
const notesGrid = document.getElementById("notesGrid");
const notesGridContainer = document.getElementById("notesGridContainer");
const loginSection = document.getElementById("loginSection");
const noteModal = document.getElementById("noteModal");
const modalContent = noteModal ? noteModal.querySelector(".modal-content") : null;
const modalTitle = document.getElementById("modalTitle");
const modalPinNoteBtn = document.getElementById("modalPinNoteBtn");
const modalAddChecklistItemBtn = document.getElementById("modalAddChecklistItemBtn");
const modalChecklistContainer = document.getElementById("modalChecklistContainer");
const modalCategorySelect = document.getElementById("modalCategorySelect");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const closeModal = document.getElementById("closeModal");
const lastUpdatedDisplay = document.getElementById("lastUpdatedDisplay");
const searchInput = document.getElementById("searchInput");
const colorPicker = document.getElementById("colorPicker");
const modalBody = document.getElementById("modalBody");
const dynamicCategories = document.getElementById("dynamicCategories");
const addCategoryContainer = document.getElementById("addCategoryContainer");
const newCategoryInput = document.getElementById("newCategoryInput");
const showAddCategoryBtn = document.getElementById("showAddCategoryBtn");

// Delete Confirmation Elements
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmTitle = document.getElementById("deleteConfirmTitle");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const rememberDeleteDecision = document.getElementById("rememberDeleteDecision");

// Sidebar & Headers
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const mobileHeader = document.getElementById("mobileHeader");
const desktopHeader = document.getElementById("desktopHeader");
const mainContent = document.getElementById("mainContent");

// State
let currentNoteId = null;
let modalQuill = null;
let currentFilter = "all";
let searchTerm = "";
let modalPinnedStatus = false;
let modalColor = "default";
let unsubscribeNotes = null;
let unsubscribeCategories = null;
let allNotes = [];
let userCategories = [];

// Original values for change detection
let originalState = {
  title: "",
  content: "",
  checklist: [],
  category: "personal",
  color: "default",
  pinned: false
};

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
}

// Helper: Show Toast
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  const bg = type === 'error' ? 'bg-rose-500' : 'bg-slate-800';
  toast.className = `${bg} text-white px-6 py-3 rounded-2xl shadow-xl font-medium animate-in`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// Helper: Format Date
function formatDate(timestamp) {
  if (!timestamp) return "Just now";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper: Dynamic Greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Quill Initialization (Pre-initialized for performance)
function initQuill() {
  if (!modalQuill) {
    modalQuill = new Quill("#noteEditorContainer", {
      theme: "snow",
      modules: {
        toolbar: [
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["clean"],
        ],
      },
      placeholder: "Start typing your thoughts...",
    });
    modalQuill.on('text-change', checkChanges);
  }
}

// Change Detection Engine
function getChecklistItems() {
  const items = [];
  modalChecklistContainer.querySelectorAll(".checklist-item").forEach(item => {
    const text = item.querySelector(".checklist-text").value.trim();
    if (text) {
      items.push({
        text: text,
        completed: item.querySelector(".checklist-checkbox").checked
      });
    }
  });
  return items;
}

function checkChanges() {
  if (!modalSaveBtn) return;
  
  const currentTitle = modalTitle.value.trim();
  const currentContent = modalQuill ? modalQuill.root.innerHTML : "";
  const currentChecklist = getChecklistItems();
  const currentCategory = modalCategorySelect.value;
  const currentColor = modalColor;
  const currentPinned = modalPinnedStatus;

  const hasTitleChanged = currentTitle !== originalState.title.trim();
  const hasContentChanged = (currentContent !== originalState.content) && (currentContent !== "<p><br></p>" || originalState.content !== "");
  const hasCategoryChanged = currentCategory !== originalState.category;
  const hasColorChanged = currentColor !== originalState.color;
  const hasPinnedChanged = currentPinned !== originalState.pinned;
  const hasChecklistChanged = JSON.stringify(currentChecklist) !== JSON.stringify(originalState.checklist);

  const isChanged = hasTitleChanged || hasContentChanged || hasCategoryChanged || hasColorChanged || hasPinnedChanged || hasChecklistChanged;
  const isNotEmpty = currentTitle !== "" || (currentContent !== "" && currentContent !== "<p><br></p>") || currentChecklist.length > 0;

  modalSaveBtn.disabled = !isChanged || (currentNoteId === null && !isNotEmpty);
}

// Checklist Management
function addChecklistItem(text = "", completed = false) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "checklist-item group flex items-start gap-4 p-3 bg-white hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all";
  itemDiv.innerHTML = `
    <input type="checkbox" ${completed ? "checked" : ""} class="checklist-checkbox w-5 h-5 rounded-lg border-2 border-slate-200 text-primary focus:ring-primary/20 transition-all cursor-pointer mt-0.5">
    <input type="text" value="${escapeHtml(text)}" placeholder="Enter task details..." class="checklist-text flex-1 bg-transparent py-0 text-slate-600 focus:outline-none font-medium placeholder:text-slate-300">
    <button type="button" class="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all remove-task">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;
  
  const checkbox = itemDiv.querySelector(".checklist-checkbox");
  const textInput = itemDiv.querySelector(".checklist-text");
  const removeBtn = itemDiv.querySelector(".remove-task");

  checkbox.addEventListener("change", () => {
    itemDiv.classList.toggle("completed", checkbox.checked);
    checkChanges();
  });
  textInput.addEventListener("input", checkChanges);
  removeBtn.addEventListener("click", () => {
    itemDiv.remove();
    checkChanges();
  });
  
  modalChecklistContainer.appendChild(itemDiv);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  textInput.focus();
}

// Modal Handlers
function openAddModal() {
  currentNoteId = null;
  originalState = {
    title: "",
    content: "",
    checklist: [],
    category: userCategories.length > 0 ? userCategories[0].name : "personal",
    color: "default",
    pinned: false
  };

  modalTitle.value = "";
  if (modalQuill) modalQuill.root.innerHTML = "";
  modalChecklistContainer.innerHTML = "";
  modalPinnedStatus = false;
  modalColor = "default";
  lastUpdatedDisplay.textContent = "";
  modalDeleteBtn.classList.add("hidden");
  
  updateCategorySelect();
  modalCategorySelect.value = originalState.category;
  updatePinUI();
  updateColorUI();
  checkChanges();
  noteModal.classList.remove("hidden");
  noteModal.classList.add("flex");
  setTimeout(() => modalTitle.focus(), 50);
}

function openEditModal(note) {
  currentNoteId = note.id;
  originalState = {
    title: note.title || "",
    content: note.content || "",
    checklist: note.checklist ? JSON.parse(JSON.stringify(note.checklist)) : [],
    category: note.category || "personal",
    color: note.color || "default",
    pinned: note.pinned || false
  };

  modalTitle.value = originalState.title;
  if (modalQuill) modalQuill.root.innerHTML = originalState.content;
  updateCategorySelect();
  modalCategorySelect.value = originalState.category;
  modalPinnedStatus = originalState.pinned;
  modalColor = originalState.color;
  modalChecklistContainer.innerHTML = "";
  
  if (note.checklist) {
    note.checklist.forEach(item => addChecklistItem(item.text, item.completed));
  }
  
  lastUpdatedDisplay.textContent = `Edited ${formatDate(note.updatedAt)}`;
  modalDeleteBtn.classList.remove("hidden");
  
  updatePinUI();
  updateColorUI();
  checkChanges();
  noteModal.classList.remove("hidden");
  noteModal.classList.add("flex");
}

function closeNoteModalFunc() {
  noteModal.classList.add("hidden");
  noteModal.classList.remove("flex");
  currentNoteId = null;
}

function updatePinUI() {
  modalPinNoteBtn.classList.toggle("text-primary", modalPinnedStatus);
  modalPinNoteBtn.classList.toggle("bg-primary/5", modalPinnedStatus);
}

function updateColorUI() {
  const colorClasses = ["note-color-default", "note-color-gray", "note-color-brown", "note-color-orange", "note-color-yellow", "note-color-green", "note-color-blue", "note-color-purple", "note-color-pink", "note-color-red"];
  if (modalContent) {
    modalContent.classList.remove(...colorClasses);
    modalContent.classList.add(`note-color-${modalColor}`);
  }
  document.querySelectorAll(".color-swatch").forEach(swatch => swatch.classList.toggle("active", swatch.dataset.color === modalColor));
  
  const badge = document.getElementById("modalCategoryBadge");
  badge.textContent = modalCategorySelect.value;
}

// Category Logic
function updateCategorySelect() {
  const currentVal = modalCategorySelect.value;
  modalCategorySelect.innerHTML = "";
  const standards = ["personal", "work", "ideas", "tasks", "important"];
  standards.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
    modalCategorySelect.appendChild(opt);
  });
  userCategories.forEach(c => {
    if (!standards.includes(c.name.toLowerCase())) {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        modalCategorySelect.appendChild(opt);
    }
  });
  if (currentVal) modalCategorySelect.value = currentVal;
}

async function addCustomCategory() {
  const name = newCategoryInput.value.trim();
  if (!name) return;
  const user = auth.currentUser;
  if (!user) return;
  if (userCategories.find(c => c.name.toLowerCase() === name.toLowerCase())) return showToast("Category exists");

  try {
    await addDoc(collection(db, "categories"), { userId: user.uid, name: name, createdAt: serverTimestamp() });
    newCategoryInput.value = "";
    addCategoryContainer.classList.add("hidden");
    showAddCategoryBtn.classList.remove("hidden");
    showToast("Category added");
  } catch (err) { showToast(err.message, "error"); }
}

async function editCategory(category, e) {
    if (e) e.stopPropagation();
    const newName = prompt("Rename category:", category.name);
    if (!newName || newName.trim() === category.name) return;
    const finalName = newName.trim();

    try {
        await updateDoc(doc(db, "categories", category.id), { name: finalName });
        const q = query(collection(db, "notes"), where("userId", "==", auth.currentUser.uid), where("category", "==", category.name));
        const snapshots = await getDocs(q);
        const batch = writeBatch(db);
        snapshots.forEach(noteDoc => {
            batch.update(doc(db, "notes", noteDoc.id), { category: finalName });
        });
        await batch.commit();
        showToast("Category updated");
    } catch (err) { showToast(err.message, "error"); }
}

async function deleteCategory(category, e) {
    if (e) e.stopPropagation();
    if (confirm(`Remove the "${category.name}" category?`)) {
        try { 
            await deleteDoc(doc(db, "categories", category.id)); 
            showToast("Category removed");
        } catch (err) { showToast(err.message, "error"); }
    }
}

function subscribeToCategories(userId) {
  if (unsubscribeCategories) unsubscribeCategories();
  const q = query(collection(db, "categories"), where("userId", "==", userId), orderBy("name", "asc"));
  unsubscribeCategories = onSnapshot(q, (snapshot) => {
    userCategories = [];
    snapshot.forEach(doc => userCategories.push({ id: doc.id, ...doc.data() }));
    renderCategories();
    updateCategorySelect();
  });
}

function renderCategories() {
  dynamicCategories.innerHTML = `
    <button data-category="all" class="category-filter-btn ${currentFilter === 'all' ? 'active' : ''}">
        <i data-lucide="layout" class="w-4 h-4"></i>
        <span>All Notes</span>
    </button>
  `;
  
  // Attach All Notes Listener immediately after innerHTML set
  const allBtn = dynamicCategories.querySelector('[data-category="all"]');
  if (allBtn) {
    allBtn.addEventListener("click", () => setFilter("all"));
  }

  const defaults = ["personal", "work", "ideas", "tasks", "important"];
  const icons = { personal: "user", work: "briefcase", ideas: "sparkles", tasks: "check-circle", important: "star" };
  defaults.forEach(c => {
    const btn = document.createElement("button");
    btn.dataset.category = c;
    btn.className = `category-filter-btn ${currentFilter === c ? 'active' : ''}`;
    btn.innerHTML = `<i data-lucide="${icons[c]}" class="w-4 h-4 text-slate-400"></i><span>${c.charAt(0).toUpperCase() + c.slice(1)}</span>`;
    btn.addEventListener("click", () => setFilter(c));
    dynamicCategories.appendChild(btn);
  });
  
  userCategories.forEach(c => {
    const div = document.createElement("div");
    div.className = "category-item group";
    const btn = document.createElement("button");
    btn.dataset.category = c.name;
    btn.className = `category-filter-btn w-full ${currentFilter === c.name ? 'active' : ''}`;
    btn.innerHTML = `
        <i data-lucide="hash" class="w-4 h-4 text-slate-400"></i>
        <span class="truncate pr-16">${c.name}</span>
        <div class="category-actions">
            <button class="action-icon-btn edit-cat"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
            <button class="action-icon-btn action-icon-btn-danger delete-cat"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
        </div>
    `;
    btn.addEventListener("click", (e) => {
        if (!e.target.closest('.category-actions')) setFilter(c.name);
    });
    btn.querySelector(".edit-cat").addEventListener("click", (e) => editCategory(c, e));
    btn.querySelector(".delete-cat").addEventListener("click", (e) => deleteCategory(c, e));
    div.appendChild(btn);
    dynamicCategories.appendChild(div);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function setFilter(cat) {
    currentFilter = cat;
    renderCategories();
    renderNotes();
    if (window.innerWidth < 1024) closeSidebar();
}

// Note Actions
async function saveNote() {
  const user = auth.currentUser;
  if (!user) return;
  const title = modalTitle.value.trim();
  modalSaveBtn.disabled = true;
  modalSaveBtn.innerHTML = `Saving...`;
  try {
    const noteData = {
      userId: user.uid,
      title: title || "Untitled",
      content: modalQuill.root.innerHTML,
      checklist: getChecklistItems(),
      category: modalCategorySelect.value,
      color: modalColor,
      pinned: modalPinnedStatus,
      updatedAt: serverTimestamp(),
    };
    if (currentNoteId) { await updateDoc(doc(db, "notes", currentNoteId), noteData); showToast("Workspace updated"); }
    else { noteData.createdAt = serverTimestamp(); await addDoc(collection(db, "notes"), noteData); showToast("Note captured"); }
    closeNoteModalFunc();
  } catch (err) { showToast(err.message, "error"); } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.innerHTML = `<i data-lucide="check" class="w-5 h-5 font-bold"></i> Done`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Custom Deletion Flow
async function deleteNoteConfirmed() {
    if (!currentNoteId) return;
    try {
        if (rememberDeleteDecision.checked) localStorage.setItem('skipDeleteConfirm', 'true');
        await deleteDoc(doc(db, "notes", currentNoteId));
        deleteConfirmModal.classList.add("hidden");
        closeNoteModalFunc();
        showToast("Note released");
    } catch (err) { showToast(err.message, "error"); }
}

function triggerDeletion() {
    if (!currentNoteId) return;
    const skip = localStorage.getItem('skipDeleteConfirm') === 'true';
    if (skip) return deleteNoteConfirmed();
    
    const note = allNotes.find(n => n.id === currentNoteId);
    deleteConfirmTitle.textContent = `Delete "${note?.title || 'this note'}"?`;
    deleteConfirmModal.classList.remove("hidden");
}

// Rendering
function subscribeToNotes(userId) {
  if (unsubscribeNotes) unsubscribeNotes();
  const q = query(collection(db, "notes"), where("userId", "==", userId), orderBy("updatedAt", "desc"));
  unsubscribeNotes = onSnapshot(q, (snapshot) => {
    allNotes = [];
    snapshot.forEach(doc => allNotes.push({ id: doc.id, ...doc.data() }));
    renderNotes();
    // Re-render categories on each state change to ensure sync
    renderCategories();
  });
}

function renderNotes() {
  if (!notesGridContainer) return;
  let filtered = allNotes;
  if (currentFilter !== "all") filtered = filtered.filter(n => n.category === currentFilter);
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    filtered = filtered.filter(n => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s));
  }
  
  // Sort: Pinned first, then descending by updatedAt
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const timeA = a.updatedAt ? (typeof a.updatedAt.toMillis === 'function' ? a.updatedAt.toMillis() : a.updatedAt) : 0;
    const timeB = b.updatedAt ? (typeof b.updatedAt.toMillis === 'function' ? b.updatedAt.toMillis() : b.updatedAt) : 0;
    return timeB - timeA;
  });

  if (filtered.length === 0) {
    notesGridContainer.innerHTML = `
      <div class="col-span-full py-32 flex flex-col items-center justify-center text-center animate-in">
        <div class="w-20 h-20 bg-slate-100 rounded-[28px] text-slate-300 flex items-center justify-center mb-6">
          <i data-lucide="feather" class="w-10 h-10"></i>
        </div>
        <h3 class="font-display text-2xl font-bold text-slate-800 mb-2">Workspace is looking empty</h3>
        <p class="text-slate-500 font-medium max-w-[260px] mx-auto leading-relaxed">It's a blank canvas. Start capturing your ideas or tasks today.</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  
  notesGridContainer.innerHTML = "";
  let hasRenderedPinnedHeader = false;
  let hasRenderedUnpinnedHeader = false;

  const hasPinned = filtered.some(n => n.pinned);
  const hasUnpinned = filtered.some(n => !n.pinned);

  filtered.forEach(note => {
    // Inject Section Headers
    if (note.pinned && !hasRenderedPinnedHeader) {
      const header = document.createElement("div");
      header.className = "col-span-full section-label mt-2";
      header.innerHTML = `<i data-lucide="pin" class="w-3 h-3 text-primary fill-primary"></i> Pinned`;
      notesGridContainer.appendChild(header);
      hasRenderedPinnedHeader = true;
    } else if (!note.pinned && !hasRenderedUnpinnedHeader && hasPinned) {
      const header = document.createElement("div");
      header.className = "col-span-full section-label mt-6";
      header.innerHTML = `Others`;
      notesGridContainer.appendChild(header);
      hasRenderedUnpinnedHeader = true;
    }

    const card = document.createElement("div");
    card.className = `note-card note-color-${note.color || 'default'} animate-in`;
    const temp = document.createElement("div");
    temp.innerHTML = note.content || "";
    const previewText = temp.textContent || "";
    card.innerHTML = `
      <div class="flex flex-col h-full overflow-hidden">
        <h3 class="text-[12px] font-bold text-slate-800 line-clamp-2 leading-tight uppercase tracking-tight mb-1.5">${escapeHtml(note.title) || 'Untitled'}</h3>
        ${note.pinned ? '<div class="note-pinned-badge"><i data-lucide="pin" class="w-2.5 h-2.5"></i> Pinned</div>' : ''}
        <p class="text-[11px] text-slate-500 line-clamp-4 leading-relaxed flex-1 overflow-hidden opacity-90">${escapeHtml(previewText)}</p>
        <div class="note-card-meta">
           <span class="note-card-meta-date">${formatDate(note.updatedAt)}</span>
           <span class="note-card-meta-cat">${note.category}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openEditModal(note));
    notesGridContainer.appendChild(card);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderAuthUI(user) {
  const elements = document.querySelectorAll(".auth-element");
  if (user) {
    elements.forEach(el => el.classList.remove("auth-hidden"));
    if (window.innerWidth >= 1024) {
      sidebar.style.transform = "translateX(0)";
      mainContent.classList.add("lg:ml-[280px]");
    }
    
    // Dynamic Greeting
    const welcomeGreeting = document.getElementById("welcomeGreeting");
    if (welcomeGreeting) {
       const displayName = user.email.split('@')[0];
       const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
       welcomeGreeting.textContent = `${getGreeting()}, ${formattedName}.`;
    }

    if (authContainer) {
      authContainer.innerHTML = `
        <div class="p-3 bg-white/50 border border-slate-100 rounded-xl group flex items-center justify-between shadow-sm">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-yellow-400 text-xs font-bold">${user.email[0]}</div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-800 truncate w-24">${user.email.split('@')[0]}</span>
                    <span class="text-[8px] font-bold text-slate-300 uppercase">Cloud Workspace</span>
                </div>
            </div>
            <button id="logoutBtn" class="p-2 hover:bg-rose-50 hover:text-rose-500 text-slate-300 rounded-lg transition-all"><i data-lucide="log-out" class="w-4 h-4"></i></button>
        </div>
      `;
      document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
    }
    notesGrid.classList.remove("hidden");
    loginSection.classList.add("hidden");
    subscribeToNotes(user.uid);
    subscribeToCategories(user.uid);
  } else {
    elements.forEach(el => el.classList.add("auth-hidden"));
    sidebar.style.transform = "translateX(-100%)";
    mainContent.classList.remove("lg:ml-[280px]");
    notesGrid.classList.add("hidden");
    loginSection.classList.remove("hidden");
    if (unsubscribeNotes) unsubscribeNotes();
    if (unsubscribeCategories) unsubscribeCategories();
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  initQuill(); // Performance: Init once on load

  document.getElementById("sidebarAddNoteBtn").addEventListener("click", openAddModal);
  document.getElementById("mobileAddNoteBtn")?.addEventListener("click", openAddModal);
  
  mobileMenuToggle.addEventListener("click", () => { sidebar.style.transform = "translateX(0)"; sidebarOverlay.classList.remove("hidden"); });
  mobileMenuBtn?.addEventListener("click", () => { sidebar.style.transform = "translateX(0)"; sidebarOverlay.classList.remove("hidden"); });
  closeSidebarBtn.addEventListener("click", () => { sidebar.style.transform = "translateX(-100%)"; sidebarOverlay.classList.add("hidden"); });
  sidebarOverlay.addEventListener("click", () => { sidebar.style.transform = "translateX(-100%)"; sidebarOverlay.classList.add("hidden"); });

  // Modal Buttons
  closeModal.addEventListener("click", closeNoteModalFunc);
  modalPinNoteBtn.addEventListener("click", () => { modalPinnedStatus = !modalPinnedStatus; updatePinUI(); checkChanges(); });
  modalAddChecklistItemBtn.addEventListener("click", () => addChecklistItem());
  modalSaveBtn.addEventListener("click", saveNote);
  modalDeleteBtn.addEventListener("click", triggerDeletion);
  
  // Entire Body Clickable to Focus Quill
  modalBody.addEventListener("click", (e) => {
    if (e.target.closest('#noteEditorContainer') || e.target.closest('#modalTitle') || e.target.closest('.checklist-item') || e.target.closest('select')) return;
    if (modalQuill) modalQuill.focus();
  });

  // Input Listeners
  modalTitle.addEventListener("input", checkChanges);
  modalCategorySelect.addEventListener("change", () => { updateColorUI(); checkChanges(); });
  colorPicker.addEventListener("click", (e) => {
    const swatch = e.target.closest(".color-swatch");
    if (swatch) { modalColor = swatch.dataset.color; updateColorUI(); checkChanges(); }
  });

  // Category Logic
  if (showAddCategoryBtn) {
    showAddCategoryBtn.addEventListener("click", () => { 
        showAddCategoryBtn.classList.add("hidden"); 
        addCategoryContainer.classList.remove("hidden"); 
        newCategoryInput.focus(); 
    });
  }
  if (newCategoryInput) {
    newCategoryInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await addCustomCategory();
        }
        if (e.key === "Escape") { 
            e.preventDefault();
            addCategoryContainer.classList.add("hidden"); 
            showAddCategoryBtn.classList.remove("hidden"); 
        }
    });
  }

  // Delete Confirmation Logic
  confirmDeleteBtn.addEventListener("click", deleteNoteConfirmed);
  cancelDeleteBtn.addEventListener("click", () => deleteConfirmModal.classList.add("hidden"));

  // Search & Profile
  searchInput.addEventListener("input", (e) => { searchTerm = e.target.value; renderNotes(); });

  // Auth Flow
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const pwd = document.getElementById("loginPassword").value;
    if (!email || !pwd) return showToast("Credentials required");
    try { await signInWithEmailAndPassword(auth, email, pwd); showToast("Authenticated"); } catch (err) { showToast(err.message, "error"); }
  });
  document.getElementById("signupBtn").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const pwd = document.getElementById("loginPassword").value;
    if (!email || !pwd || pwd.length < 6) return showToast("Min 6 chars");
    try { await createUserWithEmailAndPassword(auth, email, pwd); showToast("Workspace ready"); } catch (err) { showToast(err.message, "error"); }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024 && auth.currentUser) {
      sidebar.style.transform = "translateX(0)";
      mainContent.classList.add("lg:ml-[280px]");
    } else if (window.innerWidth < 1024) {
      sidebar.style.transform = "translateX(-100%)";
      mainContent.classList.remove("lg:ml-[280px]");
    }
  });
});

onAuthStateChanged(auth, renderAuthUI);
