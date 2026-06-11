# Public Grievance Management System

A complete, professional, secure, and responsive Public Grievance Portal where citizens can register, lodge complaints, track grievance progress through a live history timeline, and receive notification feeds. Administrators can manage complaints, departments, compile Excel/PDF reports, and analyze data through an analytics dashboard.

---

## 🌐 Live Website Links
* **Citizen Portal (Live)**: [https://karrishanmukha087-hash.github.io/grievance-system](https://karrishanmukha087-hash.github.io/grievance-system)
* **Admin Portal (Live)**: [https://karrishanmukha087-hash.github.io/grievance-system/admin.html](https://karrishanmukha087-hash.github.io/grievance-system/admin.html)

### 🔑 Default Credentials
* **Admin Username/Email**: `admin` or `admin@grievanceportal.gov`
* **Admin Password**: `Admin@123`

---

## 🚀 Key Features

* **Citizen Dashboard**: Lodge grievances with file attachments (PDF/images), track timelines, and manage profile settings.
* **Notification Feed**: Real-time in-app alerts on status shifts.
* **Email Notifications**: Confirmation emails on registration, grievance lodging, and status updates (uses `nodemailer` with SMTP or local simulation fallback).
* **Admin Control Center**: KPI summary grids, real-time monthly trend and category graphs (Chart.js), filterable queue, and user account management.
* **Excel & PDF Reports**: Generate structured intervals summary (Daily, Weekly, Monthly, Yearly) client-side using SheetJS (`xlsx`) and `jspdf`.
* **Dark Mode Toggle**: Persistent theme settings (light/dark) using CSS variables and localStorage.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5
* **Backend**: Node.js, Express.js
* **Database**: MySQL (local/production) or SQLite (cloud deployment fallback)
* **Authentication**: JWT, bcrypt Password Hashing
* **File Upload**: Multer

---

## ⚙️ How it Works on GitHub Pages
This website is deployed directly to **GitHub Pages**. Since GitHub Pages only hosts static content, a mock API layer (`public/js/mockApi.js`) intercepts all backend requests and handles database storage, session management, and notifications fully in your browser via `localStorage`.

* **All features work live**: You can register users, submit grievances, track timelines, change priorities, and compile reports.
* **Persistent locally**: All changes you make (lodged complaints, user profiles, status changes) are saved inside your browser's `localStorage` and will persist across refreshes.

To run with a real backend and a SQL database locally:
1. Clone the repository and run `npm install`.
2. Start the local server using `npm start` or `node server.js`.
3. Open `http://localhost:3000` in your browser.
