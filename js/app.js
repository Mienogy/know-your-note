import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, where, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBLjPiH-E2cB3ZA-xbZe_SlWm9YHsn5CFE",
    authDomain: "know-your-note.firebaseapp.com",
    projectId: "know-your-note",
    storageBucket: "know-your-note.firebasestorage.app",
    messagingSenderId: "660965229112",
    appId: "1:660965229112:web:00213037b4c8ddc6d91ccd",
    measurementId: "G-05X5ZW30MM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authContainer = document.getElementById('authContainer');
const newNoteSection = document.getElementById('newNoteSection');
const notesGrid = document.getElementById('notesGrid');
const loginSection = document.getElementById('loginSection');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteCategory = document.getElementById('noteCategory');
const noteLabels = document.getElementById('noteLabels');
const addNoteBtn = document.getElementById('addNoteBtn');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
const pinNoteBtn = document.getElementById('pinNoteBtn');
const addChecklistBtn = document.getElementById('addChecklistBtn');
const checklistContainer = document.getElementById('checklistContainer');
const modal = document.getElementById('noteModal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalCategory = document.getElementById('modalCategory');
const modalLabels = document.getElementById('modalLabels');
const modalChecklist = document.getElementById('modalChecklist');
const closeModal = document.getElementById('closeModal');
const modalDelete = document.getElementById('modalDelete');
const modalSave = document.getElementById('modalSave');
const sidebarAddNoteBtn = document.getElementById('sidebarAddNoteBtn');
const mobileAddNoteBtn = document.getElementById('mobileAddNoteBtn');
const menuBtn = document.getElementById('menuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

let currentNoteId = null;
let quill = null;
let currentFilter = 'all';
let currentPinnedStatus = false;
let checklistItems = [];
let currentNotes = []; // Store current notes array for modal access

// Toast Notification Functions
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type} p-4 rounded-lg shadow-lg max-w-sm`;
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="flex-shrink-0">
                ${getToastIcon(type)}
            </div>
            <p class="text-sm font-medium">${message}</p>
        </div>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons();

    // Remove toast after animation
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3300);
}

function getToastIcon(type) {
    const icons = {
        success: '<i data-lucide="check-circle" class="w-5 h-5 text-white"></i>',
        error: '<i data-lucide="alert-circle" class="w-5 h-5 text-white"></i>',
        warning: '<i data-lucide="alert-triangle" class="w-5 h-5 text-white"></i>',
        info: '<i data-lucide="info" class="w-5 h-5 text-white"></i>'
    };
    return icons[type] || icons.info;
}

// Initialize Quill
function initQuill() {
    if (!quill) {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: '#toolbar-container'
            },
            placeholder: 'Write your note here...'
        });
        
        // Fix image upload
        const imageHandler = () => {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.click();
            input.onchange = async () => {
                const file = input.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const range = quill.getSelection();
                        quill.insertEmbed(range.index, 'image', e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
        };
        const toolbar = quill.getModule('toolbar');
        toolbar.addHandler('image', imageHandler);
    }
}

// Checklist Functions
function addChecklistItem(text = '', completed = false) {
    const itemId = Date.now() + Math.random();
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    itemDiv.dataset.id = itemId;
    itemDiv.innerHTML = `
        <input type="checkbox" ${completed ? 'checked' : ''} class="checklist-checkbox">
        <input type="text" value="${escapeHtml(text)}" placeholder="Checklist item..." class="checklist-text">
        <button class="remove-checklist text-gray-400 hover:text-red-500">
            <i data-lucide="x" class="w-3 h-3"></i>
        </button>
    `;
    
    const checkbox = itemDiv.querySelector('.checklist-checkbox');
    const textInput = itemDiv.querySelector('.checklist-text');
    const removeBtn = itemDiv.querySelector('.remove-checklist');
    
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) itemDiv.classList.add('completed');
        else itemDiv.classList.remove('completed');
        updateChecklistItems();
    });
    
    textInput.addEventListener('input', () => updateChecklistItems());
    removeBtn.addEventListener('click', () => {
        itemDiv.remove();
        updateChecklistItems();
    });
    
    checklistContainer.appendChild(itemDiv);
    if (checkbox.checked) itemDiv.classList.add('completed');
    updateChecklistItems();
    lucide.createIcons();
}

function updateChecklistItems() {
    checklistItems = [];
    document.querySelectorAll('.checklist-item').forEach(item => {
        checklistItems.push({
            text: item.querySelector('.checklist-text').value,
            completed: item.querySelector('.checklist-checkbox').checked
        });
    });
}

function renderChecklist(items) {
    checklistContainer.innerHTML = '';
    items.forEach(item => addChecklistItem(item.text, item.completed));
}

// Show/Hide New Note Form
function showNewNoteForm() {
    newNoteSection.classList.remove('hidden');
    newNoteSection.scrollIntoView({ behavior: 'smooth' });
    if (quill) setTimeout(() => quill.focus(), 100);
}

function hideNewNoteForm() {
    newNoteSection.classList.add('hidden');
    noteTitleInput.value = '';
    if (quill) quill.root.innerHTML = '';
    checklistContainer.innerHTML = '';
    checklistItems = [];
    currentPinnedStatus = false;
    pinNoteBtn.classList.remove('text-gray-600');
}

// Add Note
async function addNewNote() {
    const user = auth.currentUser;
    if (!user) return;

    const title = noteTitleInput.value.trim();
    const content = quill ? quill.root.innerHTML : '';
    const category = noteCategory.value;
    const labels = noteLabels.value.split(',').map(l => l.trim()).filter(l => l);
    const pinned = currentPinnedStatus;

    if (!title && (!content || content === '<p><br></p>') && checklistItems.length === 0) {
        showToast("Please add a title, content, or checklist item", "warning");
        return;
    }

    const saveBtn = document.getElementById('addNoteBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    saveBtn.disabled = true;
    lucide.createIcons();

    try {
        await addDoc(collection(db, "notes"), {
            userId: user.uid,
            title: title || "Untitled",
            content: content,
            category: category,
            labels: labels,
            pinned: pinned,
            checklist: checklistItems,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        hideNewNoteForm();
        showToast("Note saved successfully!", "success");
    } catch (error) {
        showToast("Error saving note: " + error.message, "error");
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Pin Note Toggle
pinNoteBtn.addEventListener('click', () => {
    currentPinnedStatus = !currentPinnedStatus;
    if (currentPinnedStatus) {
        pinNoteBtn.classList.add('text-gray-800');
        pinNoteBtn.classList.remove('text-gray-400');
    } else {
        pinNoteBtn.classList.add('text-gray-400');
        pinNoteBtn.classList.remove('text-gray-800');
    }
});

addChecklistBtn.addEventListener('click', () => addChecklistItem('', false));
sidebarAddNoteBtn?.addEventListener('click', () => {
    showNewNoteForm();
    closeSidebarOnMobile();
});
mobileAddNoteBtn?.addEventListener('click', showNewNoteForm);
cancelNoteBtn?.addEventListener('click', hideNewNoteForm);

// Sidebar toggle functions
function openSidebar() {
    sidebar.classList.remove('hidden');
    setTimeout(() => sidebar.classList.remove('-translate-x-full'), 10);
}

function closeSidebarOnMobile() {
    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
    }
}

menuBtn?.addEventListener('click', openSidebar);
closeSidebarBtn?.addEventListener('click', closeSidebarOnMobile);

// Open Modal by Index (to avoid JSON serialization issues)
function openNoteModalByIndex(index) {
    if (index >= 0 && index < currentNotes.length) {
        openNoteModal(currentNotes[index]);
    }
}

// Open Modal
function openNoteModal(note) {
    currentNoteId = note.id;
    modalTitle.value = note.title || '';
    modalContent.innerHTML = note.content || '';
    modalCategory.textContent = note.category;
    modalCategory.className = `category-badge category-${note.category}`;
    modalLabels.textContent = note.labels?.join(', ') || 'No labels';
    
    if (note.checklist?.length) {
        modalChecklist.innerHTML = '<p class="font-medium text-sm mb-2">Checklist:</p>';
        note.checklist.forEach(item => {
            modalChecklist.innerHTML += `
                <div class="flex items-center gap-2 py-1">
                    <input type="checkbox" ${item.completed ? 'checked' : ''} class="w-4 h-4" style="accent-color: #374151">
                    <span class="${item.completed ? 'line-through text-gray-400' : ''} text-sm">${escapeHtml(item.text)}</span>
                </div>
            `;
        });
    } else {
        modalChecklist.innerHTML = '';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}

// Update Note
async function updateNote() {
    if (!currentNoteId) return;

    const saveBtn = document.getElementById('modalSave');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    saveBtn.disabled = true;
    lucide.createIcons();

    try {
        await updateDoc(doc(db, "notes", currentNoteId), {
            title: modalTitle.value.trim() || "Untitled",
            content: modalContent.innerHTML,
            updatedAt: serverTimestamp()
        });
        closeNoteModal();
        showToast("Note updated successfully!", "success");
    } catch (error) {
        showToast("Error updating note: " + error.message, "error");
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteNote(id) {
    // Create custom confirmation dialog
    const confirmed = await showConfirmDialog("Delete this note?", "This action cannot be undone.");
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "notes", id));
            closeNoteModal();
            showToast("Note deleted successfully!", "success");
        } catch (error) {
            showToast("Error deleting note: " + error.message, "error");
        }
    }
}

function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                <div class="text-center">
                    <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">${title}</h3>
                    <p class="text-sm text-gray-600 mb-6">${message}</p>
                    <div class="flex gap-3">
                        <button class="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-colors cancel-btn">
                            Cancel
                        </button>
                        <button class="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-medium hover:bg-red-600 transition-colors confirm-btn">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        lucide.createIcons();

        overlay.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        overlay.querySelector('.confirm-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });
    });
}

function closeNoteModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentNoteId = null;
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Subscribe to Notes
let unsubscribeNotes = null;

function subscribeToNotes(userId) {
    if (unsubscribeNotes) unsubscribeNotes();
    const q = query(collection(db, "notes"), where("userId", "==", userId), orderBy("updatedAt", "desc"));
    
    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        const gridContainer = notesGrid.querySelector('.grid');
        if (!gridContainer) return;
        
        let notes = [];
        snapshot.forEach(doc => notes.push({ id: doc.id, ...doc.data() }));
        notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        currentNotes = notes; // Store for modal access
        
        if (currentFilter !== 'all') notes = notes.filter(n => n.category === currentFilter);
        
        if (notes.length === 0) {
            const emptyMessage = currentFilter === 'all'
                ? "No notes yet. Create your first note to get started!"
                : `No ${currentFilter} notes found. Try a different category or create a new note.`;
            gridContainer.innerHTML = `
                <div class="col-span-full empty-state">
                    <div class="max-w-md mx-auto">
                        <i data-lucide="file-text" class="w-16 h-16 mx-auto block mb-4"></i>
                        <h3 class="text-lg font-semibold text-gray-700 mb-2">No notes found</h3>
                        <p class="text-gray-500 mb-6">${emptyMessage}</p>
                        <button onclick="document.getElementById('sidebarAddNoteBtn')?.click()" class="inline-flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium">
                            <i data-lucide="plus" class="w-5 h-5"></i>
                            Create your first note
                        </button>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        let html = '';
        notes.forEach((note, index) => {
            const plainContent = note.content ? note.content.replace(/<[^>]*>/g, '').substring(0, 120) : '';
            const hasChecklist = note.checklist?.length > 0;
            const contentPreview = plainContent || (hasChecklist ? `${note.checklist.length} checklist item${note.checklist.length !== 1 ? 's' : ''}` : 'No content');

            html += `
                <div class="note-card ${note.pinned ? 'pinned' : ''} p-5 group" data-note-index="${index}" onclick="window.openNoteModalByIndex(${index})">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-semibold text-gray-900 flex-1 text-lg leading-tight pr-2">${escapeHtml(note.title) || 'Untitled'}</h3>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            ${note.pinned ? '<div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center"><i data-lucide="pin" class="w-3 h-3 text-gray-600"></i></div>' : ''}
                            <button class="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors" onclick="event.stopPropagation(); window.deleteNote('${note.id}')">
                                <i data-lucide="trash-2" class="w-3 h-3 text-red-600"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">${escapeHtml(contentPreview)}</p>
                    <div class="flex items-center justify-between">
                        <span class="category-badge category-${note.category}">${note.category}</span>
                        <div class="text-xs text-gray-400 font-medium">${formatDate(note.updatedAt)}</div>
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
        authContainer.innerHTML = `
            <div class="space-y-4">
                <div class="text-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i data-lucide="user" class="w-5 h-5 text-white"></i>
                    </div>
                    <p class="text-sm font-medium text-gray-700 truncate">${escapeHtml(user.email)}</p>
                </div>
                <button id="logoutBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-white px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 transition-all border border-gray-200 hover:border-red-300 font-medium">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                    Sign out
                </button>
            </div>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            try {
                await signOut(auth);
                showToast("Signed out successfully", "info");
            } catch (error) {
                showToast("Error signing out: " + error.message, "error");
            }
        });
        
        newNoteSection.classList.add('hidden');
        notesGrid.classList.remove('hidden');
        loginSection.classList.add('hidden');
        notesGrid.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"></div>';
        initQuill();
        subscribeToNotes(user.uid);
        lucide.createIcons();
    } else {
        authContainer.innerHTML = `
            <button id="showLoginBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <i data-lucide="log-in" class="w-4 h-4"></i>
                Sign in
            </button>
        `;
        newNoteSection.classList.add('hidden');
        notesGrid.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (unsubscribeNotes) unsubscribeNotes();
        document.getElementById('showLoginBtn')?.addEventListener('click', () => loginSection.scrollIntoView({ behavior: 'smooth' }));
        lucide.createIcons();
    }
}

