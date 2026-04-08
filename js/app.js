import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, where, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
const notesGrid = document.getElementById('notesGrid');
const notesGridContainer = document.getElementById('notesGridContainer');
const loginSection = document.getElementById('loginSection');
const addNoteModal = document.getElementById('addNoteModal');
const viewNoteModal = document.getElementById('noteModal');
const modalNoteTitle = document.getElementById('modalNoteTitle');
const modalNoteCategory = document.getElementById('modalNoteCategory');
const modalNoteLabels = document.getElementById('modalNoteLabels');
const modalPinNoteBtn = document.getElementById('modalPinNoteBtn');
const modalAddChecklistBtn = document.getElementById('modalAddChecklistBtn');
const modalChecklistContainer = document.getElementById('modalChecklistContainer');
const closeAddNoteModal = document.getElementById('closeAddNoteModal');
const cancelModalNoteBtn = document.getElementById('cancelModalNoteBtn');
const saveModalNoteBtn = document.getElementById('saveModalNoteBtn');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
const modalCategory = document.getElementById('modalCategory');
const modalLabels = document.getElementById('modalLabels');
const modalChecklist = document.getElementById('modalChecklist');
const closeModal = document.getElementById('closeModal');
const modalDelete = document.getElementById('modalDelete');
const modalSave = document.getElementById('modalSave');

let currentNoteId = null;
let modalQuill = null;
let currentFilter = 'all';
let modalPinnedStatus = false;
let modalChecklistItems = [];
let unsubscribeNotes = null;

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-yellow-600' : 'bg-gray-800';
    toast.className = `toast ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg text-sm`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function initModalQuill() {
    if (!modalQuill && document.getElementById('modalEditorContainer')) {
        modalQuill = new Quill('#modalEditorContainer', {
            theme: 'snow',
            modules: { toolbar: '#modalToolbar' },
            placeholder: 'Write your note here...'
        });
        const toolbar = modalQuill.getModule('toolbar');
        toolbar.addHandler('image', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
                const file = input.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const range = modalQuill.getSelection();
                        modalQuill.insertEmbed(range.index, 'image', e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        });
    }
}

function addModalChecklistItem(text = '', completed = false) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    itemDiv.innerHTML = `
        <input type="checkbox" ${completed ? 'checked' : ''} class="checklist-checkbox">
        <input type="text" value="${escapeHtml(text)}" placeholder="Checklist item..." class="checklist-text">
        <button type="button" class="remove-checklist">✕</button>
    `;
    itemDiv.querySelector('.checklist-checkbox').addEventListener('change', () => {
        if (itemDiv.querySelector('.checklist-checkbox').checked) itemDiv.classList.add('completed');
        else itemDiv.classList.remove('completed');
        updateModalChecklistItems();
    });
    itemDiv.querySelector('.checklist-text').addEventListener('input', () => updateModalChecklistItems());
    itemDiv.querySelector('.remove-checklist').addEventListener('click', () => {
        itemDiv.remove();
        updateModalChecklistItems();
    });
    modalChecklistContainer.appendChild(itemDiv);
    if (completed) itemDiv.classList.add('completed');
    updateModalChecklistItems();
}

function updateModalChecklistItems() {
    modalChecklistItems = [];
    document.querySelectorAll('#modalChecklistContainer .checklist-item').forEach(item => {
        modalChecklistItems.push({
            text: item.querySelector('.checklist-text').value,
            completed: item.querySelector('.checklist-checkbox').checked
        });
    });
}

function showAddNoteModal() {
    modalNoteTitle.value = '';
    if (modalQuill) modalQuill.root.innerHTML = '';
    modalNoteCategory.value = 'personal';
    modalNoteLabels.value = '';
    modalChecklistContainer.innerHTML = '';
    modalChecklistItems = [];
    modalPinnedStatus = false;
    modalPinNoteBtn.classList.remove('text-gray-800');
    addNoteModal.classList.remove('hidden');
    addNoteModal.classList.add('flex');
    initModalQuill();
    lucide.createIcons();
}

