// Mock API Interceptor for GitHub Pages / Static Hosting (mockApi.js)
(function() {
  const isStaticHosting = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';
  if (!isStaticHosting) return; // Do not intercept if running on real backend

  console.log('[MOCK API] Intercepting all backend requests using localStorage database.');

  // --- INITIALIZE MOCK DATABASE ---
  const initStorage = (key, defaultVal) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
    }
  };

  initStorage('mock_citizens', []);
  initStorage('mock_admins', [
    { id: 1, username: 'admin', name: 'Super Admin', email: 'admin@grievanceportal.gov', password_plain: 'Admin@123', role: 'superadmin', created_at: new Date().toISOString() }
  ]);
  initStorage('mock_departments', [
    { id: 1, department_name: 'Roads' },
    { id: 2, department_name: 'Water Supply' },
    { id: 3, department_name: 'Electricity' },
    { id: 4, department_name: 'Health' },
    { id: 5, department_name: 'Education' },
    { id: 6, department_name: 'Transport' },
    { id: 7, department_name: 'Public Safety' },
    { id: 8, department_name: 'Sanitation' }
  ]);
  initStorage('mock_complaints', []);
  initStorage('mock_history', []);
  initStorage('mock_notifications', []);

  // Helpers
  const getData = (key) => JSON.parse(localStorage.getItem(key));
  const saveData = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  // Mock JWT Token parser helper
  function getAuthenticatedUser(headers) {
    const authHeader = headers['Authorization'] || headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    if (!token) return null;
    try {
      return JSON.parse(atob(token));
    } catch (e) {
      return null;
    }
  }

  // --- INTERCEPT FETCH ---
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const parsedUrl = new URL(url, window.location.origin);
    const path = parsedUrl.pathname;
    const method = (options.method || 'GET').toUpperCase();
    
    // Parse JSON body if exists
    let body = {};
    if (options.body) {
      if (options.body instanceof FormData) {
        // Parse FormData
        for (const [key, value] of options.body.entries()) {
          body[key] = value;
        }
      } else if (typeof options.body === 'string') {
        try {
          body = JSON.parse(options.body);
        } catch(e) {}
      }
    }

    const headers = options.headers || {};
    const currentUser = getAuthenticatedUser(headers);

    // Automatically route to the centralized backend when deployed live on GitHub Pages
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
    const backendUrl = isLocalhost ? '' : 'https://long-ears-say.loca.lt';
    if (backendUrl && path.startsWith('/api/')) {
      const targetUrl = backendUrl + path + parsedUrl.search;
      const headersCopy = { ...headers };
      headersCopy['Bypass-Tunnel-Reminder'] = 'true';
      
      const token = localStorage.getItem('token');
      if (token) {
        headersCopy['Authorization'] = 'Bearer ' + token;
      }
      if (options.body instanceof FormData) {
        delete headersCopy['Content-Type'];
        delete headersCopy['content-type'];
      }
      
      return originalFetch(targetUrl, {
        method,
        headers: headersCopy,
        body: options.body
      });
    }

    // Response Helper
    const respond = (status, data) => {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status: status,
        json: () => Promise.resolve(data)
      });
    };

    try {
      // --- ROUTES ---

      // 1. Citizen Register
      if (path === '/api/auth/register' && method === 'POST') {
        const { name, email, mobile, address, aadhaar, password, confirmPassword } = body;
        if (password !== confirmPassword) return respond(400, { success: false, message: 'Passwords do not match.' });
        
        const citizens = getData('mock_citizens');
        if (citizens.some(c => c.email === email)) {
          return respond(400, { success: false, message: 'Email address is already registered.' });
        }

        const newId = citizens.length + 1;
        citizens.push({
          id: newId, name, email, mobile, address, aadhaar, password_plain: password, status: 'active', created_at: new Date().toISOString()
        });
        saveData('mock_citizens', citizens);
        return respond(201, { success: true, message: 'Registration successful! You can now log in.' });
      }

      // 2. Citizen Login
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = body;
        const citizens = getData('mock_citizens');
        const user = citizens.find(c => c.email === email && c.password_plain === password);
        
        if (!user) return respond(401, { success: false, message: 'Invalid email or password.' });
        if (user.status !== 'active') return respond(403, { success: false, message: 'Your account has been deactivated.' });

        const mockToken = btoa(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: 'citizen' }));
        return respond(200, { success: true, token: mockToken, user: { ...user, role: 'citizen' } });
      }

      // 3. Admin Login
      if (path === '/api/auth/admin-login' && method === 'POST') {
        const { email, password } = body;
        const admins = getData('mock_admins');
        const admin = admins.find(a => (a.email === email || a.username === email) && a.password_plain === password);
        
        if (!admin) return respond(401, { success: false, message: 'Invalid credentials.' });

        const mockToken = btoa(JSON.stringify({ id: admin.id, name: admin.name, email: admin.email, role: admin.role, username: admin.username }));
        return respond(200, { success: true, token: mockToken, user: admin });
      }

      // 4. Get Profile
      if (path === '/api/auth/profile' && method === 'GET') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        if (currentUser.role === 'citizen') {
          const citizens = getData('mock_citizens');
          const user = citizens.find(c => c.id === currentUser.id);
          return respond(200, { success: true, profile: { ...user, role: 'citizen' } });
        } else {
          const admins = getData('mock_admins');
          const admin = admins.find(a => a.id === currentUser.id);
          return respond(200, { success: true, profile: admin });
        }
      }

      // 5. Update Profile
      if (path === '/api/auth/profile' && method === 'PUT') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const { name, email, mobile, address, password } = body;
        
        if (currentUser.role === 'citizen') {
          const citizens = getData('mock_citizens');
          const userIdx = citizens.findIndex(c => c.id === currentUser.id);
          if (userIdx === -1) return respond(404, { success: false, message: 'Profile not found' });
          
          citizens[userIdx].name = name;
          citizens[userIdx].email = email;
          citizens[userIdx].mobile = mobile;
          citizens[userIdx].address = address;
          if (password) citizens[userIdx].password_plain = password;
          saveData('mock_citizens', citizens);
          return respond(200, { success: true, message: 'Profile updated successfully.' });
        } else {
          const admins = getData('mock_admins');
          const adminIdx = admins.findIndex(a => a.id === currentUser.id);
          admins[adminIdx].name = name;
          admins[adminIdx].email = email;
          if (password) admins[adminIdx].password_plain = password;
          saveData('mock_admins', admins);
          return respond(200, { success: true, message: 'Admin profile updated successfully.' });
        }
      }

      // 6. Submit Grievance
      if (path === '/api/complaints' && method === 'POST') {
        if (!currentUser || currentUser.role !== 'citizen') return respond(401, { success: false, message: 'Unauthorized' });
        const { title, description, category, department, location, priority } = body;
        
        const complaints = getData('mock_complaints');
        const nextId = complaints.length + 1;
        const currentYear = new Date().getFullYear();
        const complaintId = `COMP-${currentYear}-${String(nextId).padStart(6, '0')}`;
        
        const newComplaint = {
          id: nextId,
          complaint_id: complaintId,
          citizen_id: currentUser.id,
          citizen_name: currentUser.name,
          title, description, category, department, location,
          priority: priority || 'Medium',
          document_path: body.document ? '/uploads/mock-doc.pdf' : null,
          status: 'Submitted',
          remarks: 'Grievance submitted successfully.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        complaints.push(newComplaint);
        saveData('mock_complaints', complaints);

        // Add history log
        const history = getData('mock_history');
        history.push({
          complaint_id: complaintId, old_status: 'None', new_status: 'Submitted', remarks: 'Grievance submitted by citizen.', updated_by: currentUser.name, updated_at: new Date().toISOString()
        });
        saveData('mock_history', history);

        // Add notification
        const notifications = getData('mock_notifications');
        notifications.push({
          id: notifications.length + 1, user_id: currentUser.id, message: `Your grievance ${complaintId} has been successfully submitted.`, is_read: false, created_at: new Date().toISOString()
        });
        saveData('mock_notifications', notifications);

        return respond(201, { success: true, message: 'Grievance submitted successfully.', complaintId });
      }

      // 7. Get My Complaints
      if (path === '/api/complaints/my' && method === 'GET') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const complaints = getData('mock_complaints');
        const myComplaints = complaints.filter(c => c.citizen_id === currentUser.id);
        return respond(200, { success: true, complaints: myComplaints });
      }

      // 8. Public Track
      if (path.startsWith('/api/complaints/track/') && method === 'GET') {
        const compId = path.split('/').pop().toUpperCase();
        const complaints = getData('mock_complaints');
        const complaint = complaints.find(c => c.complaint_id === compId);
        if (!complaint) return respond(404, { success: false, message: 'Grievance not found.' });

        const history = getData('mock_history');
        const timeline = history.filter(h => h.complaint_id === compId);

        return respond(200, { success: true, complaint, timeline });
      }

      // 9. Edit Complaint
      if (path.startsWith('/api/complaints/') && method === 'PUT') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const compDbId = parseInt(path.split('/').pop());
        const { title, description, category, location, priority } = body;

        const complaints = getData('mock_complaints');
        const compIdx = complaints.findIndex(c => c.id === compDbId && c.citizen_id === currentUser.id);
        if (compIdx === -1) return respond(404, { success: false, message: 'Grievance not found.' });

        const complaint = complaints[compIdx];
        if (complaint.status === 'Resolved' || complaint.status === 'Rejected') {
          return respond(400, { success: false, message: 'Grievance cannot be edited after resolution.' });
        }

        complaints[compIdx].title = title;
        complaints[compIdx].description = description;
        complaints[compIdx].category = category;
        complaints[compIdx].location = location;
        complaints[compIdx].priority = priority || complaint.priority;
        complaints[compIdx].updated_at = new Date().toISOString();
        saveData('mock_complaints', complaints);

        // Add history
        const history = getData('mock_history');
        history.push({
          complaint_id: complaint.complaint_id, old_status: complaint.status, new_status: complaint.status, remarks: 'Grievance details updated by citizen.', updated_by: currentUser.name, updated_at: new Date().toISOString()
        });
        saveData('mock_history', history);

        return respond(200, { success: true, message: 'Grievance details updated successfully.' });
      }

      // 10. Delete Complaint
      if (path.startsWith('/api/complaints/') && method === 'DELETE') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const compDbId = parseInt(path.split('/').pop());

        const complaints = getData('mock_complaints');
        const compIdx = complaints.findIndex(c => c.id === compDbId && c.citizen_id === currentUser.id);
        if (compIdx === -1) return respond(404, { success: false, message: 'Grievance not found.' });

        const complaint = complaints[compIdx];
        if (complaint.status === 'Resolved' || complaint.status === 'Rejected') {
          return respond(400, { success: false, message: 'Grievance cannot be deleted after resolution.' });
        }

        const history = getData('mock_history');
        saveData('mock_history', history.filter(h => h.complaint_id !== complaint.complaint_id));
        saveData('mock_complaints', complaints.filter(c => c.id !== compDbId));

        return respond(200, { success: true, message: 'Grievance deleted successfully.' });
      }

      // 11. Admin Dashboard Stats
      if (path === '/api/admin/dashboard-stats' && method === 'GET') {
        const citizens = getData('mock_citizens');
        const complaints = getData('mock_complaints');
        
        const stats = {
          totalCitizens: citizens.length,
          totalComplaints: complaints.length,
          Submitted: complaints.filter(c => c.status === 'Submitted').length,
          'Under Review': complaints.filter(c => c.status === 'Under Review').length,
          Assigned: complaints.filter(c => c.status === 'Assigned').length,
          'In Progress': complaints.filter(c => c.status === 'In Progress').length,
          Resolved: complaints.filter(c => c.status === 'Resolved').length,
          Rejected: complaints.filter(c => c.status === 'Rejected').length
        };
        return respond(200, { success: true, stats });
      }

      // 12. Admin Monthly Analytics
      if (path === '/api/admin/analytics/monthly' && method === 'GET') {
        const complaints = getData('mock_complaints');
        const monthsData = Array(12).fill(0);
        
        complaints.forEach(c => {
          const m = new Date(c.created_at).getMonth();
          monthsData[m]++;
        });
        return respond(200, { success: true, year: new Date().getFullYear(), data: monthsData });
      }

      // 13. Admin Category Analytics
      if (path === '/api/admin/analytics/categories' && method === 'GET') {
        const complaints = getData('mock_complaints');
        const catsMap = {};
        
        complaints.forEach(c => {
          catsMap[c.category] = (catsMap[c.category] || 0) + 1;
        });

        const data = Object.keys(catsMap).map(k => ({ category: k, count: catsMap[k] }));
        return respond(200, { success: true, data });
      }

      // 14. Admin Get Complaints List (Queue)
      if (path === '/api/admin/complaints' && method === 'GET') {
        let complaints = getData('mock_complaints');
        
        // Basic filter mocking
        const status = parsedUrl.searchParams.get('status');
        const search = parsedUrl.searchParams.get('search');
        
        if (status && status !== 'all') {
          complaints = complaints.filter(c => c.status === status);
        }
        if (search) {
          complaints = complaints.filter(c => c.complaint_id.includes(search) || c.citizen_name.toLowerCase().includes(search.toLowerCase()));
        }

        return respond(200, {
          success: true,
          total: complaints.length,
          page: 1,
          limit: 10,
          pages: 1,
          complaints
        });
      }

      // 15. Admin Get Complaint Detail
      if (path.startsWith('/api/admin/complaints/') && method === 'GET') {
        const compDbId = parseInt(path.split('/').pop());
        const complaints = getData('mock_complaints');
        const complaint = complaints.find(c => c.id === compDbId);
        
        if (!complaint) return respond(404, { success: false, message: 'Grievance not found.' });

        const citizens = getData('mock_citizens');
        const citizen = citizens.find(cit => cit.id === complaint.citizen_id) || {};

        const history = getData('mock_history');
        const timeline = history.filter(h => h.complaint_id === complaint.complaint_id);

        const mergedDetails = {
          ...complaint,
          citizen_email: citizen.email || 'N/A',
          citizen_mobile: citizen.mobile || 'N/A',
          citizen_address: citizen.address || 'N/A'
        };

        return respond(200, { success: true, complaint: mergedDetails, timeline });
      }

      // 16. Admin Update Status
      if (path.startsWith('/api/admin/complaints/') && path.endsWith('/status') && method === 'PUT') {
        const parts = path.split('/');
        const compDbId = parseInt(parts[parts.length - 2]);
        const { status, department, remarks, comment } = body;

        const complaints = getData('mock_complaints');
        const idx = complaints.findIndex(c => c.id === compDbId);
        if (idx === -1) return respond(404, { success: false, message: 'Grievance not found.' });

        const oldStatus = complaints[idx].status;
        complaints[idx].status = status;
        complaints[idx].remarks = remarks || complaints[idx].remarks;
        if (department) complaints[idx].department = department;
        complaints[idx].updated_at = new Date().toISOString();
        saveData('mock_complaints', complaints);

        // Add history log
        const history = getData('mock_history');
        const remarkText = comment || remarks || `Status updated from ${oldStatus} to ${status}`;
        history.push({
          complaint_id: complaints[idx].complaint_id,
          old_status: oldStatus,
          new_status: status,
          remarks: remarkText,
          updated_by: currentUser ? currentUser.name : 'Administrator',
          updated_at: new Date().toISOString()
        });
        saveData('mock_history', history);

        // Add notification
        const notifications = getData('mock_notifications');
        notifications.push({
          id: notifications.length + 1,
          user_id: complaints[idx].citizen_id,
          message: `Your complaint ${complaints[idx].complaint_id} status has been updated to "${status}". Remarks: ${remarks || 'None'}`,
          is_read: false,
          created_at: new Date().toISOString()
        });
        saveData('mock_notifications', notifications);

        return respond(200, { success: true, message: 'Complaint status updated successfully.' });
      }

      // 17. Admin Delete Complaint
      if (path.startsWith('/api/admin/complaints/') && method === 'DELETE') {
        const compDbId = parseInt(path.split('/').pop());
        const complaints = getData('mock_complaints');
        const complaint = complaints.find(c => c.id === compDbId);
        if (!complaint) return respond(404, { success: false, message: 'Grievance not found.' });

        const history = getData('mock_history');
        saveData('mock_history', history.filter(h => h.complaint_id !== complaint.complaint_id));
        saveData('mock_complaints', complaints.filter(c => c.id !== compDbId));
        return respond(200, { success: true, message: 'Grievance deleted from database.' });
      }

      // 18. Admin Get Users list
      if (path === '/api/admin/users' && method === 'GET') {
        const citizens = getData('mock_citizens');
        return respond(200, {
          success: true,
          total: citizens.length,
          page: 1,
          limit: 10,
          pages: 1,
          users: citizens
        });
      }

      // 19. Admin User Detail Info
      if (path.startsWith('/api/admin/users/') && method === 'GET') {
        const userId = parseInt(path.split('/').pop());
        const citizens = getData('mock_citizens');
        const citizen = citizens.find(c => c.id === userId);
        if (!citizen) return respond(404, { success: false, message: 'User not found.' });

        const complaints = getData('mock_complaints');
        const userComplaints = complaints.filter(c => c.citizen_id === userId);

        const stats = {
          total: userComplaints.length,
          Submitted: userComplaints.filter(c => c.status === 'Submitted').length,
          'Under Review': userComplaints.filter(c => c.status === 'Under Review').length,
          Assigned: userComplaints.filter(c => c.status === 'Assigned').length,
          'In Progress': userComplaints.filter(c => c.status === 'In Progress').length,
          Resolved: userComplaints.filter(c => c.status === 'Resolved').length,
          Rejected: userComplaints.filter(c => c.status === 'Rejected').length
        };

        return respond(200, { success: true, user: citizen, stats, complaints: userComplaints });
      }

      // 20. Admin Toggle User Status
      if (path.startsWith('/api/admin/users/') && path.endsWith('/status') && method === 'PUT') {
        const parts = path.split('/');
        const userId = parseInt(parts[parts.length - 2]);
        const { status } = body;
        const citizens = getData('mock_citizens');
        const idx = citizens.findIndex(c => c.id === userId);
        if (idx === -1) return respond(404, { success: false, message: 'User not found.' });
        
        citizens[idx].status = status;
        saveData('mock_citizens', citizens);
        return respond(200, { success: true, message: `User account is now ${status === 'active' ? 'Activated' : 'Deactivated'}.` });
      }

      // 21. Admin Delete User
      if (path.startsWith('/api/admin/users/') && method === 'DELETE') {
        const userId = parseInt(path.split('/').pop());
        const citizens = getData('mock_citizens');
        if (!citizens.some(c => c.id === userId)) return respond(404, { success: false, message: 'User not found.' });

        const complaints = getData('mock_complaints');
        const userComplaints = complaints.filter(c => c.citizen_id === userId);
        const userCompIds = userComplaints.map(c => c.complaint_id);

        const history = getData('mock_history');
        saveData('mock_history', history.filter(h => !userCompIds.includes(h.complaint_id)));
        saveData('mock_complaints', complaints.filter(c => c.citizen_id !== userId));
        saveData('mock_citizens', citizens.filter(c => c.id !== userId));

        return respond(200, { success: true, message: 'Citizen account and their grievances deleted.' });
      }

      // 22. Get Departments list
      if (path === '/api/departments' && method === 'GET') {
        const depts = getData('mock_departments');
        return respond(200, { success: true, departments: depts });
      }

      // 23. Add Department
      if (path === '/api/departments' && method === 'POST') {
        const { department_name } = body;
        const depts = getData('mock_departments');
        if (depts.some(d => d.department_name.toLowerCase() === department_name.toLowerCase())) {
          return respond(400, { success: false, message: 'Department already exists.' });
        }
        depts.push({ id: depts.length + 1, department_name });
        saveData('mock_departments', depts);
        return respond(201, { success: true, message: 'Department added successfully.' });
      }

      // 24. Delete Department
      if (path.startsWith('/api/departments/') && method === 'DELETE') {
        const deptId = parseInt(path.split('/').pop());
        const depts = getData('mock_departments');
        saveData('mock_departments', depts.filter(d => d.id !== deptId));
        return respond(200, { success: true, message: 'Department deleted.' });
      }

      // 25. Get Notifications List
      if (path === '/api/notifications' && method === 'GET') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const notifications = getData('mock_notifications');
        const myNotifications = notifications.filter(n => n.user_id === currentUser.id);
        return respond(200, { success: true, notifications: myNotifications });
      }

      // 26. Mark Notification Read
      if (path.startsWith('/api/notifications/') && path.endsWith('/read') && method === 'PUT') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const parts = path.split('/');
        const notifId = parseInt(parts[parts.length - 2]);

        const notifications = getData('mock_notifications');
        const idx = notifications.findIndex(n => n.id === notifId && n.user_id === currentUser.id);
        if (idx !== -1) {
          notifications[idx].is_read = true;
          saveData('mock_notifications', notifications);
        }
        return respond(200, { success: true, message: 'Notification marked as read.' });
      }

      // 27. Mark All Notifications Read
      if (path === '/api/notifications/read-all' && method === 'PUT') {
        if (!currentUser) return respond(401, { success: false, message: 'Unauthorized' });
        const notifications = getData('mock_notifications');
        notifications.forEach(n => {
          if (n.user_id === currentUser.id) n.is_read = true;
        });
        saveData('mock_notifications', notifications);
        return respond(200, { success: true, message: 'All notifications marked as read.' });
      }

      // 28. Reports Export API
      if (path.startsWith('/api/reports') && method === 'GET') {
        const complaints = getData('mock_complaints');
        return respond(200, { success: true, data: complaints });
      }

      // Fallback to original fetch for anything unhandled
      return originalFetch(url, options);

    } catch (e) {
      console.error('[MOCK API ERROR]', e);
      return respond(500, { success: false, message: 'Mock API Server Error: ' + e.message });
    }
  };

})();
