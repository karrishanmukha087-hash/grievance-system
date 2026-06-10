const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const emailHelper = require('../config/email');

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'CitizenGrievanceSecuredTokenKey2026!@#';

// 1. Citizen Registration
router.post('/register', async (req, res) => {
  const { name, email, mobile, address, aadhaar, password, confirmPassword } = req.body;

  // Simple checks
  if (!name || !email || !mobile || !address || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields (except Aadhaar) are required.' });
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  // Password length check
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  // Mobile format check (basic 10 digit check)
  if (!/^\d{10}$/.test(mobile.trim())) {
    return res.status(400).json({ success: false, message: 'Mobile number must be a valid 10-digit number.' });
  }

  try {
    // Check if email already registered in citizens
    const [existingCitizen] = await db.query('SELECT id FROM citizens WHERE email = ?', [email]);
    if (existingCitizen.length > 0) {
      return res.status(400).json({ success: false, message: 'Email address is already registered.' });
    }

    // Check if email already registered in admins
    const [existingAdmin] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (existingAdmin.length > 0) {
      return res.status(400).json({ success: false, message: 'Email address is reserved.' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert Citizen
    await db.query(
      'INSERT INTO citizens (name, email, mobile, address, aadhaar, password, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, mobile, address, aadhaar || null, hashedPassword, 'active']
    );

    // Send Welcome Email Notification
    await emailHelper.sendEmailNotification(
      email,
      'Welcome to Public Grievance Management System',
      `<h2>Account Registered Successfully</h2>
       <p>Dear ${name},</p>
       <p>Thank you for registering on the Public Grievance Management System.</p>
       <p>You can now log in to lodge grievances, track their progress, and receive real-time updates.</p>
       <p>Best Regards,<br>Support Team</p>`
    );

    res.status(201).json({ success: true, message: 'Registration successful! You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
});


// 2. Citizen Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM citizens WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const citizen = rows[0];

    // Check account status
    if (citizen.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact administration.' });
    }

    // Compare password
    const isValid = bcrypt.compareSync(password, citizen.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Issue Token
    const token = jwt.sign(
      { id: citizen.id, name: citizen.name, email: citizen.email, role: 'citizen' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: citizen.id,
        name: citizen.name,
        email: citizen.email,
        mobile: citizen.mobile,
        address: citizen.address,
        aadhaar: citizen.aadhaar,
        role: 'citizen',
        created_at: citizen.created_at
      }
    });

  } catch (error) {
    console.error('Citizen login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// 3. Admin Login
router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email/Username and password are required.' });
  }

  try {
    // Support login via email or username
    const [rows] = await db.query(
      'SELECT * FROM admins WHERE email = ? OR username = ?',
      [email, email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or user is not an administrator.' });
    }

    const admin = rows[0];

    // Compare password
    const isValid = bcrypt.compareSync(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or user is not an administrator.' });
    }

    // Issue Token
    const token = jwt.sign(
      { id: admin.id, name: admin.name, email: admin.email, role: admin.role, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        created_at: admin.created_at
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during admin login.' });
  }
});

// 4. Get Current Profile
router.get('/profile', authenticateToken, async (req, res) => {
  const { id, role } = req.user;

  try {
    if (role === 'citizen') {
      const [rows] = await db.query('SELECT id, name, email, mobile, address, aadhaar, status, created_at FROM citizens WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profile not found.' });
      }
      res.json({ success: true, profile: { ...rows[0], role: 'citizen' } });
    } else {
      // admin or superadmin
      const [rows] = await db.query('SELECT id, username, name, email, role, created_at FROM admins WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Profile not found.' });
      }
      res.json({ success: true, profile: rows[0] });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error fetching profile.' });
  }
});

// 5. Update Profile (Edit Profile & Change Password)
router.put('/profile', authenticateToken, async (req, res) => {
  const { id, role } = req.user;
  const { name, email, mobile, address, aadhaar, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  try {
    if (role === 'citizen') {
      // Check unique email (excluding current user)
      const [emailCheck] = await db.query('SELECT id FROM citizens WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Email address is already in use.' });
      }

      let updateQuery = 'UPDATE citizens SET name = ?, email = ?, mobile = ?, address = ?, aadhaar = ?';
      let params = [name, email, mobile, address, aadhaar || null];

      if (password && password.trim() !== '') {
        if (password.length < 8) {
          return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
        }
        updateQuery += ', password = ?';
        params.push(bcrypt.hashSync(password, 10));
      }

      updateQuery += ' WHERE id = ?';
      params.push(id);

      await db.query(updateQuery, params);
      res.json({ success: true, message: 'Profile updated successfully.' });
    } else {
      // admin or superadmin
      const [emailCheck] = await db.query('SELECT id FROM admins WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Email address is already in use.' });
      }

      let updateQuery = 'UPDATE admins SET name = ?, email = ?';
      let params = [name, email];

      if (password && password.trim() !== '') {
        if (password.length < 8) {
          return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
        }
        updateQuery += ', password = ?';
        params.push(bcrypt.hashSync(password, 10));
      }

      updateQuery += ' WHERE id = ?';
      params.push(id);

      await db.query(updateQuery, params);
      res.json({ success: true, message: 'Admin profile updated successfully.' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error updating profile.' });
  }
});

module.exports = router;
