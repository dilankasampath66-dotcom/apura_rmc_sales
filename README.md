# 🏗️ Ready Mix Concrete (RMC) Regional Plant Sales & Delivery Estimator

An Enterprise Ready Mix Concrete (RMC) Sales Management, Quotation Generator, Delivery Dispatch Log, and CRM Pipeline Platform. Built with Vanilla JavaScript, Tailwind CSS, LocalStorage Offline Cache, and Live Firebase Realtime Cloud Synchronization.

---

## 🌟 Key Features

1. **🔒 Secure User Login & Session Enforcement**:
   - Authentication modal with forced auto-logout on page refresh.
   - Role-Based Access Control (RBAC): **Admin**, **Plant Manager**, and **Sales Engineer**.
2. **📋 Sales Visit Management**:
   - Record site visits with 10-digit telephone primary keys (`contact`), location, grade, volume, and notes.
3. **🎯 Interactive CRM Kanban Pipeline**:
   - Drag-and-drop opportunity cards across 5 stages (*Lead ➔ Quote ➔ Negotiation ➔ Won ➔ Lost*).
   - AI-driven closing probability & value estimation engine.
4. **🧾 Regional Cost Estimator & Quotation Engine**:
   - Dynamic price calculation implementing exact transport and pump formulas.
   - Hardware thermal receipt generation (80mm) & PDF export.
   - WhatsApp 1-click sharing.
5. **🏢 Customer-Specific Custom Pricing & Discount Rules**:
   - Configure special discounts (LKR/m³), custom free transport KM allowances, and pump rates for VIP accounts (e.g., MAGA Engineering, Sanken Overseas).
6. **🚚 Concrete Supply Orders & Dispatch Delivery Logs**:
   - Track order fulfillment progress, dockets, truck mixer assignments, and delivered volumes.
7. **🗄️ Master Database Control Panel & Explorer**:
   - Inspect, multi-field search, direct row editing, single deletion, collection clearing, and Excel (`.xlsx`) exporting across all 9 system collections.
8. **🔥 Firebase Realtime Cloud Sync**:
   - Multi-user live cloud database synchronization with seamless offline LocalStorage fallback protection.
9. **📱 iPhone 15 & Redmi 13C Mobile Optimized**:
   - Touch-first responsive interface with mobile navigation bar, slide-out drawer, and mobile swipe Kanban columns.

---

## 🚀 How to Run Locally

Since this is a client-side web application built with Vanilla JS, no build step or node_modules installation is required!

1. **Option A: Direct Browser File**:
   - Open [`index.html`](file:///Users/dilankasgunasingha/Desktop/TMX%20RMC/index.html) directly in any web browser (Chrome, Safari, Edge, Firefox).

2. **Option B: Local HTTP Dev Server**:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Or using Node.js npx live-server
   npx live-server
   ```
   Access in browser at `http://localhost:8000`.

---

## 🌐 How to Deploy Live on GitHub Pages

1. **Initialize Git Repository & Commit Code**:
   ```bash
   git init
   git add .
   git commit -m "Deploy Ready Mix Concrete RMC Sales System"
   ```

2. **Push to GitHub Repository**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your GitHub Repository **Settings** ➔ **Pages**.
   - Under **Build and deployment** ➔ **Branch**: Select `main` branch and `/ (root)` folder.
   - Click **Save**.
   - Your live site will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`!

---

## 🔥 How to Connect Firebase Realtime Database

1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Under project settings, register a Web App and create a **Realtime Database**.
3. In Realtime Database Rules, set read/write permissions:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Open the application, click **`Cloud Sync`** in the top navigation bar, and enter your:
   - **Database URL** (`https://your-project-default-rtdb.firebaseio.com`)
   - **API Key** (`AIzaSy...`)
   - **Project ID** (`your-project-id`)
5. Click **Connect & Sync Firebase**. The badge will change to **`🟢 Firebase Cloud`** and all data will sync live across all logged-in devices!

---

## 🔑 Default Demo Accounts

| Role | Username | Security PIN | Access Level |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `1234` | Full System & DB Administration |
| **Plant Manager** | `manager` | `1234` | DB Control, Pricing Rules, User Management |
| **Sales Officer** | `sunil` | `1234` | Sales Visits, CRM Pipeline, Quotations, Orders |

---

© 2026 Ready Mix Concrete (RMC) Regional Sales Platform. All rights reserved.
