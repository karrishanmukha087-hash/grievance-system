-- Citizen Grievance Management System Database Setup Script
CREATE DATABASE IF NOT EXISTS citizen_grievance_db;
USE citizen_grievance_db;

-- 1. Citizens Table
CREATE TABLE IF NOT EXISTS citizens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  address TEXT NOT NULL,
  aadhaar VARCHAR(12) NULL,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(30) UNIQUE NOT NULL,
  citizen_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  location VARCHAR(150) NOT NULL,
  priority VARCHAR(20) DEFAULT 'Medium',
  document_path VARCHAR(255) NULL,
  status VARCHAR(30) DEFAULT 'Submitted',
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Complaint History Table
CREATE TABLE IF NOT EXISTS complaint_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(30) NOT NULL,
  old_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  remarks TEXT NULL,
  updated_by VARCHAR(100) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES citizens(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed default Super Admin (Password: 'Admin@123', hashed using bcrypt)
INSERT INTO admins (username, name, email, password, role)
VALUES ('admin', 'Super Admin', 'admin@grievanceportal.gov', '$2a$10$vK3d0R9045sN2fR3hD.b0eqoJ.y4gZf5w3mGkE9Geqt9GxeR1J2/e', 'superadmin')
ON DUPLICATE KEY UPDATE id=id;

-- Seed default departments
INSERT INTO departments (department_name) VALUES
('Roads'),
('Water Supply'),
('Electricity'),
('Health'),
('Education'),
('Transport'),
('Public Safety'),
('Sanitation')
ON DUPLICATE KEY UPDATE id=id;
