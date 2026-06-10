const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeRoles('admin', 'superadmin'));

// Get Reports Data
router.get('/data', async (req, res) => {
  const { type, department } = req.query;

  try {
    let queryStr = `
      SELECT c.complaint_id, c.title, c.category, c.department, c.location, c.priority, c.status, c.remarks, c.created_at, cit.name as citizen_name
      FROM complaints c
      JOIN citizens cit ON c.citizen_id = cit.id
    `;
    let conditions = [];
    let params = [];

    // Filter by Timeframe Type
    if (type === 'daily') {
      conditions.push('DATE(c.created_at) = CURRENT_DATE()');
    } else if (type === 'weekly') {
      conditions.push('c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (type === 'monthly') {
      conditions.push('c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    } else if (type === 'yearly') {
      conditions.push('YEAR(c.created_at) = YEAR(NOW())');
    }

    // Filter by Department
    if (department && department !== 'all' && department !== '') {
      conditions.push('c.department = ?');
      params.push(department);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY c.created_at DESC';

    const [rows] = await db.query(queryStr, params);
    res.json({ success: true, count: rows.length, data: rows });

  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ success: false, message: 'Error fetching report datasets.' });
  }
});

module.exports = router;
