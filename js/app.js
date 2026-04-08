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
const notesGridContainer = document.getElementById("notesGridContainer");
const loginSection = document.getElementById("loginSection");
const addNoteModal = document.getElementById("addNoteModal");
const viewNoteModal = document.getElementById("noteModal");
const modalNoteTitle = document.getElementById("modalNoteTitle");
const modalNoteCategory = document.getElementById("modalNoteCategory");
const modalPinNoteBtn = document.getElementById("modalPinNoteBtn");
const modalAddChecklistBtn = document.getElementById("modalAddChecklistBtn");
const modalChecklistContainer = document.getElementById(
  "modalChecklistContainer"
);
const closeAddNoteModal = document.getElementById("closeAddNoteModal");
const cancelModalNoteBtn = document.getElementById("cancelModalNoteBtn");
const saveModalNoteBtn = document.getElementById("saveModalNoteBtn");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const modalCategory = document.getElementById("modalCategory");
const modalChecklist = document.getElementById("modalChecklist");
const closeModal = document.getElementById("closeModal");
const modalDelete = document.getElementById("modalDelete");
const modalSave = document.getElementById("modalSave");
const mainContent = document.getElementById("mainContent");
const desktopHeader = document.getElementById("desktopHeader");

// Sidebar Elements
const sidebar = document.getElementById("sidebar");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");

let currentNoteId = null;
let modalQuill = null;
let currentFilter = "all";
let modalPinnedStatus = false;
let modalChecklistItems = [];
let unsubscribeNotes = null;

// Track original values for edit detection
let originalTitle = "";
let originalContent = "";