function closeAddNoteModalFunc() {
    addNoteModal.classList.add('hidden');
    addNoteModal.classList.remove('flex');
}

async function saveModalNote() {
    const user = auth.currentUser;
    if (!user) return;

    const title = modalNoteTitle.value.trim();
    const content = modalQuill ? modalQuill.root.innerHTML : '';
    const category = modalNoteCategory.value;
    const labels = modalNoteLabels.value.split(',').map(l => l.trim()).filter(l => l);
    const pinned = modalPinnedStatus;

    if (!title && (!content || content === '<p><br></p>') && modalChecklistItems.length === 0) {
        showToast("Please add a title, content, or checklist item", "warning");
        return;
    }

    saveModalNoteBtn.disabled = true;
    saveModalNoteBtn.innerHTML = 'Saving...';

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
            updatedAt: serverTimestamp()
        });
        closeAddNoteModalFunc();
        showToast("Note saved!", "success");
    } catch (error) {
        showToast("Error: " + error.message, "error");
    } finally {
        saveModalNoteBtn.innerHTML = 'Save Note';
        saveModalNoteBtn.disabled = false;
    }
}

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
                    <input type="checkbox" ${item.completed ? 'checked' : ''} class="w-4 h-4" style="accent-color: #1f2937">
                    <span class="${item.completed ? 'line-through text-gray-400' : ''} text-sm">${escapeHtml(item.text)}</span>
                </div>
            `;
        });
    } else {
        modalChecklist.innerHTML = '';
    }
    
    viewNoteModal.classList.remove('hidden');
    viewNoteModal.classList.add('flex');
    lucide.createIcons();
}

async function updateNote() {
    if (!currentNoteId) return;
    try {
        await updateDoc(doc(db, "notes", currentNoteId), {
            title: modalTitle.value.trim() || "Untitled",
            content: modalContent.innerHTML,
            updatedAt: serverTimestamp()
        });
        viewNoteModal.classList.add('hidden');
        showToast("Note updated!", "success");
    } catch (error) {
        showToast("Error: " + error.message, "error");
    }
}

async function deleteNote(id) {
    if (confirm("Delete this note?")) {
        await deleteDoc(doc(db, "notes", id));
        viewNoteModal.classList.add('hidden');
        showToast("Note deleted!", "success");
    }
}

function closeNoteModal() {
    viewNoteModal.classList.add('hidden');
    viewNoteModal.classList.remove('flex');
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
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function subscribeToNotes(userId) {
    if (unsubscribeNotes) unsubscribeNotes();
    const q = query(collection(db, "notes"), where("userId", "==", userId), orderBy("updatedAt", "desc"));
    
    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        if (!notesGridContainer) return;
        
        let notes = [];
        snapshot.forEach(doc => notes.push({ id: doc.id, ...doc.data() }));
        notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        
        if (currentFilter !== 'all') notes = notes.filter(n => n.category === currentFilter);
        
        if (notes.length === 0) {
            notesGridContainer.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">No notes yet. Click "Add Note" to create one!</div>`;
            return;
        }
        
        notesGridContainer.innerHTML = '';
        notes.forEach((note) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content || '';
            const plainText = tempDiv.textContent || tempDiv.innerText || '';
            const contentPreview = plainText.substring(0, 100) || (note.checklist?.length ? `${note.checklist.length} checklist item(s)` : 'No content');
            
            const card = document.createElement('div');
            card.className = 'note-card bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-all';
            if (note.pinned) card.classList.add('border-l-4', 'border-l-gray-800');
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-semibold text-gray-900 flex-1 text-lg truncate pr-2">${escapeHtml(note.title) || 'Untitled'}</h3>
                    <button class="delete-note-btn text-gray-400 hover:text-red-500 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <p class="text-sm text-gray-600 line-clamp-3 mb-4">${escapeHtml(contentPreview)}</p>
                <div class="flex items-center justify-between">
                    <span class="category-badge category-${note.category}">${note.category}</span>
                    <span class="text-xs text-gray-400">${formatDate(note.updatedAt)}</span>
                </div>
            `;
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-note-btn')) openNoteModal(note);
            });
            card.querySelector('.delete-note-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            });
            notesGridContainer.appendChild(card);
        });
        lucide.createIcons();
    });
}

function renderAuthUI(user) {
    const sidebar = document.getElementById('sidebar');
    if (user) {
        if (window.innerWidth >= 768) sidebar.style.transform = 'translateX(0)';
        authContainer.innerHTML = `
            <div class="text-center mb-3">
                <div class="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i data-lucide="user" class="w-5 h-5 text-white"></i>
                </div>
                <p class="text-sm font-medium text-gray-700 truncate">${escapeHtml(user.email)}</p>
            </div>
            <button id="logoutBtn" class="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-white px-4 py-2 rounded-full hover:bg-red-500 transition-all border border-gray-200">
                <i data-lucide="log-out" class="w-4 h-4"></i>
                Sign out
            </button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth));
        notesGrid.classList.remove('hidden');
        loginSection.classList.add('hidden');
        subscribeToNotes(user.uid);
    } else {
        sidebar.style.transform = '';
        authContainer.innerHTML = '';
        notesGrid.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (unsubscribeNotes) unsubscribeNotes();
    }
    lucide.createIcons();
}

