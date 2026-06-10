const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// 1. Get All Departments (Public - Citizens need this to fill out the form)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, department_name FROM departments ORDER BY department_name ASC');
    res.json({ success: true, departments: rows });
  } catch (error) {
    console.error('Fetch departments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching departments.' });
  }
});

// 2. Add Department (Admin only)
router.post('/', authenticateToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
  const { department_name } = req.body;

  if (!department_name || department_name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Department name is required.' });
  }

  try {
    // Check duplication
    const [existing] = await db.query('SELECT id FROM departments WHERE department_name = ?', [department_name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Department already exists.' });
    }

    await db.query('INSERT INTO departments (department_name) VALUES (?)', [department_name.trim()]);
    res.status(201).json({ success: true, message: 'Department added successfully.' });

  } catch (error) {
    console.error('Add department error:', error);
    res.status(500).json({ success: false, message: 'Error adding department.' });
  }
});

// 3. Edit Department (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
  const { id } = req.params;
  const { department_name } = req.body;

  if (!department_name || department_name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Department name is required.' });
  }

  try {
    // Check if exists
    const [rows] = await db.query('SELECT id FROM departments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    // Check duplicate name
    const [existing] = await db.query('SELECT id FROM departments WHERE department_name = ? AND id != ?', [department_name.trim(), id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Another department already shares this name.' });
    }

    await db.query('UPDATE departments SET department_name = ? WHERE id = ?', [department_name.trim(), id]);
    res.json({ success: true, message: 'Department name updated successfully.' });

  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, message: 'Error updating department.' });
  }
});

// 4. Delete Department (Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT id FROM departments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    await db.query('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Department deleted successfully.' });

  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, message: 'Error deleting department.' });
  }
});

module.exports = router;