// Event Listeners
addNoteBtn.addEventListener('click', addNewNote);
closeModal.addEventListener('click', closeNoteModal);
modalDelete.addEventListener('click', () => deleteNote(currentNoteId));
modalSave.addEventListener('click', updateNote);

// Category Filters
document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.category;
        if (auth.currentUser) subscribeToNotes(auth.currentUser.uid);
    });
});

// Login/Signup
document.getElementById('loginBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPassword').value;

    if (!email || !pwd) {
        showToast("Please enter both email and password", "warning");
        return;
    }

    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Signing in...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        await signInWithEmailAndPassword(auth, email, pwd);
        showToast("Welcome back!", "success");
    } catch (err) {
        showToast("Login failed: " + err.message, "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

document.getElementById('signupBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('signupBtn');
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPassword').value;

    if (!email || !pwd) {
        showToast("Please enter both email and password", "warning");
        return;
    }

    if (pwd.length < 6) {
        showToast("Password must be at least 6 characters", "warning");
        return;
    }

    // Show loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Creating account...';
    btn.disabled = true;
    lucide.createIcons();

    try {
        await createUserWithEmailAndPassword(auth, email, pwd);
        showToast("Account created successfully! Welcome!", "success");
    } catch (err) {
        showToast("Signup failed: " + err.message, "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

onAuthStateChanged(auth, renderAuthUI);

// Make global
window.openNoteModal = openNoteModal;
window.openNoteModalByIndex = openNoteModalByIndex;
window.deleteNote = deleteNote;