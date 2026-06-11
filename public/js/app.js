// Citizen Client-side Logic (app.js)

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let currentUser = null;
  let userToken = localStorage.getItem('token') || null;
  let currentDeleteComplaintId = null;

  // --- API CALL HELPER ---
  async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }
    
    // Auto set Content-Type to JSON if body is object and not FormData
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong.');
    }
    return data;
  }

  // --- ROUTING / VIEW CONTROLLER ---
  const views = [
    'home', 'about', 'services', 'track-public', 'contact', 'faq', 'login',
    'citizen-dashboard', 'citizen-my-complaints', 'citizen-submit-complaint',
    'citizen-profile', 'citizen-complaint-details', 'citizen-edit-complaint'
  ];

  function navigateTo(viewName) {
    views.forEach(v => {
      const el = document.getElementById(`${v}-view`);
      if (el) el.classList.remove('active-view');
    });

    const activeEl = document.getElementById(`${viewName}-view`);
    if (activeEl) {
      activeEl.classList.add('active-view');
      window.scrollTo(0, 0);
    }

    // Update public nav active states
    document.querySelectorAll('.public-nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update sidebar active states
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Refresh view specific data
    if (viewName === 'citizen-dashboard') {
      loadCitizenDashboard();
    } else if (viewName === 'citizen-my-complaints') {
      loadCitizenComplaintsTable();
    } else if (viewName === 'citizen-profile') {
      loadCitizenProfileForm();
    } else if (viewName === 'citizen-submit-complaint') {
      loadDepartmentsSelect();
    }

    // Toggle Mobile Sidebar close if open
    document.getElementById('app-sidebar').classList.remove('sidebar-open');
  }

  // Bind click handlers to anything with data-view
  document.body.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      e.preventDefault();
      const viewName = viewBtn.getAttribute('data-view');
      navigateTo(viewName);
    }
  });

  // Mobile sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('app-sidebar').classList.toggle('sidebar-open');
  });

  // --- DARK MODE TOGGLE ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  
  function setDarkMode(enabled) {
    if (enabled) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('darkMode', 'enabled');
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-dark"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      `;
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('darkMode', 'disabled');
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon-light"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      `;
    }
  }

  // Load Saved Theme
  const savedTheme = localStorage.getItem('darkMode');
  setDarkMode(savedTheme === 'enabled');

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    setDarkMode(!isDark);
  });

  // --- HERO ANNOUNCEMENTS CAROUSEL ---
  let currentSlide = 0;
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');

  function showSlide(index) {
    if (slides.length === 0) return;
    slides.forEach(s => s.classList.remove('active-slide'));
    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active-slide');
    dots[index].classList.add('active');
    currentSlide = index;
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      showSlide(index);
    });
  });

  // Auto scroll carousel
  setInterval(() => {
    if (slides.length > 0) {
      let nextSlide = (currentSlide + 1) % slides.length;
      showSlide(nextSlide);
    }
  }, 6000);

  // --- FAQ ACCORDION ---
  document.querySelectorAll('.faq-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      item.classList.toggle('active-faq');
    });
  });

  // --- FLOATING TOASTS HELPER ---
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button style="background:none; border:none; color:inherit; font-weight:bold; cursor:pointer;" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  // --- FILE UPLOAD PREVIEWS ---
  const fileInput = document.getElementById('grievance-file-input');
  const previewDiv = document.getElementById('file-upload-preview-div');
  const fileNameLbl = document.getElementById('file-name-lbl');
  const fileTextLbl = document.getElementById('file-upload-text-lbl');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileNameLbl.textContent = file.name;
        previewDiv.style.display = 'block';
        fileTextLbl.style.display = 'none';
      } else {
        previewDiv.style.display = 'none';
        fileTextLbl.style.display = 'block';
      }
    });
  }

  const editFileInput = document.getElementById('edit-file-input');
  const editPreviewDiv = document.getElementById('edit-file-upload-preview-div');
  const editFileNameLbl = document.getElementById('edit-file-name-lbl');
  const editFileTextLbl = document.getElementById('edit-file-upload-text-lbl');

  if (editFileInput) {
    editFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        editFileNameLbl.textContent = file.name;
        editPreviewDiv.style.display = 'block';
        editFileTextLbl.style.display = 'none';
      } else {
        editPreviewDiv.style.display = 'none';
        editFileTextLbl.style.display = 'block';
      }
    });
  }

  // --- AUTH PANEL SWITCHERS ---
  document.getElementById('go-to-register-btn').addEventListener('click', () => {
    document.getElementById('login-card-panel').style.display = 'none';
    document.getElementById('register-card-panel').style.display = 'block';
  });

  document.getElementById('go-to-login-btn').addEventListener('click', () => {
    document.getElementById('register-card-panel').style.display = 'none';
    document.getElementById('login-card-panel').style.display = 'block';
  });

  document.getElementById('forgot-password-trigger').addEventListener('click', () => {
    document.getElementById('login-card-panel').style.display = 'none';
    document.getElementById('forgot-card-panel').style.display = 'block';
  });

  document.getElementById('forgot-back-to-login-btn').addEventListener('click', () => {
    document.getElementById('forgot-card-panel').style.display = 'none';
    document.getElementById('login-card-panel').style.display = 'block';
  });

  // --- AUTH FORM SUMBISSIONS ---
  
  // Registration
  const registerForm = document.getElementById('citizen-register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const mobile = document.getElementById('reg-mobile').value;
    const address = document.getElementById('reg-address').value;
    const aadhaar = document.getElementById('reg-aadhaar').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirmpass').value;
    const errorEl = document.getElementById('register-form-error');

    errorEl.style.display = 'none';

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { name, email, mobile, address, aadhaar, password, confirmPassword }
      });

      showToast(response.message, 'success');
      registerForm.reset();
      // Swich to login card
      document.getElementById('register-card-panel').style.display = 'none';
      document.getElementById('login-card-panel').style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  // Login
  const loginForm = document.getElementById('citizen-login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-form-error');

    errorEl.style.display = 'none';

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      });

      userToken = response.token;
      currentUser = response.user;
      localStorage.setItem('token', userToken);

      showToast('Logged in successfully.', 'success');
      loginForm.reset();
      
      updateAuthUIState(true);
      navigateTo('citizen-dashboard');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  // Forgot password
  document.getElementById('citizen-forgot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Reset instructions have been sent to your email (simulation).', 'info');
    document.getElementById('citizen-forgot-form').reset();
    document.getElementById('forgot-card-panel').style.display = 'none';
    document.getElementById('login-card-panel').style.display = 'block';
  });

  // --- LOGOUT CONTROL ---
  function logoutUser() {
    currentUser = null;
    userToken = null;
    localStorage.removeItem('token');
    showToast('You have logged out successfully.', 'info');
    updateAuthUIState(false);
    navigateTo('home');
  }

  document.getElementById('sidebar-logout-btn').addEventListener('click', logoutUser);

  // --- UI AUTH STATE TOGGLER ---
  function updateAuthUIState(isAuthenticated) {
    const appShell = document.getElementById('app-shell');
    const authBtnSection = document.getElementById('header-auth-section');
    const bellContainer = document.getElementById('notification-bell-container');

    if (isAuthenticated) {
      appShell.classList.add('has-sidebar');
      bellContainer.style.display = 'block';
      
      // Update Navbar Auth to show Dashboard shortcut & Logout
      authBtnSection.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-secondary btn-sm" data-view="citizen-dashboard">Dashboard</button>
          <button class="btn btn-danger btn-sm" id="nav-logout-btn">Logout</button>
        </div>
      `;
      document.getElementById('nav-logout-btn').addEventListener('click', logoutUser);
      
      // Load notifications poll
      loadNotifications();
    } else {
      appShell.classList.remove('has-sidebar');
      bellContainer.style.display = 'none';
      
      // Restore standard Citizen Login button
      authBtnSection.innerHTML = `
        <button class="btn btn-primary btn-sm" data-view="login">Citizen Login</button>
        <a href="admin.html" class="btn btn-primary btn-sm">Admin Login</a>
      `;
    }
  }

  // --- INITIAL CHECK ON LOAD ---
  async function checkAuthSession() {
    if (!userToken) {
      updateAuthUIState(false);
      return;
    }
    try {
      const response = await apiFetch('/api/auth/profile');
      if (response.success && response.profile.role === 'citizen') {
        currentUser = response.profile;
        updateAuthUIState(true);
        // Default redirect on active session check to dashboard
        navigateTo('citizen-dashboard');
      } else {
        // Not a citizen
        logoutUser();
      }
    } catch (err) {
      console.warn('Session check failed:', err.message);
      logoutUser();
    }
  }

  checkAuthSession();

  // --- DEPARTMENTS LOADER ---
  let departmentsCache = [];
  async function loadDepartmentsSelect() {
    try {
      if (departmentsCache.length > 0) {
        populateDeptSelects();
        return;
      }
      const response = await apiFetch('/api/departments');
      departmentsCache = response.departments;
      populateDeptSelects();
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  }

  function populateDeptSelects() {
    const selects = ['grievance-department-select'];
    selects.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Select Department</option>';
      departmentsCache.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.department_name;
        opt.textContent = dept.department_name;
        select.appendChild(opt);
      });
    });
  }

  // --- CITIZEN DASHBOARD metrics ---
  async function loadCitizenDashboard() {
    if (!currentUser) return;
    
    // Set Citizen display name
    document.getElementById('citizen-name-badge').textContent = currentUser.name;

    try {
      const response = await apiFetch('/api/complaints/my');
      const complaints = response.complaints;
      
      // Calculate metrics
      const stats = { total: complaints.length, Submitted: 0, 'In Progress': 0, Resolved: 0 };
      complaints.forEach(c => {
        if (c.status === 'Submitted' || c.status === 'Under Review' || c.status === 'Assigned') {
          stats.Submitted++;
        } else if (c.status === 'In Progress') {
          stats['In Progress']++;
        } else if (c.status === 'Resolved') {
          stats.Resolved++;
        }
      });

      // Render Dashboard metrics
      document.getElementById('c-stat-total').textContent = stats.total;
      document.getElementById('c-stat-submitted').textContent = stats.Submitted;
      document.getElementById('c-stat-progress').textContent = stats['In Progress'];
      document.getElementById('c-stat-resolved').textContent = stats.Resolved;

      // Populate dashboard small complaints table
      const tbody = document.getElementById('citizen-recent-complaints-tbody');
      tbody.innerHTML = '';
      
      const recent = complaints.slice(0, 5);
      if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No complaints lodged yet.</td></tr>';
      } else {
        recent.forEach(c => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:600;">${c.complaint_id}</td>
            <td>${c.title}</td>
            <td>${c.category}</td>
            <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
            <td><button class="btn btn-secondary btn-sm view-complaint-btn" data-id="${c.complaint_id}">View</button></td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Load activity timeline logic
      const activityFeed = document.getElementById('citizen-activity-feed');
      activityFeed.innerHTML = '';
      const recentUpdates = complaints.filter(c => c.remarks).slice(0, 4);
      
      if (recentUpdates.length === 0) {
        activityFeed.innerHTML = '<div class="p-3 bg-light rounded text-center text-muted">No recent activity logs.</div>';
      } else {
        recentUpdates.forEach(c => {
          const item = document.createElement('div');
          item.className = 'p-2 border-bottom';
          item.style.fontSize = '12.5px';
          item.innerHTML = `
            <div class="d-flex justify-content-between">
              <strong class="text-primary">${c.complaint_id}</strong>
              <span class="text-muted small">${new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <p class="mb-0 text-muted mt-1">Status: <strong class="text-dark">${c.status}</strong>. Remark: "${c.remarks}"</p>
          `;
          activityFeed.appendChild(item);
        });
      }

    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  }

  // Helper status class
  function getStatusBadgeClass(status) {
    switch(status) {
      case 'Submitted': return 'badge-submitted';
      case 'Under Review': return 'badge-review';
      case 'Assigned': return 'badge-assigned';
      case 'In Progress': return 'badge-progress';
      case 'Resolved': return 'badge-resolved';
      case 'Rejected': return 'badge-rejected';
      default: return 'badge-submitted';
    }
  }

  // --- CITIZEN MY COMPLAINTS TABLE ---
  async function loadCitizenComplaintsTable() {
    try {
      const response = await apiFetch('/api/complaints/my');
      const complaints = response.complaints;
      const tbody = document.getElementById('citizen-all-complaints-tbody');
      
      tbody.innerHTML = '';
      if (complaints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No complaints lodged yet.</td></tr>';
        return;
      }

      complaints.forEach(c => {
        const canEditDelete = c.status !== 'Resolved' && c.status !== 'Rejected';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;">${c.complaint_id}</td>
          <td>${c.title}</td>
          <td>${c.category}</td>
          <td><span class="badge ${getPriorityBadgeClass(c.priority)}">${c.priority}</span></td>
          <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-secondary btn-sm view-complaint-btn" data-id="${c.complaint_id}">View</button>
              ${canEditDelete ? `
                <button class="btn btn-success btn-sm edit-complaint-btn" data-id="${c.id}">Edit</button>
                <button class="btn btn-danger btn-sm delete-complaint-btn" data-id="${c.id}">Delete</button>
              ` : ''}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error('Error loading my complaints:', err);
      showToast('Error loading complaints queue.', 'error');
    }
  }

  function getPriorityBadgeClass(prio) {
    if (prio === 'High') return 'badge-priority-high';
    if (prio === 'Medium') return 'badge-priority-medium';
    return 'badge-priority-low';
  }

  // --- LODGING A NEW GRIEVANCE ---
  const submitComplaintForm = document.getElementById('submit-complaint-form');
  submitComplaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('grievance-title-input').value;
    const category = document.getElementById('grievance-category-select').value;
    const department = document.getElementById('grievance-department-select').value;
    const location = document.getElementById('grievance-location-input').value;
    const priority = document.getElementById('grievance-priority-select').value;
    const description = document.getElementById('grievance-desc-input').value;
    const file = document.getElementById('grievance-file-input').files[0];
    const errorEl = document.getElementById('submit-complaint-error');

    errorEl.style.display = 'none';

    if (description.trim().length < 20) {
      document.getElementById('grievance-desc-error').style.display = 'block';
      return;
    } else {
      document.getElementById('grievance-desc-error').style.display = 'none';
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('department', department);
    formData.append('location', location);
    formData.append('priority', priority);
    formData.append('description', description);
    if (file) {
      formData.append('document', file);
    }

    try {
      const response = await apiFetch('/api/complaints', {
        method: 'POST',
        body: formData
      });

      showToast(`Grievance submitted successfully. Tracking ID: ${response.complaintId}`, 'success');
      submitComplaintForm.reset();
      
      // Reset file upload display elements
      document.getElementById('file-upload-preview-div').style.display = 'none';
      document.getElementById('file-upload-text-lbl').style.display = 'block';

      navigateTo('citizen-my-complaints');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-cancel-submit-complaint').addEventListener('click', () => {
    submitComplaintForm.reset();
    navigateTo('citizen-my-complaints');
  });

  // --- DYNAMIC ACTIONS CLICKS IN TABLES (View, Edit, Delete) ---
  
  // Table row View click routing
  document.body.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-complaint-btn');
    if (viewBtn) {
      const compId = viewBtn.getAttribute('data-id');
      await showComplaintDetails(compId);
    }
  });

  // Table row Edit click routing
  document.body.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-complaint-btn');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      await loadGrievanceToEditForm(id);
    }
  });

  // Table row Delete click trigger
  document.body.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-complaint-btn');
    if (deleteBtn) {
      currentDeleteComplaintId = deleteBtn.getAttribute('data-id');
      const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
      deleteModal.show();
    }
  });

  // Confirm delete call
  document.getElementById('btn-confirm-delete-complaint').addEventListener('click', async () => {
    if (!currentDeleteComplaintId) return;
    try {
      const response = await apiFetch(`/api/complaints/${currentDeleteComplaintId}`, {
        method: 'DELETE'
      });
      showToast(response.message, 'success');
      
      // Hide modal
      const modalEl = document.getElementById('deleteConfirmModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      modalInstance.hide();
      
      loadCitizenComplaintsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Cancel redirect buttons
  document.getElementById('btn-lodge-dash-redirect').addEventListener('click', () => navigateTo('citizen-submit-complaint'));
  document.getElementById('btn-lodge-complaints-redirect').addEventListener('click', () => navigateTo('citizen-submit-complaint'));

  // --- GRIEVANCE DETAILS RENDERING ---
  async function showComplaintDetails(compId) {
    try {
      const response = await apiFetch(`/api/complaints/track/${compId}`);
      const c = response.complaint;
      const timeline = response.timeline;

      // Render Text fields
      document.getElementById('details-complaint-id').textContent = c.complaint_id;
      
      const badge = document.getElementById('details-status-badge');
      badge.textContent = c.status;
      badge.className = `badge ${getStatusBadgeClass(c.status)}`;

      document.getElementById('details-title').textContent = c.title;
      document.getElementById('details-category').textContent = c.category;
      document.getElementById('details-department').textContent = c.department;
      
      const prioBadge = document.getElementById('details-priority');
      prioBadge.textContent = c.priority;
      prioBadge.className = `badge ${getPriorityBadgeClass(c.priority)}`;

      document.getElementById('details-submission-date').textContent = new Date(c.created_at).toLocaleDateString();
      document.getElementById('details-resolution-date').textContent = c.status === 'Resolved' || c.status === 'Rejected' 
        ? new Date(c.updated_at).toLocaleDateString() : 'Pending Action';
      
      document.getElementById('details-location').textContent = c.location;
      document.getElementById('details-desc').textContent = c.description;

      // Handle file attachment preview link
      const attachmentRow = document.getElementById('details-attachment-row');
      const viewDocBtn = document.getElementById('details-view-doc-btn');
      if (c.document_path) {
        viewDocBtn.href = c.document_path;
        attachmentRow.style.display = 'block';
      } else {
        attachmentRow.style.display = 'none';
      }

      // Officer Remarks
      const remarksContainer = document.getElementById('details-remarks-container');
      const remarksText = document.getElementById('details-remarks');
      if (c.remarks) {
        remarksText.textContent = c.remarks;
        remarksContainer.style.display = 'block';
      } else {
        remarksContainer.style.display = 'none';
      }

      // Render History Timeline
      const timelineBox = document.getElementById('details-timeline');
      timelineBox.innerHTML = '';

      timeline.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item active-step';
        item.innerHTML = `
          <div class="timeline-title">${log.new_status}</div>
          <div class="timeline-date">${new Date(log.updated_at).toLocaleString()} | Updated by: ${log.updated_by}</div>
          <div class="timeline-remarks">${log.remarks || 'No remarks provided.'}</div>
        `;
        timelineBox.appendChild(item);
      });

      navigateTo('citizen-complaint-details');

      // Set return path hooks
      document.getElementById('btn-details-back').onclick = () => {
        navigateTo('citizen-my-complaints');
      };

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- EDIT COMPLAINT LOADER ---
  async function loadGrievanceToEditForm(id) {
    try {
      // Find the complaint details (we can fetch it or read from dashboard summary but a fetch is safer)
      const response = await apiFetch(`/api/complaints/my`);
      const complaint = response.complaints.find(item => item.id == id);
      
      if (!complaint) throw new Error('Complaint details not found.');

      // Load form details
      document.getElementById('edit-complaint-db-id').value = complaint.id;
      document.getElementById('edit-title-input').value = complaint.title;
      document.getElementById('edit-category-select').value = complaint.category;
      document.getElementById('edit-location-input').value = complaint.location;
      document.getElementById('edit-priority-select').value = complaint.priority;
      document.getElementById('edit-desc-input').value = complaint.description;

      // Reset file upload
      document.getElementById('edit-file-input').value = '';
      document.getElementById('edit-file-upload-preview-div').style.display = 'none';
      document.getElementById('edit-file-upload-text-lbl').style.display = 'block';

      navigateTo('citizen-edit-complaint');

      // Set return paths
      document.getElementById('btn-edit-back').onclick = () => navigateTo('citizen-my-complaints');

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Edit form submit control
  const editComplaintForm = document.getElementById('edit-complaint-form');
  editComplaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-complaint-db-id').value;
    const title = document.getElementById('edit-title-input').value;
    const category = document.getElementById('edit-category-select').value;
    const location = document.getElementById('edit-location-input').value;
    const priority = document.getElementById('edit-priority-select').value;
    const description = document.getElementById('edit-desc-input').value;
    const file = document.getElementById('edit-file-input').files[0];
    const errorEl = document.getElementById('edit-complaint-error');

    errorEl.style.display = 'none';

    if (description.trim().length < 20) {
      document.getElementById('edit-desc-error').style.display = 'block';
      return;
    } else {
      document.getElementById('edit-desc-error').style.display = 'none';
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('location', location);
    formData.append('priority', priority);
    formData.append('description', description);
    if (file) {
      formData.append('document', file);
    }

    try {
      const response = await apiFetch(`/api/complaints/${id}`, {
        method: 'PUT',
        body: formData
      });

      showToast(response.message, 'success');
      editComplaintForm.reset();
      navigateTo('citizen-my-complaints');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-cancel-edit-complaint').onclick = () => {
    editComplaintForm.reset();
    navigateTo('citizen-my-complaints');
  };

  // --- CITIZEN PROFILE PAGE CONTROL ---
  async function loadCitizenProfileForm() {
    if (!currentUser) return;
    try {
      const response = await apiFetch('/api/auth/profile');
      const p = response.profile;
      
      // Update form fields
      document.getElementById('profile-name-header').textContent = p.name;
      document.getElementById('profile-date-header').textContent = `Registered: ${new Date(p.created_at).toLocaleDateString()}`;
      
      document.getElementById('prof-name').value = p.name;
      document.getElementById('prof-email').value = p.email;
      document.getElementById('prof-mobile').value = p.mobile;
      document.getElementById('prof-address').value = p.address;
      document.getElementById('prof-aadhaar').value = p.aadhaar || 'Not Provided';
      
      // Reset password field
      document.getElementById('prof-password').value = '';

    } catch (err) {
      console.error(err);
      showToast('Error loading profile.', 'error');
    }
  }

  // Save profile edits
  const profileForm = document.getElementById('citizen-profile-form');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof-name').value;
    const email = document.getElementById('prof-email').value;
    const mobile = document.getElementById('prof-mobile').value;
    const address = document.getElementById('prof-address').value;
    const password = document.getElementById('prof-password').value;
    const errorEl = document.getElementById('profile-form-error');
    const successEl = document.getElementById('profile-form-success');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
      const response = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: { name, email, mobile, address, password }
      });

      // Update cached details
      currentUser.name = name;
      currentUser.email = email;

      successEl.textContent = response.message;
      successEl.style.display = 'block';
      showToast(response.message, 'success');
      
      // Reload form
      loadCitizenProfileForm();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  // --- PUBLIC ANONYMOUS TRACKING FORM ---
  const publicTrackForm = document.getElementById('public-track-form');
  publicTrackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const compId = document.getElementById('public-track-id-input').value.trim().toUpperCase();
    const errorEl = document.getElementById('public-track-error');
    const resultsBox = document.getElementById('public-track-results');

    errorEl.style.display = 'none';
    resultsBox.style.display = 'none';

    try {
      const response = await apiFetch(`/api/complaints/track/${compId}`);
      const c = response.complaint;
      const timeline = response.timeline;

      // Populate text details
      document.getElementById('public-track-id').textContent = c.complaint_id;
      
      const badge = document.getElementById('public-track-status');
      badge.textContent = c.status;
      badge.className = `badge ${getStatusBadgeClass(c.status)}`;

      document.getElementById('public-track-title').textContent = c.title;
      document.getElementById('public-track-category').textContent = c.category;
      document.getElementById('public-track-department').textContent = c.department;
      
      const prio = document.getElementById('public-track-priority');
      prio.textContent = c.priority;
      prio.className = `badge ${getPriorityBadgeClass(c.priority)}`;

      document.getElementById('public-track-submission-date').textContent = new Date(c.created_at).toLocaleDateString();
      document.getElementById('public-track-resolution-date').textContent = c.status === 'Resolved' || c.status === 'Rejected'
        ? new Date(c.updated_at).toLocaleDateString() : 'Pending Action';
      document.getElementById('public-track-location').textContent = c.location;

      // Remarks
      const remarkBox = document.getElementById('public-track-remarks-container');
      const remarkTxt = document.getElementById('public-track-remarks');
      if (c.remarks) {
        remarkTxt.textContent = c.remarks;
        remarkBox.style.display = 'block';
      } else {
        remarkBox.style.display = 'none';
      }

      // Populate Timeline journey
      const timelineBox = document.getElementById('public-track-timeline');
      timelineBox.innerHTML = '';
      timeline.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item active-step';
        item.innerHTML = `
          <div class="timeline-title">${log.new_status}</div>
          <div class="timeline-date">${new Date(log.updated_at).toLocaleString()} | Officer Action</div>
          <div class="timeline-remarks">${log.remarks || 'No remarks provided.'}</div>
        `;
        timelineBox.appendChild(item);
      });

      resultsBox.style.display = 'block';

    } catch (err) {
      errorEl.textContent = 'Grievance not found. Check ID and try again.';
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  // Hero section public tracking shortcut button click
  document.getElementById('hero-btn-track').addEventListener('click', () => {
    navigateTo('track-public');
  });
  document.getElementById('hero-btn-lodge').addEventListener('click', () => {
    if (userToken) {
      navigateTo('citizen-submit-complaint');
    } else {
      navigateTo('login');
    }
  });

  // Quick categories submission shortcuts
  document.querySelectorAll('.quick-link-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.getAttribute('data-cat');
      if (userToken) {
        navigateTo('citizen-submit-complaint');
        // Pre-select category after transition
        setTimeout(() => {
          const select = document.getElementById('grievance-category-select');
          if (select) {
            select.value = cat;
          }
        }, 100);
      } else {
        showToast('Please login to lodge grievances.', 'info');
        navigateTo('login');
      }
    });
  });

  // Contact form simulation
  document.getElementById('contact-us-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Your message has been sent to support desk. Ticket ID generated.', 'success');
    document.getElementById('contact-us-form').reset();
  });

  // --- NOTIFICATIONS MANAGEMENT ---
  async function loadNotifications() {
    if (!userToken) return;
    try {
      const response = await apiFetch('/api/notifications');
      const notifications = response.notifications;
      
      const unreadCount = notifications.filter(n => !n.is_read).length;
      const unreadBadge = document.getElementById('notification-unread-count');
      
      if (unreadCount > 0) {
        unreadBadge.textContent = unreadCount;
        unreadBadge.style.display = 'flex';
      } else {
        unreadBadge.style.display = 'none';
      }

      // Populate dropdown feed list
      const container = document.getElementById('notifications-list-container');
      container.innerHTML = '';

      if (notifications.length === 0) {
        container.innerHTML = '<li class="text-center py-3 text-muted" style="font-size:12.5px;">No notifications yet.</li>';
        return;
      }

      notifications.forEach(n => {
        const item = document.createElement('li');
        item.className = `p-2 dropdown-item border-bottom ${!n.is_read ? 'bg-light font-weight-bold' : ''}`;
        item.style.fontSize = '12px';
        item.style.whiteSpace = 'normal';
        item.style.cursor = 'pointer';
        item.setAttribute('data-id', n.id);
        
        item.innerHTML = `
          <div>${n.message}</div>
          <div class="text-muted small mt-1" style="font-size:10px;">${new Date(n.created_at).toLocaleString()}</div>
        `;
        
        // Mark read on click
        item.addEventListener('click', async () => {
          if (!n.is_read) {
            try {
              await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PUT' });
              loadNotifications();
            } catch (err) {
              console.error(err);
            }
          }
        });

        container.appendChild(item);
      });

    } catch (err) {
      console.warn('Error loading notifications:', err);
    }
  }

  // Clear all notifications action
  document.getElementById('clearAllNotificationsBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PUT' });
      showToast('All notifications marked as read.', 'success');
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  });

});
