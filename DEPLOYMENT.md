# Deployment Guide - Public Grievance Management System

This document outlines the step-by-step instructions for deploying this Public Grievance Management System to various cloud platforms, including **Hostinger Shared Hosting**, **Replit**, and **Linux VPS**.

---

## 📋 Pre-Deployment Checklist
1. Export your local MySQL database or prepare the database configuration.
2. Exclude `node_modules` and the `scratch/node-portable` directory from your zip/uploads to keep the package lightweight.
3. Keep your JWT secret secure by using a strong password string in production.

---

## 1. Deploying to Hostinger (Node.js Shared Hosting)

Hostinger provides Node.js hosting through their hPanel. Follow these steps to configure:

### Step A: Initialize the Database
1. Log in to your Hostinger hPanel and navigate to **Databases** -> **MySQL Databases**.
2. Create a new database name, database user, and database password (save these credentials).
3. Open **phpMyAdmin** for the newly created database.
4. Go to the **Import** tab, upload the [db_setup.sql](file:///c:/Users/ASUS/Desktop/pgp/db_setup.sql) file from this project, and click **Go**. This initializes the tables, seeds default departments, and inserts the default super administrator (`admin` / `Admin@123`).

### Step B: Create a Node.js Application
1. In hPanel, search for **Node.js** and click on it.
2. Click **Create Application**.
3. Choose the Node.js version (Node 18 or 20 is recommended).
4. Set the **Application Document Root** (e.g. `public_html/pgp`).
5. Choose your entrypoint file: `server.js`.
6. Click **Save**.

### Step C: Upload Files and Set Environment
1. Use Hostinger's **File Manager** to upload your project directory files into the application root (e.g., `public_html/pgp`). Do NOT upload `node_modules/` or `scratch/node-portable/`.
2. Edit the `.env` file in the File Manager to reflect your production MySQL details:
   ```ini
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_hostinger_db_user
   DB_PASSWORD=your_hostinger_db_password
   DB_NAME=your_hostinger_db_name
   JWT_SECRET=MakeThisARandomStrongStringInProduction2026
   ```
3. In the Hostinger Node.js panel, click the **NPM Install** button to download dependencies.
4. Click **Start / Run** to boot the server.
5. Setup a domain/subdomain pointing to your Node.js application port using Hostinger's domain manager.

---

## 2. Deploying to Replit

Replit is an online IDE and hosting environment.

### Step A: Create a New Repl
1. Log in to Replit and click **+ Create Repl**.
2. Select the **Node.js** template.
3. Import your project files (you can upload a zip file of the project or drag and drop files directly, ignoring `node_modules` and `scratch/node-portable`).

### Step B: Configure Environment Secrets
1. In the Replit sidebar, open the **Secrets** tool (represented by a lock icon 🔒).
2. Add the following environment keys:
   * `PORT`: `3000`
   * `DB_HOST`: Your remote MySQL server host (e.g. Aiven, PlanetScale, or a VPS IP).
   * `DB_PORT`: `3306`
   * `DB_USER`: Remote database username.
   * `DB_PASSWORD`: Remote database password.
   * `DB_NAME`: Remote database name.
   * `JWT_SECRET`: Your production JWT secret string.

*(Note: Since Replit container environments do not run MySQL local services automatically, you can connect it to an external free cloud MySQL database like Aiven or PlanetScale, or modify config/db.js to run SQLite for mock testing).*

### Step C: Start the App
1. Click the green **Run** button at the top.
2. Replit will run `npm install` automatically and launch the Express server.
3. The web view panel will display the homepage. You can map a custom domain if desired.

---

## 3. Deploying to a Virtual Private Server (VPS - Ubuntu Linux)

Deploying on a VPS (like AWS EC2, DigitalOcean, Linode, or Vultr) gives you full control and maximum performance.

### Step A: Connect and Install Prerequisites
Connect to your VPS via SSH and install Node.js, NPM, and MySQL Server:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL Server
sudo apt install mysql-server -y
```

### Step B: Set Up MySQL
1. Log in to MySQL: `sudo mysql`
2. Create database and update credentials:
   ```sql
   CREATE DATABASE citizen_grievance_db;
   ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YourSecurePasswordHere';
   FLUSH PRIVILEGES;
   EXIT;
   ```
3. Import schema:
   ```bash
   mysql -u root -p citizen_grievance_db < db_setup.sql
   ```

### Step C: Setup Project & Run via PM2
PM2 is a process manager that keeps your application running 24/7 and restarts it if it crashes.
1. Upload your files to the server (e.g. into `/var/www/pgp/`).
2. Create and edit `.env` inside the folder with server details.
3. Install dependencies:
   ```bash
   cd /var/www/pgp
   npm install --production
   ```
4. Install and run PM2 globally:
   ```bash
   sudo npm install pm2 -g
   pm2 start server.js --name "grievance-system"
   pm2 startup
   pm2 save
   ```

### Step D: Setup Nginx Reverse Proxy with SSL (HTTPS)
1. Install Nginx: `sudo apt install nginx -y`
2. Create Nginx server configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/grievance
   ```
3. Paste configuration (change `yourdomain.com`):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
4. Enable site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/grievance /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```
5. Secure with SSL via Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   Follow the prompts to enable redirecting HTTP traffic to HTTPS. Your app is now live and secured!

---

## 📧 4. Email Notification Configuration (SMTP)

To enable live email notifications for citizen registration, grievance submissions, and status updates, you must configure SMTP details in your environment variables (`.env` or hosting provider control panel).

### Configurable Environment Variables:
```ini
SMTP_HOST=smtp.mailhost.com       # SMTP server hostname (e.g. mail.hostinger.com, smtp.gmail.com)
SMTP_PORT=587                     # SMTP port (typically 587 for TLS, 465 for SSL, or 25/2525)
SMTP_USER=your-email@domain.com   # SMTP username / login email address
SMTP_PASS=your-email-password     # SMTP password or App Password (if using Gmail App Passwords)
SMTP_FROM="Public Grievance System" <no-reply@domain.com> # Sender identity envelope
```

### Gmail Setup:
If using a personal Gmail account for notifications:
1. Log in to your Google Account and go to **Security** settings.
2. Enable **2-Step Verification**.
3. Under 2-Step Verification, select **App passwords**.
4. Generate a new App Password for "Mail" (custom name, e.g., `Grievance Portal`).
5. Copy the generated 16-character code and paste it as `SMTP_PASS` in your `.env`. Set `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587`.

### Fallback/Local Simulation Mode:
If `SMTP_USER` and `SMTP_PASS` are left empty, the application automatically runs in **simulation mode**. It will output all email text contents directly to the server terminal/console log instead of sending them. This prevents server crashes during local testing.
