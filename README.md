<div align="center">
  <img src="public/logo.png" width="120" height="120" alt="Universal Database Migrator Logo" />

  # ⚡ Universal Database Migrator

  **The Ultimate Open-Source Synchronization Engine for Modern Databases**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  
  <p><i>Effortlessly mirror schemas, data, and settings across PostgreSQL, MySQL, SQLite, and full Supabase instances in a single click.</i></p>

</div>

---

## 🚀 Why Universal Database Migrator?

Moving databases is historically painful, risky, and terminal-heavy. **Universal Database Migrator (UDM)** transforms this into a visual, one-click experience. 

Whether you're cloning a production database to staging, migrating away from a cloud provider, or doing daily local backups, UDM abstracts away the complexities of `pg_dump`, `mysqldump`, and cross-dialect mapping into a beautiful, self-hosted web interface.

> **Stop wrestling with CLI flags and connection strings.** Spin up UDM on your internal network, and give your entire DevOps team a safe, visual dashboard for all database operations.

## ✨ Features that Wow

- **🌐 Truly Universal:** First-class support for raw **PostgreSQL**, **MySQL**, **SQLite**, and **Supabase** environments.
- **🛡️ Intelligent Driver Engine:** Automatically detects the source/target database and maps it to the exact optimal system binary for the job.
- **📡 Real-Time Visual Terminal:** Watch the migration happen live in the browser. CLI outputs are streamed via Server-Sent Events (SSE) with aggressive, on-the-fly password redaction.
- **📦 Full-Stack Supabase Sync:** Moving between Supabase projects? We don't just move data. We sync **Auth Users**, **Storage Buckets**, and automatically deploy **Edge Functions**.
- **🎨 Premium UX/UI:** A sleek, glassmorphism-inspired dashboard built with Next.js, Tailwind CSS, and Radix UI. Migration shouldn't just be safe; it should look good.
- **🔒 Built for Self-Hosting:** Your data never leaves your infrastructure. Run UDM securely on your own servers behind your own VPN or proxy.

---

## 📸 See it in Action

*(Add a screenshot of your beautiful dashboard here! Save it as `public/screenshot.png`)*
<div align="center">
  <img src="public/screenshot.png" alt="UDM Dashboard" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" />
</div>

---

## 🛠️ Supported Engines & Requirements

UDM acts as a smart orchestrator for your host machine's native database tools. **Your host server must have the relevant clients installed.**

| Database System | Required Host Binaries | Connection Method |
| :--- | :--- | :--- |
| **PostgreSQL** | `pg_dump`, `psql` | Connection String |
| **MySQL** | `mysqldump`, `mysql` | Connection String |
| **SQLite** | `sqlite3` | Absolute File Path |
| **Supabase** | `pg_dump`, `psql`, Supabase CLI | Project Ref + PAT |

*Note: The app features a built-in "Dependency Checker" that will alert you in the UI if your host is missing any required tools.*

---

## 💻 Quick Start Guide

### 1. Prerequisites
Make sure your server environment has:
- **Node.js 18+**
- The native database clients you intend to use (e.g., `postgresql-client`, `mysql-client`).

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/Universal-Database-Migrator.git
cd universal-database-migrator

# Install dependencies
npm install

# Build the production bundle
npm run build

# Start the server
npm start
```

### 3. Exposing the Service
By default, the app runs on `http://localhost:3000`. It is highly recommended to place UDM behind a reverse proxy (like Nginx, Caddy, or Traefik) and secure it with Basic Auth or an SSO layer, as it has powerful access to your databases.

---

## 🏗️ Architecture Under the Hood

Universal Database Migrator is engineered for reliability and safety:

1. **Driver Interface (`IDatabaseDriver`)**: Every database type implements a strict contract for connection validation, extraction, and restoration.
2. **Spawned Subprocesses**: We use Node.js `child_process.spawn` to run native binaries, ensuring memory efficiency even for multi-gigabyte databases.
3. **Data Streaming**: `stdout`/`stderr` from the native tools are piped through a redaction layer to strip credentials before being pushed over SSE to the React frontend.
4. **Conditional Execution**: The engine intelligently skips non-applicable steps (like trying to sync Storage buckets between two raw MySQL databases).

---

## 🤝 Contributing

We want to make UDM the standard for open-source database operations. We welcome all PRs!

- **Found a bug?** Open an issue.
- **Want to add a driver?** (e.g., MongoDB, SQL Server) - Check out the source code to see how easy it is to implement the `IDatabaseDriver` interface.
- **UI improvements?** We love Tailwind wizards.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<div align="center">
  <br />
  <p>Maintained by <a href="https://dg10.agency">DG10.Agency</a> and the Open Source Community.</p>
</div>
