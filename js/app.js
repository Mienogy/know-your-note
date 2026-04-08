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
const loginSection = document.getElementById("loginSection");
const modal = document.getElementById("noteModal");
const addNoteModal = document.getElementById("addNoteModal");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const modalCategory = document.getElementById("modalCategory");
const modalLabels = document.getElementById("modalLabels");
const modalChecklist = document.getElementById("modalChecklist");
const closeModal = document.getElementById("closeModal");
const modalDelete = document.getElementById("modalDelete");
const modalSave = document.getElementById("modalSave");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");

// Modal Add Note Elements
const modalNoteTitle = document.getElementById("modalNoteTitle");
const modalNoteCategory = document.getElementById("modalNoteCategory");
const modalNoteLabels = document.getElementById("modalNoteLabels");
const modalPinNoteBtn = document.getElementById("modalPinNoteBtn");
const modalAddChecklistBtn = document.getElementById("modalAddChecklistBtn");
const modalChecklistContainer = document.getElementById(
  "modalChecklistContainer"
);
const closeAddNoteModal = document.getElementById("closeAddNoteModal");
const cancelModalNoteBtn = document.getElementById("cancelModalNoteBtn");
const saveModalNoteBtn = document.getElementById("saveModalNoteBtn");

let currentNoteId = null;
let quill = null;
let modalQuill = null;
let currentFilter = "all";
let currentPinnedStatus = false;
let modalPinnedStatus = false;
let checklistItems = [];
let modalChecklistItems = [];
let currentNotes = [];
let isSaving = false;

// Toast Functions
function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type} p-4 rounded-lg shadow-lg max-w-sm`;
  toast.innerHTML = `<div class="flex items-center gap-3"><p class="text-sm font-medium">${message}</p></div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3300);
}

// Initialize Quill for Modal
function initModalQuill() {
  if (!modalQuill) {
    modalQuill = new Quill("#modalEditorContainer", {
      theme: "snow",
      modules: { toolbar: "#modalToolbar" },
      placeholder: "Write your note here...",
    });

    const imageHandler = () => {
      const input = document.createElement("input");
      input.setAttribute("type", "file");
      input.setAttribute("accept", "image/*");
      input.click();
      input.onchange = () => {
        const file = input.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const range = modalQuill.getSelection();
            modalQuill.insertEmbed(range.index, "image", e.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
    };
    const toolbar = modalQuill.getModule("toolbar");
    toolbar.addHandler("image", imageHandler);
  }
}

// Modal Checklist Functions
function addModalChecklistItem(text = "", completed = false) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "checklist-item";
  itemDiv.innerHTML = `
        <input type="checkbox" ${
          completed ? "checked" : ""
        } class="checklist-checkbox">
        <input type="text" value="${escapeHtml(
          text
        )}" placeholder="Checklist item..." class="checklist-text">
        <button class="remove-checklist text-gray-400 hover:text-red-500">
            <i data-lucide="x" class="w-3 h-3"></i>
        </button>
    `;

  const checkbox = itemDiv.querySelector(".checklist-checkbox");
  const textInput = itemDiv.querySelector(".checklist-text");
  const removeBtn = itemDiv.querySelector(".remove-checklist");

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) itemDiv.classList.add("completed");
    else itemDiv.classList.remove("completed");
    updateModalChecklistItems();
  });
  textInput.addEventListener("input", () => updateModalChecklistItems());
  removeBtn.addEventListener("click", () => {
    itemDiv.remove();
    updateModalChecklistItems();
  });

  modalChecklistContainer.appendChild(itemDiv);
  if (checkbox.checked) itemDiv.classList.add("completed");
  updateModalChecklistItems();
  lucide.createIcons();
}

function updateModalChecklistItems() {
  modalChecklistItems = [];
  document
    .querySelectorAll("#modalChecklistContainer .checklist-item")
    .forEach((item) => {
      modalChecklistItems.push({
        text: item.querySelector(".checklist-text").value,
        completed: item.querySelector(".checklist-checkbox").checked,
      });
    });
}

// Show Add Note Modal
function showAddNoteModal() {
  // Reset form
  modalNoteTitle.value = "";
  if (modalQuill) modalQuill.root.innerHTML = "";
  modalNoteCategory.value = "personal";
  modalNoteLabels.value = "";
  modalChecklistContainer.innerHTML = "";
  modalChecklistItems = [];
  modalPinnedStatus = false;
  modalPinNoteBtn.classList.remove("text-gray-800");
  modalPinNoteBtn.classList.add("text-gray-400");

  addNoteModal.classList.remove("hidden");
  addNoteModal.classList.add("active");
  setTimeout(() => modalNoteTitle.focus(), 100);
  initModalQuill();
  lucide.createIcons();
}

