const express = require('express');
const router = require('express').Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const emailHelper = require('../config/email');

// Apply protection middleware to all admin routes
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'superadmin'));

// 1. Dashboard Summary KPI Stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Total Citizens
    const [citizenRows] = await db.query("SELECT COUNT(*) as count FROM citizens");
    const totalCitizens = citizenRows[0].count;

    // Complaints count
    const [complaintRows] = await db.query("SELECT COUNT(*) as count FROM complaints");
    const totalComplaints = complaintRows[0].count;

    // Status distributions
    const [statusRows] = await db.query("SELECT status, COUNT(*) as count FROM complaints GROUP BY status");
    
    // Construct response counts mapping
    const counts = {
      totalCitizens,
      totalComplaints,
      Submitted: 0,
      'Under Review': 0,
      Assigned: 0,
      'In Progress': 0,
      Resolved: 0,
      Rejected: 0
    };

    statusRows.forEach(row => {
      if (counts.hasOwnProperty(row.status)) {
        counts[row.status] = row.count;
      }
    });

    res.json({ success: true, stats: counts });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats.' });
  }
});

// 2. Real-Time Analytics: Monthly Trend (Chart.js)
router.get('/analytics/monthly', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const queryStr = `
      SELECT MONTH(created_at) as month, COUNT(*) as count 
      FROM complaints 
      WHERE YEAR(created_at) = ? 
      GROUP BY MONTH(created_at)
      ORDER BY month ASC
    `;
    const [rows] = await db.query(queryStr, [currentYear]);

    // Initialise 12 months array
    const monthlyCounts = Array(12).fill(0);
    rows.forEach(row => {
      const monthIdx = row.month - 1; // 1-indexed to 0-indexed
      if (monthIdx >= 0 && monthIdx < 12) {
        monthlyCounts[monthIdx] = row.count;
      }
    });

    res.json({ success: true, year: currentYear, data: monthlyCounts });

  } catch (error) {
    console.error('Monthly analytics error:', error);
    res.status(500).json({ success: false, message: 'Error compiling monthly trend.' });
  }
});

// 3. Real-Time Analytics: Category-wise Distribution (Pie Chart)
router.get('/analytics/categories', async (req, res) => {
  try {
    const queryStr = `
      SELECT category, COUNT(*) as count 
      FROM complaints 
      GROUP BY category
    `;
    const [rows] = await db.query(queryStr);
    
    res.json({ success: true, data: rows });

  } catch (error) {
    console.error('Category analytics error:', error);
    res.status(500).json({ success: false, message: 'Error compiling category statistics.' });
  }
});

