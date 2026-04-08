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
let modalQuill = null;
let currentFilter = "all";
let modalPinnedStatus = false;
let modalChecklistItems = [];
let unsubscribeNotes = null;

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type} p-4 rounded-lg shadow-lg max-w-sm`;
  toast.innerHTML = `<div class="flex items-center gap-3"><p class="text-sm font-medium">${message}</p></div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3300);
}

function initModalQuill() {
  if (!modalQuill) {
    modalQuill = new Quill("#modalEditorContainer", {
      theme: "snow",
      modules: { toolbar: "#modalToolbar" },
      placeholder: "Write your note here...",
    });

    const toolbar = modalQuill.getModule("toolbar");
    toolbar.addHandler("image", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
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
      input.click();
    });
  }
}

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
        <button type="button" class="remove-checklist text-gray-400 hover:text-red-500">
            <i data-lucide="x" class="w-3 h-3"></i>
        </button>
    `;

  itemDiv
    .querySelector(".checklist-checkbox")
    .addEventListener("change", () => {
      if (itemDiv.querySelector(".checklist-checkbox").checked)
        itemDiv.classList.add("completed");
      else itemDiv.classList.remove("completed");
      updateModalChecklistItems();
    });
  itemDiv
    .querySelector(".checklist-text")
    .addEventListener("input", () => updateModalChecklistItems());
  itemDiv.querySelector(".remove-checklist").addEventListener("click", () => {
    itemDiv.remove();
    updateModalChecklistItems();
  });

  modalChecklistContainer.appendChild(itemDiv);
  if (completed) itemDiv.classList.add("completed");
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

function showAddNoteModal() {
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
}

async function saveModalNote() {
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

  saveModalNoteBtn.disabled = true;
  saveModalNoteBtn.innerHTML =
    '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

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
  }
}

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

function subscribeToNotes(userId) {
  if (unsubscribeNotes) unsubscribeNotes();
  const q = query(
    collection(db, "notes"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  unsubscribeNotes = onSnapshot(q, (snapshot) => {
    if (!notesGridContainer) return;

    let notes = [];
    snapshot.forEach((doc) => notes.push({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (currentFilter !== "all")
      notes = notes.filter((n) => n.category === currentFilter);

    if (notes.length === 0) {
      notesGridContainer.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">No notes yet. Click "Add Note" to create one!</div>`;
      return;
    }

    let html = "";
    notes.forEach((note) => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = note.content || "";
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      const contentPreview =
        plainText.substring(0, 100) ||
        (note.checklist?.length
          ? `${note.checklist.length} checklist item(s)`
          : "No content");

      html += `
                <div class="note-card ${
                  note.pinned ? "pinned" : ""
                } p-5 group cursor-pointer" onclick="window.openNoteModal(${JSON.stringify(
        note
      ).replace(/</g, "\\u003c")})">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-semibold text-gray-900 flex-1 text-lg pr-2 line-clamp-1">${
                          escapeHtml(note.title) || "Untitled"
                        }</h3>
                        <button type="button" class="opacity-0 group-hover:opacity-100 w-7 h-7 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors flex-shrink-0" onclick="event.stopPropagation(); window.deleteNote('${
                          note.id
                        }')">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
                        </button>
                    </div>
                    <p class="text-sm text-gray-600 line-clamp-3 mb-4">${escapeHtml(
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
    notesGridContainer.innerHTML = html;
    lucide.createIcons();
  });
}

function renderAuthUI(user) {
  if (user) {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove("-translate-x-full");
    }

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
                <button id="logoutBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-white px-4 py-2.5 rounded-full hover:bg-red-500 transition-all border border-gray-200">
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
    subscribeToNotes(user.uid);
    lucide.createIcons();
  } else {
    sidebar.classList.add("-translate-x-full");
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
document
  .getElementById("desktopAddNoteBtn")
  ?.addEventListener("click", showAddNoteModal);
closeAddNoteModal?.addEventListener("click", closeAddNoteModalFunc);
cancelModalNoteBtn?.addEventListener("click", closeAddNoteModalFunc);
saveModalNoteBtn?.addEventListener("click", saveModalNote);
closeModal?.addEventListener("click", closeNoteModal);
modalDelete?.addEventListener("click", () => deleteNote(currentNoteId));
modalSave?.addEventListener("click", updateNote);
modalPinNoteBtn?.addEventListener("click", () => {
  modalPinnedStatus = !modalPinnedStatus;
  if (modalPinnedStatus) {
    modalPinNoteBtn.classList.add("text-gray-800");
    modalPinNoteBtn.classList.remove("text-gray-400");
  } else {
    modalPinNoteBtn.classList.add("text-gray-400");
    modalPinNoteBtn.classList.remove("text-gray-800");
  }
});
modalAddChecklistBtn?.addEventListener("click", () =>
  addModalChecklistItem("", false)
);

mobileMenuToggle?.addEventListener("click", openMobileSidebar);
mobileMenuBtn?.addEventListener("click", openMobileSidebar);
closeSidebarBtn?.addEventListener("click", closeMobileSidebar);
sidebarOverlay?.addEventListener("click", closeMobileSidebar);

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

document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  if (!email || !pwd) return showToast("Enter email and password", "warning");
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    showToast("Welcome back!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  if (!email || !pwd) return showToast("Enter email and password", "warning");
  if (pwd.length < 6)
    return showToast("Password must be 6+ characters", "warning");
  try {
    await createUserWithEmailAndPassword(auth, email, pwd);
    showToast("Account created successfully!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

onAuthStateChanged(auth, renderAuthUI);

window.openNoteModal = openNoteModal;
window.deleteNote = deleteNote;