// Helper Functions
function getUserGreeting(email) {
  if (!email) return "Your Notes";
  const name = email.split("@")[0];
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  return `Hello, ${displayName}!`;
}

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) return;
  const toast = document.createElement("div");
  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    warning: "bg-yellow-600",
    info: "bg-gray-800",
  };
  toast.className = `toast ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function initModalQuill() {
  const editorContainer = document.getElementById("modalEditorContainer");
  if (!modalQuill && editorContainer) {
    modalQuill = new Quill("#modalEditorContainer", {
      theme: "snow",
      modules: { toolbar: "#modalToolbar" },
      placeholder: "Write your note here...",
    });
    const toolbar = modalQuill.getModule("toolbar");
    if (toolbar && toolbar.removeHandler) {
      toolbar.removeHandler("image");
    }
  }
}

function addModalChecklistItem(text = "", completed = false) {
  if (!modalChecklistContainer) return;
  const itemDiv = document.createElement("div");
  itemDiv.className = "checklist-item";
  itemDiv.innerHTML = `
        <input type="checkbox" ${
          completed ? "checked" : ""
        } class="checklist-checkbox">
        <input type="text" value="${escapeHtml(
          text
        )}" placeholder="Checklist item..." class="checklist-text">
        <button type="button" class="remove-checklist">✕</button>
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
  if (completed) itemDiv.classList.add("completed");
  updateModalChecklistItems();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function updateModalChecklistItems() {
  modalChecklistItems = [];
  if (!modalChecklistContainer) return;
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
  if (!modalNoteTitle) return;
  modalNoteTitle.value = "";
  if (modalQuill) modalQuill.root.innerHTML = "";
  if (modalNoteCategory) modalNoteCategory.value = "personal";
  if (modalChecklistContainer) modalChecklistContainer.innerHTML = "";
  modalChecklistItems = [];
  modalPinnedStatus = false;
  if (modalPinNoteBtn) {
    modalPinNoteBtn.classList.remove("text-amber-500", "bg-amber-50");
    modalPinNoteBtn.classList.add("text-gray-400");
  }
  if (addNoteModal) {
    addNoteModal.classList.remove("hidden");
    addNoteModal.classList.add("flex");
  }
  initModalQuill();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeAddNoteModalFunc() {
  if (addNoteModal) {
    addNoteModal.classList.add("hidden");
    addNoteModal.classList.remove("flex");
  }
}

async function saveModalNote() {
  const user = auth.currentUser;
  if (!user) return;

  const title = modalNoteTitle ? modalNoteTitle.value.trim() : "";
  const content = modalQuill ? modalQuill.root.innerHTML : "";
  const category = modalNoteCategory ? modalNoteCategory.value : "personal";
  const pinned = modalPinnedStatus;

  if (
    !title &&
    (!content || content === "<p><br></p>") &&
    modalChecklistItems.length === 0
  ) {
    showToast("Please add a title, content, or checklist item", "warning");
    return;
  }

  if (saveModalNoteBtn) {
    saveModalNoteBtn.disabled = true;
    saveModalNoteBtn.innerHTML = "Saving...";
  }

  try {
    await addDoc(collection(db, "notes"), {
      userId: user.uid,
      title: title || "Untitled",
      content: content,
      category: category,
      pinned: pinned,
      checklist: modalChecklistItems,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    closeAddNoteModalFunc();
    showToast("Note saved!", "success");
  } catch (error) {
    showToast("Error: " + error.message, "error");
  } finally {
    if (saveModalNoteBtn) {
      saveModalNoteBtn.innerHTML = "Save Note";
      saveModalNoteBtn.disabled = false;
    }
  }
}

function openNoteModal(note) {
  currentNoteId = note.id;
  originalTitle = note.title || "";
  originalContent = note.content || "";

  if (modalTitle) {
    modalTitle.value = originalTitle;
    modalTitle.removeAttribute("readonly");
  }

  if (modalContent) {
    modalContent.innerHTML = originalContent;
    modalContent.setAttribute("contenteditable", "true");
  }

  if (modalCategory) {
    modalCategory.textContent = note.category;
    modalCategory.className = `category-badge category-${note.category}`;
  }

  if (modalSave) {
    modalSave.disabled = true;
    modalSave.classList.add("opacity-50", "cursor-not-allowed");
    modalSave.classList.remove("hover:bg-gray-900");
  }

  if (modalChecklist) {
    if (note.checklist && note.checklist.length) {
      modalChecklist.innerHTML =
        '<p class="font-medium text-sm mb-2">Checklist:</p>';
      note.checklist.forEach((item) => {
        modalChecklist.innerHTML += `
                    <div class="flex items-center gap-2 py-1">
                        <input type="checkbox" ${
                          item.completed ? "checked" : ""
                        } class="w-4 h-4" style="accent-color: #1f2937">
                        <span class="${
                          item.completed ? "line-through text-gray-400" : ""
                        } text-sm">${escapeHtml(item.text)}</span>
                    </div>
                `;
      });
    } else {
      modalChecklist.innerHTML = "";
    }
  }

  if (viewNoteModal) {
    viewNoteModal.classList.remove("hidden");
    viewNoteModal.classList.add("flex");
  }

  // Setup formatting toolbar for view modal
  setupViewModalFormatting();

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function hasContentChanged() {
  const currentTitle = modalTitle ? modalTitle.value.trim() : "";
  const currentContent = modalContent ? modalContent.innerText.trim() : "";
  const originalTitleTrimmed = originalTitle.trim();
  const originalContentTrimmed = originalContent.trim();

  return (
    currentTitle !== originalTitleTrimmed ||
    currentContent !== originalContentTrimmed
  );
}

function checkAndEnableSave() {
  if (!modalSave) return;
  const currentTitle = modalTitle ? modalTitle.value.trim() : "";
  const currentContent = modalContent ? modalContent.innerText.trim() : "";
  const originalTitleTrimmed = originalTitle.trim();
  const originalContentTrimmed = originalContent.trim();

  if (
    currentTitle !== originalTitleTrimmed ||
    currentContent !== originalContentTrimmed
  ) {
    modalSave.disabled = false;
    modalSave.classList.remove("opacity-50", "cursor-not-allowed");
    modalSave.classList.add("hover:bg-gray-900");
  } else {
    modalSave.disabled = true;
    modalSave.classList.add("opacity-50", "cursor-not-allowed");
    modalSave.classList.remove("hover:bg-gray-900");
  }
}
async function updateNote() {
  if (!currentNoteId) return;

  if (!hasContentChanged()) {
    showToast("No changes to save", "info");
    return;
  }

  if (modalSave) {
    modalSave.disabled = true;
    const originalText = modalSave.innerHTML;
    modalSave.innerHTML =
      '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

    try {
      await updateDoc(doc(db, "notes", currentNoteId), {
        title: modalTitle ? modalTitle.value.trim() || "Untitled" : "Untitled",
        content: modalContent ? modalContent.innerHTML : "",
        updatedAt: serverTimestamp(),
      });
      if (viewNoteModal) viewNoteModal.classList.add("hidden");
      showToast("Note updated!", "success");
    } catch (error) {
      showToast("Error: " + error.message, "error");
      modalSave.disabled = false;
      modalSave.innerHTML = originalText;
    }
  }
}

async function deleteNote(id) {
  if (confirm("Delete this note?")) {
    await deleteDoc(doc(db, "notes", id));
    if (viewNoteModal) viewNoteModal.classList.add("hidden");
    showToast("Note deleted!", "success");
  }
}

function closeNoteModal() {
  if (viewNoteModal) {
    viewNoteModal.classList.add("hidden");
    viewNoteModal.classList.remove("flex");
  }
  currentNoteId = null;
  if (modalSave) modalSave.disabled = false;
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

    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (currentFilter !== "all")
      notes = notes.filter((n) => n.category === currentFilter);

    if (notes.length === 0) {
      notesGridContainer.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">No notes yet. Click "Add Note" to create one!</div>`;
      return;
    }

    notesGridContainer.innerHTML = "";
    notes.forEach((note) => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = note.content || "";
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      const contentPreview =
        plainText.substring(0, 100) ||
        (note.checklist?.length
          ? `${note.checklist.length} checklist item(s)`
          : "No content");

      const card = document.createElement("div");
      card.className = `note-card bg-white rounded-xl border ${
        note.pinned ? "border-amber-200 shadow-md" : "border-gray-200"
      } p-5 cursor-pointer hover:shadow-md transition-all relative`;
      if (note.pinned) {
        card.classList.add("bg-gradient-to-br", "from-white", "to-amber-50");
      }

      card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-start gap-2 flex-1">
                        ${
                          note.pinned
                            ? '<i data-lucide="pin" class="w-4 h-4 text-amber-500 rotate-45 flex-shrink-0 mt-0.5"></i>'
                            : ""
                        }
                        <h3 class="font-semibold text-gray-900 text-lg break-words whitespace-normal leading-tight" style="word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${
                          escapeHtml(note.title) || "Untitled"
                        }</h3>
                    </div>
                    <button class="delete-note-btn text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <p class="text-sm text-gray-600 line-clamp-3 mb-4">${escapeHtml(
                  contentPreview
                )}</p>
                <div class="flex items-center justify-between">
                    <span class="category-badge category-${note.category}">${
        note.category
      }</span>
                    <span class="text-xs text-gray-400">${formatDate(
                      note.updatedAt
                    )}</span>
                </div>
            `;

      card.addEventListener("click", (e) => {
        if (!e.target.closest(".delete-note-btn")) openNoteModal(note);
      });
      const deleteBtn = card.querySelector(".delete-note-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteNote(note.id);
        });
      }
      notesGridContainer.appendChild(card);
    });
    if (typeof lucide !== "undefined") lucide.createIcons();
  });
}

// Sidebar Functions
function openMobileSidebar() {
  if (window.innerWidth < 768 && sidebar) {
    sidebar.style.transform = "translateX(0)";
    if (sidebarOverlay) sidebarOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeMobileSidebar() {
  if (window.innerWidth < 768 && sidebar) {
    sidebar.style.transform = "translateX(-100%)";
    if (sidebarOverlay) sidebarOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

function handleResize() {
  const mobileMenuToggleElem = document.getElementById("mobileMenuToggle");
  const mobileHeaderElem = document.getElementById("mobileHeader");

  if (window.innerWidth >= 768) {
    closeMobileSidebar();
    if (auth.currentUser && sidebar) {
      sidebar.style.transform = "translateX(0)";
      if (mainContent) mainContent.classList.add("md:ml-64");
      if (mobileMenuToggleElem) {
        mobileMenuToggleElem.classList.add("hidden");
        mobileMenuToggleElem.style.display = "none";
      }
      if (mobileHeaderElem) {
        mobileHeaderElem.classList.add("hidden");
        mobileHeaderElem.style.display = "none";
      }
    }
  } else {
    if (auth.currentUser && sidebar) {
      sidebar.style.transform = "translateX(-100%)";
      if (mainContent) mainContent.classList.remove("md:ml-64");
      if (mobileMenuToggleElem) {
        mobileMenuToggleElem.classList.remove("hidden");
        mobileMenuToggleElem.style.display = "block";
      }
      if (mobileHeaderElem) {
        mobileHeaderElem.classList.remove("hidden");
        mobileHeaderElem.style.display = "flex";
      }
    }
  }
}

function renderAuthUI(user) {
  const mobileHeader = document.getElementById("mobileHeader");
  const mobileMenuToggleElem = document.getElementById("mobileMenuToggle");
  const welcomeGreeting = document.getElementById("welcomeGreeting");
  const userEmailDisplay = document.getElementById("userEmailDisplay");

  if (user) {
    // User is logged in - show desktop header
    if (desktopHeader) desktopHeader.classList.remove("hidden");

    if (window.innerWidth >= 768) {
      if (sidebar) sidebar.style.transform = "translateX(0)";
      if (mainContent) mainContent.classList.add("md:ml-64");
      if (mobileMenuToggleElem) mobileMenuToggleElem.classList.add("hidden");
      if (mobileHeader) mobileHeader.classList.add("hidden");
    } else {
      if (sidebar) sidebar.style.transform = "translateX(-100%)";
      if (mainContent) mainContent.classList.remove("md:ml-64");
      if (mobileMenuToggleElem) {
        mobileMenuToggleElem.classList.remove("hidden");
        mobileMenuToggleElem.style.display = "block";
      }
      if (mobileHeader) {
        mobileHeader.classList.remove("hidden");
        mobileHeader.style.display = "flex";
      }
    }

    if (welcomeGreeting) {
      welcomeGreeting.textContent = getUserGreeting(user.email);
    }
    if (userEmailDisplay) {
      userEmailDisplay.textContent = user.email;
    }

    if (authContainer) {
      authContainer.innerHTML = `
                <div class="text-center mb-3">
                    <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i data-lucide="user" class="w-5 h-5 text-white"></i>
                    </div>
                    <p class="text-sm font-medium text-gray-700 truncate">${escapeHtml(
                      user.email
                    )}</p>
                </div>
                <button id="logoutBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-white px-4 py-2 rounded-full hover:bg-red-500 transition-all border border-gray-200">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                    Sign out
                </button>
            `;
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));
    }

    if (notesGrid) notesGrid.classList.remove("hidden");
    if (loginSection) loginSection.classList.add("hidden");
    subscribeToNotes(user.uid);
  } else {
    // User is logged out - hide desktop header
    if (desktopHeader) desktopHeader.classList.add("hidden");

    if (sidebar) sidebar.style.transform = "translateX(-100%)";
    if (mainContent) mainContent.classList.remove("md:ml-64");

    if (mobileMenuToggleElem) {
      mobileMenuToggleElem.classList.add("hidden");
      mobileMenuToggleElem.style.display = "none";
    }
    if (mobileHeader) {
      mobileHeader.classList.add("hidden");
      mobileHeader.style.display = "none";
    }

    if (welcomeGreeting) welcomeGreeting.textContent = "Your Notes";
    if (userEmailDisplay) userEmailDisplay.textContent = "";

    if (authContainer) authContainer.innerHTML = "";
    if (notesGrid) notesGrid.classList.add("hidden");
    if (loginSection) loginSection.classList.remove("hidden");
    if (unsubscribeNotes) unsubscribeNotes();
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Formatting functions for view modal
function applyViewFormat(command, value = null) {
  document.execCommand(command, false, value);
  checkAndEnableSave();
}

function setupViewModalFormatting() {
  const boldBtn = document.querySelector(".view-bold");
  const italicBtn = document.querySelector(".view-italic");
  const underlineBtn = document.querySelector(".view-underline");
  const alignBtn = document.querySelector(".view-align");
  const listBtn = document.querySelector(".view-list");
  const linkBtn = document.querySelector(".view-link");

  if (boldBtn) boldBtn.addEventListener("click", () => applyViewFormat("bold"));
  if (italicBtn)
    italicBtn.addEventListener("click", () => applyViewFormat("italic"));
  if (underlineBtn)
    underlineBtn.addEventListener("click", () => applyViewFormat("underline"));
  if (alignBtn)
    alignBtn.addEventListener("click", () => applyViewFormat("justifyLeft"));
  if (listBtn)
    listBtn.addEventListener("click", () =>
      applyViewFormat("insertUnorderedList")
    );
  if (linkBtn) {
    linkBtn.addEventListener("click", () => {
      const url = prompt("Enter URL:", "https://");
      if (url) applyViewFormat("createLink", url);
    });
  }
}

// Setup Event Listeners - Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  // Add Note buttons
  const sidebarAddBtn = document.getElementById("sidebarAddNoteBtn");
  const mobileAddBtn = document.getElementById("mobileAddNoteBtn");
  if (sidebarAddBtn) sidebarAddBtn.addEventListener("click", showAddNoteModal);
  if (mobileAddBtn) mobileAddBtn.addEventListener("click", showAddNoteModal);

  // Modal buttons
  if (closeAddNoteModal)
    closeAddNoteModal.addEventListener("click", closeAddNoteModalFunc);
  if (cancelModalNoteBtn)
    cancelModalNoteBtn.addEventListener("click", closeAddNoteModalFunc);
  if (saveModalNoteBtn)
    saveModalNoteBtn.addEventListener("click", saveModalNote);
  if (closeModal) closeModal.addEventListener("click", closeNoteModal);
  if (modalDelete)
    modalDelete.addEventListener("click", () => deleteNote(currentNoteId));
  if (modalSave) modalSave.addEventListener("click", updateNote);

  // Pin button
  if (modalPinNoteBtn) {
    modalPinNoteBtn.addEventListener("click", () => {
      modalPinnedStatus = !modalPinnedStatus;
      if (modalPinnedStatus) {
        modalPinNoteBtn.classList.add("text-amber-500", "bg-amber-50");
        modalPinNoteBtn.classList.remove("text-gray-400");
        const pinIcon = modalPinNoteBtn.querySelector("i");
        if (pinIcon) pinIcon.style.transform = "rotate(45deg)";
      } else {
        modalPinNoteBtn.classList.remove("text-amber-500", "bg-amber-50");
        modalPinNoteBtn.classList.add("text-gray-400");
        const pinIcon = modalPinNoteBtn.querySelector("i");
        if (pinIcon) pinIcon.style.transform = "";
      }
    });
  }

  // Checklist button
  if (modalAddChecklistBtn) {
    modalAddChecklistBtn.addEventListener("click", () =>
      addModalChecklistItem("", false)
    );
  }

  // Edit detection
  if (modalTitle) modalTitle.addEventListener("input", checkAndEnableSave);
  if (modalContent) {
    modalContent.addEventListener("input", checkAndEnableSave);
    modalContent.addEventListener("keyup", checkAndEnableSave);
    modalContent.addEventListener("blur", checkAndEnableSave);

    const contentObserver = new MutationObserver(() => checkAndEnableSave());
    contentObserver.observe(modalContent, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Sidebar events
  if (mobileMenuToggle)
    mobileMenuToggle.addEventListener("click", openMobileSidebar);
  if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileSidebar);
  if (closeSidebarBtn)
    closeSidebarBtn.addEventListener("click", closeMobileSidebar);
  if (sidebarOverlay)
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
  window.addEventListener("resize", handleResize);

  // Category filters
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
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("loginEmail")?.value || "";
      const pwd = document.getElementById("loginPassword")?.value || "";
      if (!email || !pwd)
        return showToast("Enter email and password", "warning");
      try {
        await signInWithEmailAndPassword(auth, email, pwd);
        showToast("Welcome back!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      const email = document.getElementById("loginEmail")?.value || "";
      const pwd = document.getElementById("loginPassword")?.value || "";
      if (!email || !pwd)
        return showToast("Enter email and password", "warning");
      if (pwd.length < 6)
        return showToast("Password must be 6+ characters", "warning");
      try {
        await createUserWithEmailAndPassword(auth, email, pwd);
        showToast("Account created!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
});

// Initialize
onAuthStateChanged(auth, renderAuthUI);
