// Admin Client-side Logic (admin.js)

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let adminToken = localStorage.getItem('token') || null;
  let currentAdmin = null;

  // Master Queue table settings
  let queuePage = 1;
  let queueLimit = 10;
  let queueSortField = 'c.created_at';
  let queueSortOrder = 'DESC';
  let queueTotalPages = 1;

  // Manage users table settings
  let userPage = 1;
  let userLimit = 10;
  let userTotalPages = 1;

  // Temp target states for modals
  let currentDeleteComplaintId = null;
  let currentDeleteUserId = null;
  let currentDeleteDeptId = null;
  let currentActiveUserId = null;

  // Chart instances cache
  let trendChartInstance = null;
  let categoryChartInstance = null;

  // --- API FETCH HELPER ---
  async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
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
    'admin-login', 'admin-dashboard', 'admin-queue', 'admin-complaint-details',
    'admin-users', 'admin-user-details', 'admin-departments', 'admin-reports',
    'admin-profile'
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

    // Update sidebar links active class
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Refresh view specific datasets
    if (viewName === 'admin-dashboard') {
      loadAdminDashboard();
    } else if (viewName === 'admin-queue') {
      loadComplaintsQueue();
    } else if (viewName === 'admin-users') {
      loadUsersTable();
    } else if (viewName === 'admin-departments') {
      loadDepartmentsTable();
    } else if (viewName === 'admin-profile') {
      loadAdminProfileForm();
    } else if (viewName === 'admin-reports') {
      loadReportsFormDropdowns();
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

  function getPriorityBadgeClass(prio) {
    if (prio === 'High') return 'badge-priority-high';
    if (prio === 'Medium') return 'badge-priority-medium';
    return 'badge-priority-low';
  }

  // --- ADMIN AUTH ROUTE GUARDS ---
  const adminLoginForm = document.getElementById('admin-login-form');
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('admin-login-error');

    errorEl.style.display = 'none';

    try {
      const response = await apiFetch('/api/auth/admin-login', {
        method: 'POST',
        body: { email, password }
      });

      adminToken = response.token;
      currentAdmin = response.user;
      localStorage.setItem('token', adminToken);

      showToast('Welcome Admin, access granted.', 'success');
      adminLoginForm.reset();
      
      updateAuthUIState(true);
      navigateTo('admin-dashboard');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

  function logoutAdmin() {
    currentAdmin = null;
    adminToken = null;
    localStorage.removeItem('token');
    showToast('Admin logged out.', 'info');
    updateAuthUIState(false);
    navigateTo('admin-login');
  }

  document.getElementById('sidebar-logout-btn').addEventListener('click', logoutAdmin);

  function updateAuthUIState(isAuthenticated) {
    const appShell = document.getElementById('app-shell');
    const sidebar = document.getElementById('app-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const roleBadge = document.getElementById('admin-role-badge');

    if (isAuthenticated) {
      appShell.classList.add('has-sidebar');
      appShell.classList.remove('no-sidebar');
      sidebar.style.display = 'flex';
      sidebarToggle.style.display = 'block';
      roleBadge.textContent = currentAdmin ? currentAdmin.role.toUpperCase() : 'ADMIN';
      roleBadge.style.display = 'inline-block';
    } else {
      appShell.classList.remove('has-sidebar');
      appShell.classList.add('no-sidebar');
      sidebar.style.display = 'none';
      sidebarToggle.style.display = 'none';
      roleBadge.style.display = 'none';
    }
  }

  async function checkAdminSession() {
    if (!adminToken) {
      updateAuthUIState(false);
      navigateTo('admin-login');
      return;
    }
    try {
      const response = await apiFetch('/api/auth/profile');
      if (response.success && (response.profile.role === 'admin' || response.profile.role === 'superadmin')) {
        currentAdmin = response.profile;
        updateAuthUIState(true);
        navigateTo('admin-dashboard');
      } else {
        // Logged user is a citizen, kick out
        logoutAdmin();
      }
    } catch (err) {
      console.warn('Session verification failed:', err.message);
      logoutAdmin();
    }
  }

  checkAdminSession();

  // --- ADMIN DASHBOARD & CHARTS LOGIC ---
  async function loadAdminDashboard() {
    if (!currentAdmin) return;
    try {
      // 1. KPI Counts
      const statsResponse = await apiFetch('/api/admin/dashboard-stats');
      const stats = statsResponse.stats;

      document.getElementById('ad-stat-users').textContent = stats.totalCitizens;
      document.getElementById('ad-stat-total').textContent = stats.totalComplaints;
      document.getElementById('ad-stat-pending').textContent = stats.Submitted + stats['Under Review'] + stats.Assigned + stats['In Progress'];
      document.getElementById('ad-stat-resolved').textContent = stats.Resolved;

      // 2. Load Trend Analytics Chart
      const monthlyResponse = await apiFetch('/api/admin/analytics/monthly');
      const monthlyCounts = monthlyResponse.data;
      renderTrendChart(monthlyCounts);

      // 3. Load Category Pie Chart
      const categoryResponse = await apiFetch('/api/admin/analytics/categories');
      const categoriesData = categoryResponse.data;
      renderCategoryChart(categoriesData);

      // Pre-fetch departments cache for filtering dropdowns
      loadDepartmentsCache();

    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  }

  // Render Chart.js Monthly Trend
  function renderTrendChart(data) {
    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Grievance Count',
          data: data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Render Chart.js Category Pie
  function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryDistributionChart').getContext('2d');
    
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    const labels = data.map(item => item.category);
    const counts = data.map(item => item.count);

    if (labels.length === 0) {
      labels.push('No Data');
      counts.push(1);
    }

    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
            '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } }
        }
      }
    });
  }

  // --- MASTER COMPLAINTS QUEUE ---
  let departmentsList = [];
  async function loadDepartmentsCache() {
    try {
      const response = await apiFetch('/api/departments');
      departmentsList = response.departments;
      
      // Populate queue filter dropdown
      const filterDept = document.getElementById('filter-department');
      const updateDept = document.getElementById('update-dept-select');
      
      if (filterDept) {
        filterDept.innerHTML = '<option value="all">All Departments</option>';
        departmentsList.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.department_name;
          opt.textContent = d.department_name;
          filterDept.appendChild(opt);
        });
      }

      if (updateDept) {
        updateDept.innerHTML = '<option value="">No Re-assignment</option>';
        departmentsList.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.department_name;
          opt.textContent = d.department_name;
          updateDept.appendChild(opt);
        });
      }

    } catch (err) {
      console.error(err);
    }
  }

  async function loadComplaintsQueue() {
    const search = document.getElementById('filter-search').value;
    const status = document.getElementById('filter-status').value;
    const department = document.getElementById('filter-department').value;
    const category = document.getElementById('filter-category').value;
    const priority = document.getElementById('filter-priority').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    const queryParams = new URLSearchParams({
      search, status, department, category, priority, startDate, endDate,
      sortField: queueSortField,
      sortOrder: queueSortOrder,
      page: queuePage,
      limit: queueLimit
    });

    try {
      const response = await apiFetch(`/api/admin/complaints?${queryParams.toString()}`);
      const complaints = response.complaints;
      queueTotalPages = response.pages;

      // Update paginator info text
      const total = response.total;
      const start = total === 0 ? 0 : (queuePage - 1) * queueLimit + 1;
      const end = Math.min(queuePage * queueLimit, total);
      document.getElementById('queue-pagination-info').textContent = `Showing ${start}-${end} of ${total} complaints`;

      // Populate Table
      const tbody = document.getElementById('admin-complaints-tbody');
      tbody.innerHTML = '';

      if (complaints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No complaints found matching filters.</td></tr>';
        return;
      }

      complaints.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:600;">${c.complaint_id}</td>
          <td>${c.citizen_name}</td>
          <td>${c.title}</td>
          <td>${c.category}</td>
          <td><span class="badge ${getPriorityBadgeClass(c.priority)}">${c.priority}</span></td>
          <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
          <td>${new Date(c.created_at).toLocaleDateString()}</td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-success btn-sm inspect-complaint-btn" data-id="${c.id}">Edit</button>
              <button class="btn btn-danger btn-sm delete-complaint-btn" data-id="${c.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      showToast('Error loading queue list.', 'error');
    }
  }

  // Bind filter triggers
  document.getElementById('btn-apply-filters').addEventListener('click', () => {
    queuePage = 1;
    loadComplaintsQueue();
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-department').value = 'all';
    document.getElementById('filter-category').value = 'all';
    document.getElementById('filter-priority').value = 'all';
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    queuePage = 1;
    loadComplaintsQueue();
  });

  // Table header sorting triggers
  document.getElementById('sort-id').addEventListener('click', () => toggleSort('c.complaint_id'));
  document.getElementById('sort-name').addEventListener('click', () => toggleSort('cit.name'));
  document.getElementById('sort-date').addEventListener('click', () => toggleSort('c.created_at'));

  function toggleSort(field) {
    if (queueSortField === field) {
      queueSortOrder = queueSortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      queueSortField = field;
      queueSortOrder = 'DESC';
    }
    loadComplaintsQueue();
  }

  // Pagination triggers
  document.getElementById('btn-pagination-prev').addEventListener('click', () => {
    if (queuePage > 1) {
      queuePage--;
      loadComplaintsQueue();
    }
  });

  document.getElementById('btn-pagination-next').addEventListener('click', () => {
    if (queuePage < queueTotalPages) {
      queuePage++;
      loadComplaintsQueue();
    }
  });

  // --- INSPECTOR PAGE RENDERING ---
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.inspect-complaint-btn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      await showComplaintInspector(id);
    }
  });

  async function showComplaintInspector(id) {
    try {
      const response = await apiFetch(`/api/admin/complaints/${id}`);
      const c = response.complaint;
      const timeline = response.timeline;

      // Populate text nodes
      document.getElementById('inspector-complaint-id').textContent = c.complaint_id;
      
      const badge = document.getElementById('inspector-status-badge');
      badge.textContent = c.status;
      badge.className = `badge ${getStatusBadgeClass(c.status)}`;

      document.getElementById('inspector-citizen-name').textContent = c.citizen_name;
      document.getElementById('inspector-citizen-phone').textContent = c.citizen_mobile;
      document.getElementById('inspector-citizen-email').textContent = c.citizen_email;
      document.getElementById('inspector-title').textContent = c.title;
      document.getElementById('inspector-category').textContent = c.category;
      document.getElementById('inspector-department').textContent = c.department;
      
      const prio = document.getElementById('inspector-priority');
      prio.textContent = c.priority;
      prio.className = `badge ${getPriorityBadgeClass(c.priority)}`;
      
      document.getElementById('inspector-submission-date').textContent = new Date(c.created_at).toLocaleDateString();
      document.getElementById('inspector-resolution-date').textContent = c.status === 'Resolved' || c.status === 'Rejected'
        ? new Date(c.updated_at).toLocaleDateString() : 'Pending Resolution';
      
      document.getElementById('inspector-location').textContent = c.location;
      document.getElementById('inspector-citizen-address').textContent = c.citizen_address;
      document.getElementById('inspector-desc').textContent = c.description;

      // Handle document download link
      const docRow = document.getElementById('inspector-attachment-row');
      const viewBtn = document.getElementById('inspector-view-doc-btn');
      if (c.document_path) {
        viewBtn.href = c.document_path;
        docRow.style.display = 'block';
      } else {
        docRow.style.display = 'none';
      }

      // Populate status change fields
      document.getElementById('update-status-select').value = c.status;
      document.getElementById('update-dept-select').value = '';
      document.getElementById('update-remarks').value = c.remarks || '';
      document.getElementById('update-comment').value = '';

      // Render timeline list
      const timelineBox = document.getElementById('inspector-timeline');
      timelineBox.innerHTML = '';
      timeline.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item active-step';
        item.innerHTML = `
          <div class="timeline-title">${log.new_status}</div>
          <div class="timeline-date">${new Date(log.updated_at).toLocaleString()} | Officer Action: ${log.updated_by}</div>
          <div class="timeline-remarks">${log.remarks || 'No remarks logged.'}</div>
        `;
        timelineBox.appendChild(item);
      });

      navigateTo('admin-complaint-details');
      
      // Back button redirect
      document.getElementById('btn-details-back').onclick = () => navigateTo('admin-queue');

      // Bind update form submission specific to this complaint ID
      const form = document.getElementById('inspector-status-update-form');
      form.onsubmit = async (evt) => {
        evt.preventDefault();
        const statusVal = document.getElementById('update-status-select').value;
        const deptVal = document.getElementById('update-dept-select').value;
        const remarksVal = document.getElementById('update-remarks').value;
        const commentVal = document.getElementById('update-comment').value;

        try {
          const updateResponse = await apiFetch(`/api/admin/complaints/${c.id}/status`, {
            method: 'PUT',
            body: { 
              status: statusVal, 
              department: deptVal || null, 
              remarks: remarksVal, 
              comment: commentVal 
            }
          });

          showToast(updateResponse.message, 'success');
          // Reload inspector view
          showComplaintInspector(c.id);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- DELETE COMPLAINT LOGIC ---
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-complaint-btn');
    if (btn) {
      currentDeleteComplaintId = btn.getAttribute('data-id');
      const deleteModal = new bootstrap.Modal(document.getElementById('deleteComplaintModal'));
      deleteModal.show();
    }
  });

  document.getElementById('btn-confirm-delete-complaint').addEventListener('click', async () => {
    if (!currentDeleteComplaintId) return;
    try {
      const response = await apiFetch(`/api/admin/complaints/${currentDeleteComplaintId}`, {
        method: 'DELETE'
      });
      showToast(response.message, 'success');
      
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('deleteComplaintModal'));
      modalInstance.hide();
      
      loadComplaintsQueue();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // --- MANAGE USERS MODULE ---
  async function loadUsersTable() {
    const search = document.getElementById('user-filter-search').value;
    const queryParams = new URLSearchParams({
      search,
      page: userPage,
      limit: userLimit
    });

    try {
      const response = await apiFetch(`/api/admin/users?${queryParams.toString()}`);
      const users = response.users;
      userTotalPages = response.pages;

      // Pagination details
      const total = response.total;
      const start = total === 0 ? 0 : (userPage - 1) * userLimit + 1;
      const end = Math.min(userPage * userLimit, total);
      document.getElementById('user-pagination-info').textContent = `Showing ${start}-${end} of ${total} users`;

      const tbody = document.getElementById('admin-users-tbody');
      tbody.innerHTML = '';

      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No users found.</td></tr>';
        return;
      }

      users.forEach(u => {
        const isDeactivated = u.status !== 'active';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>USR-${String(u.id).padStart(5, '0')}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.mobile}</td>
          <td><span class="badge ${isDeactivated ? 'badge-rejected' : 'badge-progress'}">${u.status}</span></td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-success btn-sm inspect-user-btn" data-id="${u.id}">Edit</button>
              ${isDeactivated ? `
                <button class="btn btn-secondary btn-sm toggle-user-status-btn" data-id="${u.id}" data-action="activate">Activate</button>
              ` : `
                <button class="btn btn-warning btn-sm toggle-user-status-btn" data-id="${u.id}" data-action="deactivate">Deactivate</button>
              `}
              <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      showToast('Error querying user list.', 'error');
    }
  }

  document.getElementById('btn-apply-user-filters').addEventListener('click', () => {
    userPage = 1;
    loadUsersTable();
  });

  // User pagination bindings
  document.getElementById('btn-user-prev').addEventListener('click', () => {
    if (userPage > 1) {
      userPage--;
      loadUsersTable();
    }
  });

  document.getElementById('btn-user-next').addEventListener('click', () => {
    if (userPage < userTotalPages) {
      userPage++;
      loadUsersTable();
    }
  });

  // Activate / Deactivate account controls
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.toggle-user-status-btn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-action');
      const targetStatus = act === 'activate' ? 'active' : 'inactive';
      
      try {
        const response = await apiFetch(`/api/admin/users/${id}/status`, {
          method: 'PUT',
          body: { status: targetStatus }
        });
        showToast(response.message, 'success');
        loadUsersTable();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Delete User controls
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-user-btn');
    if (btn) {
      currentDeleteUserId = btn.getAttribute('data-id');
      const deleteModal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
      deleteModal.show();
    }
  });

  document.getElementById('btn-confirm-delete-user').addEventListener('click', async () => {
    if (!currentDeleteUserId) return;
    try {
      const response = await apiFetch(`/api/admin/users/${currentDeleteUserId}`, {
        method: 'DELETE'
      });
      showToast(response.message, 'success');
      
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
      modalInstance.hide();
      
      loadUsersTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // --- USER DETAILS INSPECTOR PAGE ---
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.inspect-user-btn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      await showUserInspector(id);
    }
  });

  async function showUserInspector(id) {
    try {
      const response = await apiFetch(`/api/admin/users/${id}`);
      const u = response.user;
      const stats = response.stats;
      const complaints = response.complaints;

      // Populate text fields
      document.getElementById('u-details-name').textContent = u.name;
      
      const badge = document.getElementById('u-details-status');
      badge.textContent = u.status.toUpperCase();
      badge.className = `badge ${u.status === 'active' ? 'badge-progress' : 'badge-rejected'}`;

      document.getElementById('u-details-email').textContent = u.email;
      document.getElementById('u-details-mobile').textContent = u.mobile;
      document.getElementById('u-details-aadhaar').textContent = u.aadhaar || 'Not Provided';
      document.getElementById('u-details-date').textContent = new Date(u.created_at).toLocaleDateString();
      document.getElementById('u-details-address').textContent = u.address;

      // Populate statistics summary
      document.getElementById('u-metric-total').textContent = stats.total;
      document.getElementById('u-metric-pending').textContent = stats.Submitted + stats['Under Review'] + stats.Assigned + stats['In Progress'];
      document.getElementById('u-metric-resolved').textContent = stats.Resolved;

      // Populate complaints history rows
      const tbody = document.getElementById('u-complaints-tbody');
      tbody.innerHTML = '';

      if (complaints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No complaints logged.</td></tr>';
      } else {
        complaints.forEach(c => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:600;">${c.complaint_id}</td>
            <td>${c.title}</td>
            <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
            <td><button class="btn btn-secondary btn-sm inspect-complaint-btn" data-id="${c.id}">View</button></td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Bind user detail panel activation actions
      document.getElementById('btn-user-activate').onclick = async () => {
        try {
          const res = await apiFetch(`/api/admin/users/${u.id}/status`, { method: 'PUT', body: { status: 'active' } });
          showToast(res.message, 'success');
          showUserInspector(u.id);
        } catch(err) { showToast(err.message, 'error'); }
      };

      document.getElementById('btn-user-deactivate').onclick = async () => {
        try {
          const res = await apiFetch(`/api/admin/users/${u.id}/status`, { method: 'PUT', body: { status: 'inactive' } });
          showToast(res.message, 'success');
          showUserInspector(u.id);
        } catch(err) { showToast(err.message, 'error'); }
      };

      navigateTo('admin-user-details');
      document.getElementById('btn-user-details-back').onclick = () => navigateTo('admin-users');

    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- DEPARTMENT MANAGEMENT ---
  async function loadDepartmentsTable() {
    try {
      const response = await apiFetch('/api/departments');
      const departments = response.departments;
      const tbody = document.getElementById('admin-departments-tbody');

      tbody.innerHTML = '';
      if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No departments created.</td></tr>';
        return;
      }

      departments.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>DEP-${String(d.id).padStart(3, '0')}</td>
          <td>${d.department_name}</td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-success btn-sm edit-dept-btn" data-id="${d.id}" data-name="${d.department_name}">Edit</button>
              <button class="btn btn-danger btn-sm delete-dept-btn" data-id="${d.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      showToast('Error querying departments.', 'error');
    }
  }

  // Trigger add department modal
  document.getElementById('btn-add-dept-trigger').addEventListener('click', () => {
    document.getElementById('edit-dept-id').value = '';
    document.getElementById('dept-name-input').value = '';
    document.getElementById('deptModalTitle').textContent = 'Add Department';
    const modal = new bootstrap.Modal(document.getElementById('addDeptModal'));
    modal.show();
  });

  // Trigger edit department modal
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-dept-btn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      document.getElementById('edit-dept-id').value = id;
      document.getElementById('dept-name-input').value = name;
      document.getElementById('deptModalTitle').textContent = 'Edit Department';
      const modal = new bootstrap.Modal(document.getElementById('addDeptModal'));
      modal.show();
    }
  });

  // Submit add/edit department form
  const deptForm = document.getElementById('dept-editor-form');
  deptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-dept-id').value;
    const name = document.getElementById('dept-name-input').value;

    try {
      let response;
      if (id) {
        // Edit mode
        response = await apiFetch(`/api/departments/${id}`, {
          method: 'PUT',
          body: { department_name: name }
        });
      } else {
        // Add mode
        response = await apiFetch('/api/departments', {
          method: 'POST',
          body: { department_name: name }
        });
      }

      showToast(response.message, 'success');
      
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addDeptModal'));
      modalInstance.hide();
      deptForm.reset();
      
      loadDepartmentsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Delete department triggers
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-dept-btn');
    if (btn) {
      currentDeleteDeptId = btn.getAttribute('data-id');
      const modal = new bootstrap.Modal(document.getElementById('deleteDeptModal'));
      modal.show();
    }
  });

  document.getElementById('btn-confirm-delete-dept').addEventListener('click', async () => {
    if (!currentDeleteDeptId) return;
    try {
      const response = await apiFetch(`/api/departments/${currentDeleteDeptId}`, {
        method: 'DELETE'
      });
      showToast(response.message, 'success');
      
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById('deleteDeptModal'));
      modalInstance.hide();
      
      loadDepartmentsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });


  // --- REPORTS MODULE & DATA EXPORTING ---
  function loadReportsFormDropdowns() {
    // Populate departments selection in reports
    const reportDeptSelect = document.getElementById('report-dept-select');
    if (reportDeptSelect) {
      reportDeptSelect.innerHTML = '<option value="all">All Departments</option>';
      departmentsList.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.department_name;
        opt.textContent = d.department_name;
        reportDeptSelect.appendChild(opt);
      });
    }
  }

  // Toggle department select visibility in reports based on type
  document.getElementById('report-type-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const group = document.getElementById('report-dept-group');
    if (val === 'department') {
      group.style.display = 'block';
    } else {
      group.style.display = 'none';
    }
  });

  // Compile datasets
  let compiledDataset = [];
  const reportsForm = document.getElementById('reports-generate-form');
  reportsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('report-type-select').value;
    const department = document.getElementById('report-dept-select').value;

    const queryParams = new URLSearchParams({
      type,
      department: type === 'department' ? department : 'all'
    });

    try {
      const response = await apiFetch(`/api/reports/data?${queryParams.toString()}`);
      compiledDataset = response.data;
      
      document.getElementById('compiled-report-count').textContent = response.count;
      
      // Render Preview rows
      const tbody = document.getElementById('compiled-reports-tbody');
      tbody.innerHTML = '';

      if (compiledDataset.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No logs matching compiled parameters.</td></tr>';
      } else {
        compiledDataset.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:600;">${row.complaint_id}</td>
            <td>${row.citizen_name}</td>
            <td>${row.title}</td>
            <td>${row.category}</td>
            <td>${row.department}</td>
            <td><span class="badge ${getStatusBadgeClass(row.status)}">${row.status}</span></td>
            <td>${new Date(row.created_at).toLocaleDateString()}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      document.getElementById('compiled-reports-preview-box').style.display = 'block';
      showToast('Dataset compiled successfully.', 'success');

    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-clear-reports').addEventListener('click', () => {
    reportsForm.reset();
    document.getElementById('report-dept-group').style.display = 'none';
    document.getElementById('compiled-reports-preview-box').style.display = 'none';
    compiledDataset = [];
  });

  // --- SHEETJS EXCEL EXPORT ---
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    if (compiledDataset.length === 0) {
      showToast('No dataset compiled to export.', 'warning');
      return;
    }
    
    // Map records to readable excel columns
    const excelData = compiledDataset.map(row => ({
      'Grievance ID': row.complaint_id,
      'Citizen Name': row.citizen_name,
      'Subject': row.title,
      'Category': row.category,
      'Assigned Department': row.department,
      'Location Address': row.location,
      'Priority Level': row.priority,
      'Resolution Status': row.status,
      'Officer Remarks': row.remarks || '',
      'Submission Date': new Date(row.created_at).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grievance Records");

    // Write file
    XLSX.writeFile(wb, `Grievance_Redressal_Report_${Date.now()}.xlsx`);
    showToast('Spreadsheet downloaded successfully.', 'success');
  });

  // --- JSPDF AUTO-TABLE PDF EXPORT ---
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    if (compiledDataset.length === 0) {
      showToast('No dataset compiled to export.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape format

    doc.setFont("Inter", "bold");
    doc.setFontSize(18);
    doc.text("Public Grievance Portal - Redressal Audit Report", 14, 15);
    doc.setFontSize(10);
    doc.setFont("Inter", "normal");
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Grievance Cases: ${compiledDataset.length}`, 14, 21);

    const headers = [["Grievance ID", "Citizen Name", "Subject/Title", "Category", "Department", "Status", "Date Submitted"]];
    
    const rows = compiledDataset.map(row => [
      row.complaint_id,
      row.citizen_name,
      row.title,
      row.category,
      row.department,
      row.status,
      new Date(row.created_at).toLocaleDateString()
    ]);

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [15, 44, 89], textColor: [255, 255, 255] }
    });

    doc.save(`Grievance_Redressal_Report_${Date.now()}.pdf`);
    showToast('Audit Report PDF downloaded.', 'success');
  });

  // Return button bindings
  document.getElementById('btn-reports-back').addEventListener('click', () => navigateTo('admin-dashboard'));
  document.getElementById('btn-profile-back').addEventListener('click', () => navigateTo('admin-dashboard'));


  // --- ADMIN PROFILE SETTINGS FORM ---
  async function loadAdminProfileForm() {
    if (!currentAdmin) return;
    try {
      const response = await apiFetch('/api/auth/profile');
      const profile = response.profile;

      document.getElementById('admin-name-header').textContent = profile.name;
      document.getElementById('admin-role-header').textContent = `Role: ${profile.role.toUpperCase()}`;

      document.getElementById('adm-name').value = profile.name;
      document.getElementById('adm-username').value = profile.username;
      document.getElementById('adm-email').value = profile.email;
      
      // Clear password field
      document.getElementById('adm-password').value = '';

    } catch (err) {
      console.error(err);
      showToast('Error loading profile form.', 'error');
    }
  }

  // Save admin profile updates
  const adminProfileForm = document.getElementById('admin-profile-form');
  adminProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('adm-name').value;
    const email = document.getElementById('adm-email').value;
    const password = document.getElementById('adm-password').value;
    const errorEl = document.getElementById('admin-profile-error');
    const successEl = document.getElementById('admin-profile-success');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
      const response = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: { name, email, password }
      });

      // Update local cache details
      currentAdmin.name = name;
      currentAdmin.email = email;

      successEl.textContent = response.message;
      successEl.style.display = 'block';
      showToast(response.message, 'success');
      
      loadAdminProfileForm();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      showToast(err.message, 'error');
    }
  });

});