// 4. Complaint Management Queue with Filters, Search, Pagination, Sorting
router.get('/complaints', async (req, res) => {
  try {
    const { 
      search, status, category, department, priority, startDate, endDate,
      sortField, sortOrder, page, limit 
    } = req.query;

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 10;
    const offset = (currentPage - 1) * pageLimit;

    let baseQuery = `
      FROM complaints c 
      JOIN citizens cit ON c.citizen_id = cit.id
    `;
    let conditions = [];
    let params = [];

    // Filter by ID or Citizen Name
    if (search && search.trim() !== '') {
      conditions.push('(c.complaint_id LIKE ? OR cit.name LIKE ?)');
      const searchWild = `%${search.trim()}%`;
      params.push(searchWild, searchWild);
    }

    if (status && status !== 'all') {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (category && category !== 'all') {
      conditions.push('c.category = ?');
      params.push(category);
    }

    if (department && department !== 'all') {
      conditions.push('c.department = ?');
      params.push(department);
    }

    if (priority && priority !== 'all') {
      conditions.push('c.priority = ?');
      params.push(priority);
    }

    if (startDate && startDate !== '') {
      conditions.push('DATE(c.created_at) >= ?');
      params.push(startDate);
    }

    if (endDate && endDate !== '') {
      conditions.push('DATE(c.created_at) <= ?');
      params.push(endDate);
    }

    let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    // Count query for pagination header
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const [countRows] = await db.query(countQuery, params);
    const totalRecords = countRows[0].total;

    // Sorting
    const validSortFields = ['c.complaint_id', 'cit.name', 'c.title', 'c.category', 'c.status', 'c.created_at', 'c.priority'];
    const actualSortField = validSortFields.includes(sortField) ? sortField : 'c.created_at';
    const actualSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Retrieve data
    const dataQuery = `
      SELECT c.id, c.complaint_id, c.title, c.category, c.department, c.location, c.priority, c.document_path, c.status, c.remarks, c.created_at, c.updated_at, cit.name as citizen_name
      ${baseQuery}
      ${whereClause}
      ORDER BY ${actualSortField} ${actualSortOrder}
      LIMIT ? OFFSET ?
    `;
    
    // Add page limit and offset to params (ensure they are integers)
    params.push(pageLimit, offset);

    const [rows] = await db.query(dataQuery, params);

    res.json({
      success: true,
      total: totalRecords,
      page: currentPage,
      limit: pageLimit,
      pages: Math.ceil(totalRecords / pageLimit),
      complaints: rows
    });

  } catch (error) {
    console.error('Queue list query error:', error);
    res.status(500).json({ success: false, message: 'Error querying complaints queue.' });
  }
});

// 5. Complaint Details Page
router.get('/complaints/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const queryStr = `
      SELECT c.*, cit.name as citizen_name, cit.email as citizen_email, cit.mobile as citizen_mobile, cit.address as citizen_address
      FROM complaints c
      JOIN citizens cit ON c.citizen_id = cit.id
      WHERE c.id = ?
    `;
    const [complaints] = await db.query(queryStr, [id]);

    if (complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Grievance record not found.' });
    }

    const complaint = complaints[0];

    // Get History timeline logs
    const [history] = await db.query(
      'SELECT old_status, new_status, remarks, updated_by, updated_at FROM complaint_history WHERE complaint_id = ? ORDER BY updated_at ASC',
      [complaint.complaint_id]
    );

    res.json({
      success: true,
      complaint: complaint,
      timeline: history
    });

  } catch (error) {
    console.error('Grievance detail error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving grievance details.' });
  }
});

// 6. Complaint Status & Assignment Management
router.put('/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, department, remarks, comment } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required.' });
  }

  try {
    // Fetch current complaint details joined with citizen name & email
    const [rows] = await db.query(
      `SELECT c.*, cit.email as citizen_email, cit.name as citizen_name 
       FROM complaints c 
       JOIN citizens cit ON c.citizen_id = cit.id 
       WHERE c.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grievance record not found.' });
    }

    const complaint = rows[0];
    const oldStatus = complaint.status;
    const adminName = req.user.name;

    // Build update parameters
    let updateFields = 'status = ?, remarks = ?';
    let params = [status, remarks || complaint.remarks];

    if (department) {
      updateFields += ', department = ?';
      params.push(department);
    }

    updateFields += ' WHERE id = ?';
    params.push(id);

    await db.query(`UPDATE complaints SET ${updateFields}`, params);

    // Save to complaint history
    const historyRemark = comment || remarks || `Status updated from ${oldStatus} to ${status}`;
    await db.query(
      'INSERT INTO complaint_history (complaint_id, old_status, new_status, remarks, updated_by) VALUES (?, ?, ?, ?, ?)',
      [complaint.complaint_id, oldStatus, status, historyRemark, adminName]
    );

    // Send notification to Citizen
    const notificationMessage = `Your complaint ${complaint.complaint_id} status has been updated to "${status}". Remarks: ${remarks || 'None'}`;
    await db.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [complaint.citizen_id, notificationMessage]
    );

    // Send status update email notification
    await emailHelper.sendEmailNotification(
      complaint.citizen_email,
      `Grievance Status Updated - ${complaint.complaint_id}`,
      `<h2>Grievance Status Update</h2>
       <p>Dear ${complaint.citizen_name},</p>
       <p>The status of your grievance <strong>${complaint.complaint_id}</strong> has been updated.</p>
       <ul>
         <li><strong>New Status:</strong> ${status}</li>
         <li><strong>Officer Remarks/Action:</strong> ${remarks || 'None'}</li>
         <li><strong>Update Date:</strong> ${new Date().toLocaleString()}</li>
       </ul>
       <p>Log in to your dashboard to view the full history timeline and track status updates.</p>
       <p>Best Regards,<br>Public Grievance System Support</p>`
    );

    res.json({ success: true, message: 'Complaint status updated successfully.' });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: 'Error updating complaint status.' });
  }
});

