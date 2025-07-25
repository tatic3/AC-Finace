# AC Finance Microfinance Platform

Welcome to **AC Finance**, a comprehensive microfinance platform built with React (frontend) and Flask (backend). This repository contains both **Investor** and **Admin** interfaces, allowing users to invest, apply for loans, repay, withdraw, and manage their profiles, while administrators handle approvals, reviews, and reporting.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)

   * [Prerequisites](#prerequisites)
   * [Installation](#installation)
   * [Environment Variables](#environment-variables)
4. [Folder Structure](#folder-structure)
5. [Available Scripts](#available-scripts)
6. [Usage](#usage)

   * [Admin Login](#admin-login)
   * [Investor Login](#investor-login)
7. [API Endpoints](#api-endpoints)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [License](#license)

---

## Features

* **Investor Portal**

  * Secure login (debounced)
  * Dashboard: view investments, loans, repayments, withdrawals
  * Apply for investments and loans
  * Upload proofs (payments, documents)
  * Real-time notifications

* **Admin Portal**

  * Secure JWT-based login
  * Approve/reject investors, investments, loans, repayments, withdrawals
  * Bulk actions and debounced search
  * Export CSV reports
  * Dashboard analytics (charts, stats)

* **Shared**

  * Responsive, modern UI with Tailwind CSS
  * Global authentication context
  * Centralized API client (`axios`)
  * Notification toasts
  * Role-based navigation

---

## Tech Stack

* **Frontend**: React, React Router, Tailwind CSS, Lucide Icons, React Toastify
* **Backend**: Python, Flask, Flask-RESTful, SQLAlchemy
* **Authentication**: JWT (admin & investor routes)
* **Database**: PostgreSQL (or MySQL)
* **Build Tools**: Vite (frontend), pipenv or virtualenv (backend)

---

## Getting Started

### Prerequisites

* Node.js >= 16.x
* npm or yarn
* Python >= 3.9
* pipenv or virtualenv
* PostgreSQL or MySQL server

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/<your-username>/ac-finance.git
   cd ac-finance
   ```
2. **Setup Backend**

   ```bash
   cd backend
   pipenv install   # or python -m venv venv && pip install -r requirements.txt
   pipenv shell
   flask db upgrade
   flask run
   ```
3. **Setup Frontend**

   ```bash
   cd frontend
   npm install     # or yarn
   npm run dev     # or yarn dev
   ```

### Environment Variables

Create a `.env` file in both `backend/` and `frontend/` with the following:

#### Backend `.env`

```
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/yourdb
JWT_SECRET_KEY=your_jwt_secret
MAIL_SERVER=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=you@example.com
MAIL_PASSWORD=mailpassword
```

#### Frontend `.env`

```
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Folder Structure

```
ac-finance/
├── backend/                # Flask API
│   ├── app.py
│   ├── models.py
│   ├── routes/            # Investment, loan, auth, notifications...
│   └── requirements.txt
├── frontend/               # React app
│   ├── src/
│   │   ├── Pages/
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── InvestorLogin.jsx
│   │   │   ├── InvestorLayout.jsx
│   │   │   └── ...
│   │   ├── hooks/          # AuthContext, useRequireAuth
│   │   ├── api/            # axios instance
│   │   ├── components/     # common UI elements
│   │   └── App.jsx
│   └── package.json
└── README.md
```

---

## Available Scripts

In the `frontend/` directory:

* `npm run dev`: Start development server
* `npm run build`: Create production build
* `npm run preview`: Preview production build

In the `backend/` directory:

* `flask run`: Launch Flask development server
* `flask db migrate`: Create a new database migration
* `flask db upgrade`: Apply migrations

---

## Usage

### Admin Login

1. Navigate to `/admin/login`.
2. Enter your admin email and password.
3. Access the dashboard to manage investors, loans, and reports.

### Investor Login

1. Navigate to `/investor/login`.
2. Enter your email or username and password.
3. Access your investor dashboard to view investments, apply for loans, and manage payments.

---

## API Endpoints

| Method | Endpoint                      | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| POST   | `/api/auth/login`             | Authenticate and return JWT  |
| GET    | `/api/investor/notifications` | List investor notifications  |
| POST   | `/api/invest/investments`     | Create new investment        |
| POST   | `/api/invest/loans`           | Apply for a loan             |
| POST   | `/api/invest/repayments`      | Upload repayment proof       |
| POST   | `/api/invest/withdrawals`     | Request a withdrawal         |
| PUT    | `/api/admin/investments/:id`  | Approve or reject investment |
| PUT    | `/api/admin/loans/:id`        | Approve or reject loan       |
| GET    | `/api/admin/export`           | Export CSV reports           |

Refer to code comments and docstrings for detailed usage.

---

## Deployment

1. Build the frontend:

   ```bash
   cd frontend
   npm run build
   ```
2. Serve static files (e.g., with Nginx) and reverse-proxy `/api` to your Flask backend.
3. Configure environment variables in production.
4. Restart services.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repo.
2. Create a new branch: `git checkout -b feature/YourFeature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Open a Pull Request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