// Event Listeners
document.getElementById('sidebarAddNoteBtn')?.addEventListener('click', showAddNoteModal);
document.getElementById('mobileAddNoteBtn')?.addEventListener('click', showAddNoteModal);
document.getElementById('desktopAddNoteBtn')?.addEventListener('click', showAddNoteModal);
closeAddNoteModal?.addEventListener('click', closeAddNoteModalFunc);
cancelModalNoteBtn?.addEventListener('click', closeAddNoteModalFunc);
saveModalNoteBtn?.addEventListener('click', saveModalNote);
closeModal?.addEventListener('click', closeNoteModal);
modalDelete?.addEventListener('click', () => deleteNote(currentNoteId));
modalSave?.addEventListener('click', updateNote);
modalPinNoteBtn?.addEventListener('click', () => {
    modalPinnedStatus = !modalPinnedStatus;
    modalPinNoteBtn.classList.toggle('text-gray-800', modalPinnedStatus);
    modalPinNoteBtn.classList.toggle('text-gray-400', !modalPinnedStatus);
});
modalAddChecklistBtn?.addEventListener('click', () => addModalChecklistItem('', false));

// Sidebar mobile
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openMobileSidebar() {
    sidebar.classList.add('mobile-open');
    sidebar.style.transform = 'translateX(0)';
    sidebarOverlay.classList.remove('hidden');
}
function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebar.style.transform = '';
    sidebarOverlay.classList.add('hidden');
}
mobileMenuToggle?.addEventListener('click', openMobileSidebar);
mobileMenuBtn?.addEventListener('click', openMobileSidebar);
closeSidebarBtn?.addEventListener('click', closeMobileSidebar);
sidebarOverlay?.addEventListener('click', closeMobileSidebar);

// Category filters
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
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPassword').value;
    if (!email || !pwd) return showToast("Enter email and password", "warning");
    try {
        await signInWithEmailAndPassword(auth, email, pwd);
        showToast("Welcome back!", "success");
    } catch (err) { showToast(err.message, "error"); }
});

document.getElementById('signupBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPassword').value;
    if (!email || !pwd) return showToast("Enter email and password", "warning");
    if (pwd.length < 6) return showToast("Password must be 6+ characters", "warning");
    try {
        await createUserWithEmailAndPassword(auth, email, pwd);
        showToast("Account created!", "success");
    } catch (err) { showToast(err.message, "error"); }
});

onAuthStateChanged(auth, renderAuthUI);