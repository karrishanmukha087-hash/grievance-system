const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeRoles('citizen'));

// 1. Get Citizen Notifications Feed
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ success: true, notifications: rows });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications.' });
  }
});

// 2. Mark Notification as Read
router.put('/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT user_id FROM notifications WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    if (rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Notification marked as read.' });

  } catch (error) {
    console.error('Read notification error:', error);
    res.status(500).json({ success: false, message: 'Error updating notification status.' });
  }
});

// 3. Mark All as Read
router.put('/read-all', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Read-all notifications error:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications.' });
  }
});

module.exports = router;
