const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const emailHelper = require('../config/email');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'DOC-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB size limit
});

// Helper: Generate Unique Complaint ID: COMP-YYYY-000001
async function generateComplaintId() {
  const currentYear = new Date().getFullYear();
  try {
    const [rows] = await db.query('SELECT MAX(id) as maxId FROM complaints');
    const nextSeq = (rows[0].maxId || 0) + 1;
    const paddedSeq = String(nextSeq).padStart(6, '0');
    return `COMP-${currentYear}-${paddedSeq}`;
  } catch (error) {
    console.error('Error generating complaint ID:', error);
    // fallback random ID
    return `COMP-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;
  }
}

// 1. Submit Grievance (Citizen only)
router.post('/', authenticateToken, authorizeRoles('citizen'), (req, res) => {
  // Use multer upload middleware
  upload.single('document')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File is too large. Max size allowed is 2MB.' });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const { title, description, category, department, location, priority } = req.body;

    if (!title || !description || !category || !department || !location) {
      return res.status(400).json({ success: false, message: 'Title, Description, Category, Department, and Location are required.' });
    }

    if (description.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description must be at least 20 characters long.' });
    }

    try {
      const citizenId = req.user.id;
      const citizenName = req.user.name;
      const complaintId = await generateComplaintId();
      const documentPath = req.file ? `/uploads/${req.file.filename}` : null;
      const complaintPriority = priority || 'Medium';

      // Insert Complaint
      const insertQuery = `
        INSERT INTO complaints 
        (complaint_id, citizen_id, title, description, category, department, location, priority, document_path, status, remarks) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', 'Grievance submitted successfully.')
      `;
      await db.query(insertQuery, [
        complaintId,
        citizenId,
        title,
        description,
        category,
        department,
        location,
        complaintPriority,
        documentPath
      ]);

      // Add to History
      await db.query(
        'INSERT INTO complaint_history (complaint_id, old_status, new_status, remarks, updated_by) VALUES (?, ?, ?, ?, ?)',
        [complaintId, 'None', 'Submitted', 'Grievance submitted by citizen.', citizenName]
      );

      // Create Notification
      await db.query(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [citizenId, `Your grievance ${complaintId} has been successfully submitted.`]
      );

      // Send Email Notification
      await emailHelper.sendEmailNotification(
        req.user.email,
        `Grievance Submitted Successfully - ${complaintId}`,
        `<h2>Grievance Submitted</h2>
         <p>Dear ${citizenName},</p>
         <p>Your grievance has been successfully submitted. Details:</p>
         <ul>
           <li><strong>Complaint ID:</strong> ${complaintId}</li>
           <li><strong>Title:</strong> ${title}</li>
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Department:</strong> ${department}</li>
           <li><strong>Priority:</strong> ${complaintPriority}</li>
         </ul>
         <p>You can track the status of your grievance using the Complaint ID on our portal.</p>
         <p>Best Regards,<br>Public Grievance System</p>`
      );

      res.status(201).json({
        success: true,
        message: 'Grievance submitted successfully.',
        complaintId
      });

    } catch (error) {
      console.error('Submit complaint error:', error);
      res.status(500).json({ success: false, message: 'Internal server error while lodging grievance.' });
    }
  });
});

// 2. View My Complaints (Citizen only)
router.get('/my', authenticateToken, authorizeRoles('citizen'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, complaint_id, title, description, category, department, location, priority, document_path, status, remarks, created_at FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, complaints: rows });
  } catch (error) {
    console.error('Get my complaints error:', error);
    res.status(500).json({ success: false, message: 'Internal server error fetching your complaints.' });
  }
});

// 3. Public Track Complaint (No auth required)
router.get('/track/:complaint_id', async (req, res) => {
  const { complaint_id } = req.params;

  try {
    // Get complaint and join with citizen name for details
    const [complaints] = await db.query(
      `SELECT c.id, c.complaint_id, c.title, c.description, c.category, c.department, c.location, c.priority, c.document_path, c.status, c.remarks, c.created_at, c.updated_at, cit.name as citizen_name 
       FROM complaints c 
       JOIN citizens cit ON c.citizen_id = cit.id 
       WHERE c.complaint_id = ?`,
      [complaint_id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }

    // Get History timeline
    const [history] = await db.query(
      'SELECT old_status, new_status, remarks, updated_by, updated_at FROM complaint_history WHERE complaint_id = ? ORDER BY updated_at ASC',
      [complaint_id]
    );

    res.json({
      success: true,
      complaint: complaints[0],
      timeline: history
    });

  } catch (error) {
    console.error('Track complaint error:', error);
    res.status(500).json({ success: false, message: 'Internal server error tracking grievance.' });
  }
});

// 4. Edit Grievance (Citizen only, before resolved/rejected)
router.put('/:id', authenticateToken, authorizeRoles('citizen'), (req, res) => {
  upload.single('document')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const { id } = req.params;
    const { title, description, category, location, priority } = req.body;

    if (!title || !description || !category || !location) {
      return res.status(400).json({ success: false, message: 'Title, Description, Category, and Location are required.' });
    }

    if (description.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description must be at least 20 characters long.' });
    }

    try {
      // Fetch existing complaint
      const [rows] = await db.query('SELECT * FROM complaints WHERE id = ? AND citizen_id = ?', [id, req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Grievance not found or unauthorized.' });
      }

      const complaint = rows[0];

      // Edit only before resolved/rejected
      if (complaint.status === 'Resolved' || complaint.status === 'Rejected') {
        return res.status(400).json({ success: false, message: 'Grievance cannot be edited after resolution or rejection.' });
      }

      let documentPath = complaint.document_path;
      if (req.file) {
        documentPath = `/uploads/${req.file.filename}`;
      }

      // Update complaint
      await db.query(
        'UPDATE complaints SET title = ?, description = ?, category = ?, location = ?, priority = ?, document_path = ? WHERE id = ?',
        [title, description, category, location, priority || complaint.priority, documentPath, id]
      );

      // Log to history
      await db.query(
        'INSERT INTO complaint_history (complaint_id, old_status, new_status, remarks, updated_by) VALUES (?, ?, ?, ?, ?)',
        [complaint.complaint_id, complaint.status, complaint.status, 'Grievance details updated by citizen.', req.user.name]
      );

      res.json({ success: true, message: 'Grievance details updated successfully.' });

    } catch (error) {
      console.error('Edit complaint error:', error);
      res.status(500).json({ success: false, message: 'Internal server error updating grievance.' });
    }
  });
});

// 5. Delete Grievance (Citizen only, before resolved/rejected)
router.delete('/:id', authenticateToken, authorizeRoles('citizen'), async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch complaint
    const [rows] = await db.query('SELECT * FROM complaints WHERE id = ? AND citizen_id = ?', [id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grievance not found or unauthorized.' });
    }

    const complaint = rows[0];

    // Delete only before resolved/rejected
    if (complaint.status === 'Resolved' || complaint.status === 'Rejected') {
      return res.status(400).json({ success: false, message: 'Grievance cannot be deleted after resolution or rejection.' });
    }

    // Delete (cascades automatically to complaint_history and notifications if cascade configured, but let's delete manually to be safe)
    await db.query('DELETE FROM complaint_history WHERE complaint_id = ?', [complaint.complaint_id]);
    await db.query('DELETE FROM complaints WHERE id = ?', [id]);

    res.json({ success: true, message: 'Grievance deleted successfully.' });

  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ success: false, message: 'Internal server error deleting grievance.' });
  }
});

module.exports = router;
