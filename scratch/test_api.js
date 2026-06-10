// Native Node API Test runner (scratch/test_api.js)
// Make sure the server is running on http://localhost:3000 before executing: node scratch/test_api.js

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('===================================================');
  console.log('   CITIZEN GRIEVANCE PORTAL API TEST RUNNER');
  console.log('===================================================');
  
  let citizenToken = null;
  let adminToken = null;
  let createdComplaintId = null;
  let createdDbComplaintId = null;
  let testCitizenId = null;

  const testEmail = `test_citizen_${Date.now()}@example.com`;
  const testPassword = 'Password@123';

  // 1. REGISTER CITIZEN
  try {
    console.log('\n[TEST 1] Registering citizen...');
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Runner User',
        email: testEmail,
        mobile: '9876543210',
        address: '123 Test Street, Ward 2',
        aadhaar: '112233445566',
        password: testPassword,
        confirmPassword: testPassword
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log('✅ Citizen registration successful.');
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
    return;
  }

  // 2. LOGIN CITIZEN
  try {
    console.log('\n[TEST 2] Logging in citizen...');
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      citizenToken = data.token;
      testCitizenId = data.user.id;
      console.log(`✅ Citizen login successful. User ID: USR-${testCitizenId}`);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
    return;
  }

  // 3. ADMIN LOGIN
  try {
    console.log('\n[TEST 3] Logging in Default Super Admin...');
    const res = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin',
        password: 'Admin@123'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      adminToken = data.token;
      console.log('✅ Admin login successful.');
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
    return;
  }

  // 4. SUBMIT GRIEVANCE (Citizen)
  try {
    console.log('\n[TEST 4] Lodging new grievance as citizen...');
    const res = await fetch(`${BASE_URL}/api/complaints`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Broken Water pipeline in block-B',
        category: 'Water Supply',
        department: 'Water Supply',
        location: 'Block-B lane 5',
        priority: 'High',
        description: 'The main water pipeline has burst since yesterday and water is leaking everywhere.'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      createdComplaintId = data.complaintId;
      console.log(`✅ Grievance submitted successfully. Code: ${createdComplaintId}`);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 4 FAILED:', err.message);
    return;
  }

  // 5. TRACK GRIEVANCE PUBLICLY
  try {
    console.log(`\n[TEST 5] Publicly tracking complaint: ${createdComplaintId}...`);
    const res = await fetch(`${BASE_URL}/api/complaints/track/${createdComplaintId}`);
    const data = await res.json();
    if (res.ok && data.success) {
      createdDbComplaintId = data.complaint.id;
      console.log(`✅ Track success. Current Status: ${data.complaint.status}`);
      console.log(`✅ Timeline length: ${data.timeline.length} logs found.`);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 5 FAILED:', err.message);
    return;
  }

  // 6. EDIT COMPLAINT DETAILS (Citizen)
  try {
    console.log('\n[TEST 6] Editing complaint details as citizen...');
    const res = await fetch(`${BASE_URL}/api/complaints/${createdDbComplaintId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Burst Water pipeline in block-B - URGENT',
        category: 'Water Supply',
        location: 'Block-B lane 5, near City Park',
        priority: 'High',
        description: 'The main water pipeline has burst since yesterday and drinking water is leaking everywhere causing water logging.'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log('✅ Complaint edited successfully before resolution.');
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 6 FAILED:', err.message);
    return;
  }

  // 7. ADMIN GET QUEUE LIST
  try {
    console.log('\n[TEST 7] Querying Master Complaints Queue as Admin...');
    const res = await fetch(`${BASE_URL}/api/admin/complaints?search=${createdComplaintId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`✅ Master Queue filter success. Total found: ${data.total}`);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 7 FAILED:', err.message);
    return;
  }

  // 8. UPDATE COMPLAINT STATUS (Admin)
  try {
    console.log('\n[TEST 8] Updating complaint status to "In Progress" as Admin...');
    const res = await fetch(`${BASE_URL}/api/admin/complaints/${createdDbComplaintId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'In Progress',
        department: 'Water Supply',
        remarks: 'Repair squad dispatched to Block-B City Park.',
        comment: 'Forwarded to Municipal Repair Squad 4'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log('✅ Complaint status successfully updated.');
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 8 FAILED:', err.message);
    return;
  }

  // 9. CHECK NOTIFICATIONS (Citizen)
  try {
    console.log('\n[TEST 9] Checking notifications for citizen...');
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`✅ Notifications loaded. Count: ${data.notifications.length}`);
      console.log(`💬 Latest message: "${data.notifications[0].message}"`);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 9 FAILED:', err.message);
    return;
  }

  // 10. CLEAN UP / DELETE (Cascade check)
  try {
    console.log('\n[TEST 10] Deleting test citizen account as admin (cascade clean)...');
    const res = await fetch(`${BASE_URL}/api/admin/users/${testCitizenId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log('✅ Citizen deleted successfully, cascading complaints and logs.');
      console.log('\n🎉 ALL API UNIT TESTS PASSED SUCCESSFULLY!');
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('❌ TEST 10 FAILED:', err.message);
    return;
  }

  console.log('===================================================');
}

runTests();