function closeAddNoteModalFunc() {
  addNoteModal.classList.add("hidden");
  addNoteModal.classList.remove("active");
  isSaving = false;
}

// Save Note from Modal
async function saveModalNote() {
  if (isSaving) return;

  const user = auth.currentUser;
  if (!user) return;

  const title = modalNoteTitle.value.trim();
  const content = modalQuill ? modalQuill.root.innerHTML : "";
  const category = modalNoteCategory.value;
  const labels = modalNoteLabels.value
    .split(",")
    .map((l) => l.trim())
    .filter((l) => l);
  const pinned = modalPinnedStatus;

  if (
    !title &&
    (!content || content === "<p><br></p>") &&
    modalChecklistItems.length === 0
  ) {
    showToast("Please add a title, content, or checklist item", "warning");
    return;
  }

  isSaving = true;
  saveModalNoteBtn.innerHTML =
    '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
  saveModalNoteBtn.disabled = true;

  try {
    await addDoc(collection(db, "notes"), {
      userId: user.uid,
      title: title || "Untitled",
      content: content,
      category: category,
      labels: labels,
      pinned: pinned,
      checklist: modalChecklistItems,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    closeAddNoteModalFunc();
    showToast("Note saved successfully!", "success");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  } finally {
    saveModalNoteBtn.innerHTML = "Save Note";
    saveModalNoteBtn.disabled = false;
    isSaving = false;
  }
}

// Pin toggle for modal
modalPinNoteBtn.addEventListener("click", () => {
  modalPinnedStatus = !modalPinnedStatus;
  if (modalPinnedStatus) {
    modalPinNoteBtn.classList.add("text-gray-800");
    modalPinNoteBtn.classList.remove("text-gray-400");
  } else {
    modalPinNoteBtn.classList.add("text-gray-400");
    modalPinNoteBtn.classList.remove("text-gray-800");
  }
});

modalAddChecklistBtn.addEventListener("click", () =>
  addModalChecklistItem("", false)
);

// Sidebar mobile functions
function openMobileSidebar() {
  sidebar.classList.add("mobile-open");
  sidebarOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeMobileSidebar() {
  sidebar.classList.remove("mobile-open");
  sidebarOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function toggleMobileSidebar() {
  if (sidebar.classList.contains("mobile-open")) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

// Event listeners for mobile
mobileMenuToggle?.addEventListener("click", toggleMobileSidebar);
mobileMenuBtn?.addEventListener("click", toggleMobileSidebar);
closeSidebarBtn?.addEventListener("click", closeMobileSidebar);
sidebarOverlay?.addEventListener("click", closeMobileSidebar);

// Open Note Modal
function openNoteModal(note) {
  currentNoteId = note.id;
  modalTitle.value = note.title || "";
  modalContent.innerHTML = note.content || "";
  modalCategory.textContent = note.category;
  modalCategory.className = `category-badge category-${note.category}`;
  modalLabels.textContent = note.labels?.join(", ") || "No labels";

  if (note.checklist?.length) {
    modalChecklist.innerHTML =
      '<p class="font-medium text-sm mb-2">Checklist:</p>';
    note.checklist.forEach((item) => {
      modalChecklist.innerHTML += `
                <div class="flex items-center gap-2 py-1">
                    <input type="checkbox" ${
                      item.completed ? "checked" : ""
                    } class="w-4 h-4" style="accent-color: #374151">
                    <span class="${
                      item.completed ? "line-through text-gray-400" : ""
                    } text-sm">${escapeHtml(item.text)}</span>
                </div>
            `;
    });
  } else {
    modalChecklist.innerHTML = "";
  }

  modal.classList.remove("hidden");
  modal.classList.add("active");
  lucide.createIcons();
}

async function updateNote() {
  if (!currentNoteId) return;
  try {
    await updateDoc(doc(db, "notes", currentNoteId), {
      title: modalTitle.value.trim() || "Untitled",
      content: modalContent.innerHTML,
      updatedAt: serverTimestamp(),
    });
    closeNoteModal();
    showToast("Note updated!", "success");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

async function deleteNote(id) {
  if (confirm("Delete this note?")) {
    await deleteDoc(doc(db, "notes", id));
    closeNoteModal();
    showToast("Note deleted!", "success");
  }
}

function closeNoteModal() {
  modal.classList.add("hidden");
  modal.classList.remove("active");
  currentNoteId = null;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>]/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m])
  );
}

// Subscribe to Notes
let unsubscribeNotes = null;

function subscribeToNotes(userId) {
  if (unsubscribeNotes) unsubscribeNotes();
  const q = query(
    collection(db, "notes"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  unsubscribeNotes = onSnapshot(q, (snapshot) => {
    const gridContainer = notesGrid.querySelector(".grid");
    if (!gridContainer) return;

    let notes = [];
    snapshot.forEach((doc) => notes.push({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    currentNotes = notes;

    if (currentFilter !== "all")
      notes = notes.filter((n) => n.category === currentFilter);

    if (notes.length === 0) {
      gridContainer.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">No notes yet. Click "Add Note" to create one!</div>`;
      return;
    }

    let html = "";
    notes.forEach((note, index) => {
      const plainContent = note.content
        ? note.content.replace(/<[^>]*>/g, "").substring(0, 120)
        : "";
      const hasChecklist = note.checklist?.length > 0;
      const contentPreview =
        plainContent ||
        (hasChecklist
          ? `${note.checklist.length} checklist item(s)`
          : "No content");

      html += `
                <div class="note-card ${
                  note.pinned ? "pinned" : ""
                } p-5 group cursor-pointer" onclick="window.openNoteModal(${JSON.stringify(
        note
      )})">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-semibold text-gray-900 flex-1 text-lg">${
                          escapeHtml(note.title) || "Untitled"
                        }</h3>
                        <button class="opacity-0 group-hover:opacity-100 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors" onclick="event.stopPropagation(); window.deleteNote('${
                          note.id
                        }')">
                            <i data-lucide="trash-2" class="w-3 h-3 text-red-600"></i>
                        </button>
                    </div>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-4">${escapeHtml(
                      contentPreview
                    )}</p>
                    <div class="flex items-center justify-between">
                        <span class="category-badge category-${
                          note.category
                        }">${note.category}</span>
                        <span class="text-xs text-gray-400">${formatDate(
                          note.updatedAt
                        )}</span>
                    </div>
                </div>
            `;
    });
    gridContainer.innerHTML = html;
    lucide.createIcons();
  });
}

// Render Auth UI
function renderAuthUI(user) {
  if (user) {
    sidebar.classList.remove("hidden");
    mobileMenuToggle?.classList.remove("hidden");
    authContainer.innerHTML = `
            <div class="space-y-4">
                <div class="text-center p-3 bg-gray-50 rounded-xl">
                    <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i data-lucide="user" class="w-5 h-5 text-white"></i>
                    </div>
                    <p class="text-sm font-medium text-gray-700 truncate">${escapeHtml(
                      user.email
                    )}</p>
                </div>
                <button id="logoutBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-white px-4 py-2.5 rounded-[2rem] hover:bg-red-500 transition-all border border-gray-200">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                    Sign out
                </button>
            </div>
        `;
    document
      .getElementById("logoutBtn")
      ?.addEventListener("click", () => signOut(auth));

    notesGrid.classList.remove("hidden");
    loginSection.classList.add("hidden");
    notesGrid.innerHTML =
      '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5"></div>';
    subscribeToNotes(user.uid);
    lucide.createIcons();
  } else {
    sidebar.classList.add("hidden");
    mobileMenuToggle?.classList.add("hidden");
    authContainer.innerHTML = "";
    notesGrid.classList.add("hidden");
    loginSection.classList.remove("hidden");
    if (unsubscribeNotes) unsubscribeNotes();
    lucide.createIcons();
  }
}

// Event Listeners
document
  .getElementById("sidebarAddNoteBtn")
  ?.addEventListener("click", showAddNoteModal);
document
  .getElementById("mobileAddNoteBtn")
  ?.addEventListener("click", showAddNoteModal);
closeAddNoteModal?.addEventListener("click", closeAddNoteModalFunc);
cancelModalNoteBtn?.addEventListener("click", closeAddNoteModalFunc);
saveModalNoteBtn?.addEventListener("click", saveModalNote);
closeModal?.addEventListener("click", closeNoteModal);
modalDelete?.addEventListener("click", () => deleteNote(currentNoteId));
modalSave?.addEventListener("click", updateNote);

// Category Filters
document.querySelectorAll(".category-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".category-filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.category;
    if (auth.currentUser) subscribeToNotes(auth.currentUser.uid);
  });
});

// Login/Signup
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  if (!email || !pwd) return showToast("Enter email and password", "warning");
  await signInWithEmailAndPassword(auth, email, pwd).catch((err) =>
    showToast(err.message, "error")
  );
});

document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  if (!email || !pwd) return showToast("Enter email and password", "warning");
  if (pwd.length < 6)
    return showToast("Password must be 6+ characters", "warning");
  await createUserWithEmailAndPassword(auth, email, pwd).catch((err) =>
    showToast(err.message, "error")
  );
});

onAuthStateChanged(auth, renderAuthUI);

// Make global
window.openNoteModal = openNoteModal;
window.deleteNote = deleteNote;