// 7. Delete Complaint (Admin only)
router.delete('/complaints/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT complaint_id FROM complaints WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaintId = rows[0].complaint_id;

    // Delete history logs and complaint record
    await db.query('DELETE FROM complaint_history WHERE complaint_id = ?', [complaintId]);
    await db.query('DELETE FROM complaints WHERE id = ?', [id]);

    res.json({ success: true, message: 'Grievance deleted from database.' });

  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ success: false, message: 'Error deleting complaint.' });
  }
});

// 8. Manage Users: Search & Filter Citizens List
router.get('/users', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 10;
    const offset = (currentPage - 1) * pageLimit;

    let conditions = [];
    let params = [];

    if (search && search.trim() !== '') {
      conditions.push('(name LIKE ? OR email LIKE ? OR mobile LIKE ?)');
      const searchWild = `%${search.trim()}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) as total FROM citizens ${whereClause}`;
    const [countRows] = await db.query(countQuery, params);
    const totalRecords = countRows[0].total;

    const dataQuery = `
      SELECT id, name, email, mobile, status, created_at 
      FROM citizens
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    params.push(pageLimit, offset);
    const [rows] = await db.query(dataQuery, params);

    res.json({
      success: true,
      total: totalRecords,
      page: currentPage,
      limit: pageLimit,
      pages: Math.ceil(totalRecords / pageLimit),
      users: rows
    });

  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ success: false, message: 'Error querying user profiles.' });
  }
});

// 9. User Details Page (Profile, metrics summary, and list of complaints)
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [citizenRows] = await db.query(
      'SELECT id, name, email, mobile, address, aadhaar, status, created_at FROM citizens WHERE id = ?',
      [id]
    );

    if (citizenRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const citizen = citizenRows[0];

    // Complaints counts
    const [complaintSummary] = await db.query(
      'SELECT status, COUNT(*) as count FROM complaints WHERE citizen_id = ? GROUP BY status',
      [id]
    );

    // Convert to structured summary
    const counts = {
      total: 0,
      Submitted: 0,
      'Under Review': 0,
      Assigned: 0,
      'In Progress': 0,
      Resolved: 0,
      Rejected: 0
    };

    complaintSummary.forEach(row => {
      if (counts.hasOwnProperty(row.status)) {
        counts[row.status] = row.count;
      }
      counts.total += row.count;
    });

    // Fetch complaint history list
    const [complaints] = await db.query(
      'SELECT id, complaint_id, title, category, status, created_at FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({
      success: true,
      user: citizen,
      stats: counts,
      complaints: complaints
    });

  } catch (error) {
    console.error('User detail query error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving user profile statistics.' });
  }
});

// 10. Activate/Deactivate User Account
router.put('/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' or 'inactive'

  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
  }

  try {
    const [rows] = await db.query('SELECT name FROM citizens WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Citizen account not found.' });
    }

    await db.query('UPDATE citizens SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: `User account is now ${status === 'active' ? 'Activated' : 'Deactivated'}.` });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, message: 'Error setting user account status.' });
  }
});

// 11. Delete Citizen Account
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT name FROM citizens WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Citizen account not found.' });
    }

    // Deleting the citizen cascades to complaints, history, and notifications due to FOREIGN KEY Constraints.
    await db.query('DELETE FROM citizens WHERE id = ?', [id]);
    res.json({ success: true, message: 'Citizen account and their grievances deleted.' });

  } catch (error) {
    console.error('Delete citizen error:', error);
    res.status(500).json({ success: false, message: 'Error deleting citizen account.' });
  }
});

module.exports = router;
