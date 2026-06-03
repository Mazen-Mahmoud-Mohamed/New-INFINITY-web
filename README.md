# INFINITY Total-Com Solutions Web App

## Overview

Full-stack web application for INFINITY Total-Com Solutions, built with **Node.js**, **Express**, **MongoDB**, and a responsive HTML/CSS frontend. It supports:

- Customer storefront (catalog, cart, checkout, order history)
- Staff dashboard (inventory, orders, customers, analytics, user management)
- Role-based access for customers, technical staff, employees, managers, and primary admin
- MongoDB-backed users, products, carts, orders, and sessions

> Payment processor implementation details are intentionally excluded from this README.

**Important:** Run the app with `npm start` and open **`http://localhost:3000`**. Opening HTML files directly or via Live Server will break API calls (cart, dashboard, product management).

---

## Key Features

### 1. Authentication & Account Flow

- Local email/password sign-up and sign-in (`auth.html`)
- OAuth support for Google and Facebook when configured
- Complete-profile flow (`complete-profile.html`) for phone and password
- Session-based login (`express-session` + `connect-mongo`)
- Automatic role assignment from environment email lists
- Password visibility toggle on sign-in / sign-up (icon matches field state)
- Legal pages: `terms.html`, `privacy.html`, `delete-account.html`

### 2. Role-Based Access

| Role | Storefront | Staff dashboard | Edit inventory | Add / delete products | Business analytics | Create staff users |
|------|------------|-----------------|----------------|----------------------|--------------------|------------------|
| `customer` | Yes | No | — | — | — | — |
| `technical` | Yes | Yes (view) | No | No | No | No |
| `employee` | Yes | Yes | Yes | No | No | No |
| `manager` | Yes | Yes | Yes | Yes | Yes | Yes |
| `primary` | Yes | Yes | Yes | Yes | Yes | Yes |

- Route guards on API endpoints enforce these rules server-side.
- Customers see only their own orders; staff see broader order and customer data.

### 3. Product Catalog & Product Details

- **`products.html`** — Our Products page with category filters, search, and cart sidebar
- Static seed products plus **dynamic products** loaded from the API (manager-added items appear automatically)
- Live **price**, **stock**, and **installation** from the database
- Out-of-stock badges and disabled add-to-cart when stock is 0
- Inactive products (`active: false`) are hidden on the storefront but remain in staff inventory
- **`product-details.html`** — Dedicated specs page per product (`?id=productId`)
  - Bilingual specifications grouped into titled sections (e.g. general features, technical features, services)
  - Click-through from catalog cards

### 4. Product Data Model

Each product in MongoDB includes:

| Field | Description |
|-------|-------------|
| `productId` | Unique slug (auto-generated from name if omitted) |
| `name` / `nameAr` | English and Arabic display names |
| `price` / `installation` | EGP amounts |
| `stock` | Quantity available |
| `image` | Path under `assets/products/` or uploaded file |
| `descriptionEn` / `descriptionAr` | Short catalog descriptions |
| `category` | `gps`, `cctv`, or `sensors` |
| `specSections` | Array of `{ title, items: [{ en, ar }] }` for the details page |
| `active` | `true` = visible on website; `false` = hidden from customers only |

Default products (`fmb120`, `cut-off`, `door-sensor`, `driver-button`) are seeded on startup if missing (existing DB values are not overwritten).

### 5. Shopping Cart & Orders

- Cart persisted per logged-in user (`GET` / `PUT` / `DELETE /api/cart`)
- Bilingual product names in cart when available
- Stock reserved when orders are created
- **`user-dashboard.html`** — Customer order history, filters, PDF invoices
- **`order-success.html`** — Post-checkout confirmation
- **`payment.html`** — Checkout flow (general; no processor specifics in docs)

### 6. Staff Dashboard (`dashboard.html`)

Tabbed interface for staff operations:

| Tab | Who sees it | Capabilities |
|-----|-------------|--------------|
| **Inventory** | technical, employee, manager, primary | View all products (including inactive). Edit price, install, stock inline. **Save All**. **Edit** opens full product modal. |
| **Add Product** | manager, primary | Create products with image upload/path, descriptions, categorized spec sections |
| **Orders** | all staff roles | List, filter, update status, export PDF |
| **Customers** | all staff roles | Customer profiles and contact info |
| **Analytics** | **manager, primary only** | Business analytics: KPIs, charts (revenue, top items, status, payment methods, top customers), date range |
| **User Management** | all staff roles | List users; create (manager/primary); delete with role rules |

**Inventory actions (manager / primary):**

- **Edit** — Modal with product details, image, descriptions, and spec sections (separate English / Arabic fields per line)
- **Delete** — Permanent removal from database and website (custom confirmation dialog)
- **Active on website = No** — Hides from Our Products only; product stays in inventory for editing

**Inventory actions (employee):**

- Inline stock/price/install edits, **Edit** modal, **Save All** (no add/delete product)

**UI/UX on dashboard:**

- Custom confirm/alert dialogs (no browser `confirm()` popups)
- Toast notifications for save/delete feedback
- Mobile-friendly tables and analytics layout

### 7. Business Analytics

Available only to **manager** and **primary** roles:

- KPIs: total revenue, order count, average order, customer count
- Charts: top selling items, order status (bar + donut), revenue over time, payment methods, top customers
- Range: last 7 / 30 / 90 days, all time, or custom dates

### 8. General UI/UX

- Responsive layout (`mazen.css`), mobile nav, lazy-loaded images
- Scroll reveal animations on marketing pages (modals excluded)
- Accessible forms and keyboard support (Escape closes edit modal / dialogs)

---

## Application Pages

| Page | Purpose |
|------|---------|
| `index.html` | Home / landing |
| `products.html` | Product catalog (Our Products) |
| `product-details.html` | Product specifications (`?id=`) |
| `auth.html` | Sign in / sign up |
| `complete-profile.html` | Finish profile after registration |
| `user-dashboard.html` | Customer order history |
| `dashboard.html` | Staff dashboard |
| `payment.html` | Checkout |
| `order-success.html` | Order confirmation |
| `team.html` | Team page |
| `terms.html` | Terms of service |
| `privacy.html` | Privacy policy |
| `delete-account.html` | Account deletion info |
| `test-payment.html` | Payment testing (dev) |

---

## API Endpoints

### Authentication & User

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/register` | Public | Register |
| POST | `/api/login` | Public | Sign in |
| POST | `/api/logout` | Session | Sign out |
| GET | `/api/user` | Session | Current user + profile status |
| POST | `/api/profile/complete` | Auth | Complete profile |

OAuth: `/auth/google`, `/auth/facebook` (+ callbacks) when configured.

### Products & Cart (Storefront)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/products/public` | Public | Active products catalog |
| GET | `/api/products/public/:productId` | Public | Single active product (incl. specs) |
| GET | `/api/cart` | Auth | Get cart |
| PUT | `/api/cart` | Auth | Update cart |
| DELETE | `/api/cart` | Auth | Clear cart |

### Orders

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/orders` | Auth | Create order |
| POST | `/api/process-payment` | Auth | Process payment (checkout) |
| GET | `/api/orders/me` | Auth | My orders |
| GET | `/api/orders/:id` | Auth | Order details |
| GET | `/api/orders/:id/pdf` | Auth | Order PDF |
| PATCH | `/api/orders/:id` | Auth | Update order |
| DELETE | `/api/orders/:id` | Auth | Delete order |

### Staff Dashboard

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/dashboard/products` | technical, employee, manager, primary | All products |
| POST | `/api/dashboard/products` | manager, primary | Create product |
| PATCH | `/api/dashboard/products/:productId/stock` | employee, manager, primary | Update stock, price, names, specs, image, active, etc. |
| DELETE | `/api/dashboard/products/:productId` | manager, primary | `?permanent=1` removes from DB; without it, soft-hides (`active: false`). Dashboard delete uses permanent by default |
| GET | `/api/dashboard/orders` | staff | Orders list |
| PATCH | `/api/dashboard/orders/:id/status` | employee, manager, primary | Update status |
| GET | `/api/dashboard/orders/:id/pdf` | staff | Order PDF |
| GET | `/api/dashboard/customers` | staff | Customers |
| GET | `/api/dashboard/users` | staff | Staff users |
| POST | `/api/dashboard/users` | manager, primary | Create staff user |
| DELETE | `/api/dashboard/users/:id` | employee, manager, primary | Delete user (role rules apply) |

---

## User Creation & Deletion Rules

- Only **manager** and **primary** may create staff users.
- Delete rules:
  - **primary** — may delete any user except self
  - **manager** — may not delete **primary**
  - **employee** — may not delete **primary** or **manager**
- No self-delete via dashboard delete endpoint.

---

## How to Use

### As a Customer

1. Browse **`http://localhost:3000/products.html`**
2. Open a product for full specifications
3. Add to cart (sign in to persist cart)
4. Complete profile if prompted
5. Checkout via **`payment.html`**
6. View orders on **`user-dashboard.html`**

### As Staff / Admin

1. Sign in with a staff email (see `.env` role lists)
2. Open **`http://localhost:3000/dashboard.html`**
3. Use **Inventory** to edit or (manager/primary) add/delete products
4. Use **Orders** / **Customers** for operations
5. **Manager / primary:** use **Analytics** for business reports
6. **Manager / primary:** use **User Management** to add staff accounts

### Adding a Product (Manager / Primary)

1. Dashboard → **Add Product**
2. Fill English/Arabic names, category, price, installation, stock
3. Upload an image or set path `assets/products/your-file.png`
4. Add **Specification sections** with a title and English / Arabic lines
5. Submit — product appears on **Our Products** when **Active** is Yes

---

## Backend Architecture

- **Express** server with `compression`, `cors`, JSON body parser (12MB limit for image uploads)
- Static files from project root; HTML served with no-cache headers
- **Mongoose** models: User, Product, Cart, Order, Session (MongoStore)
- **Passport** + **bcrypt** for OAuth and passwords
- **PDFKit** for order PDFs
- Product images saved to `assets/products/` when uploaded as base64 from the dashboard

---

## Setup & Run

### Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)
- `.env` file (see below)

### Install

```bash
npm install
```

### Run

```bash
npm start
```

Open:

```text
http://localhost:3000/
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (**required**) |
| `SESSION_SECRET` | Session cookie secret |
| `APP_BASE_URL` | Base URL for OAuth callbacks (e.g. `http://localhost:3000`) |
| `PRIMARY_ADMIN_EMAIL` | Primary admin email |
| `PRIMARY_ADMIN_PASSWORD` | Primary admin password |
| `MANAGER_EMAILS` | Comma-separated manager emails |
| `EMPLOYEE_EMAILS` | Comma-separated employee emails |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Optional Facebook OAuth |
| `STRIPE_API_KEY_BASE64` | Optional payment config |

---

## File Structure

| Path | Role |
|------|------|
| `server.js` | API, auth, models, product CRUD, orders |
| `dashboard.html` | Staff dashboard (inventory, analytics, users) |
| `products.html` | Storefront catalog + cart |
| `product-details.html` | Product specs page |
| `auth.html` | Login / register |
| `user-dashboard.html` | Customer orders |
| `script.js` | Shared frontend helpers, animations |
| `mazen.css` | Global styles |
| `assets/products/` | Product images |
| `package.json` | Dependencies and `npm start` |

---

## Dependencies

- `express`, `mongoose`, `bcrypt`, `body-parser`, `compression`, `cors`, `dotenv`
- `express-session`, `connect-mongo`
- `passport`, `passport-google-oauth20`, `passport-facebook`
- `pdfkit`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API / cart / dashboard not working | Use `npm start` and `http://localhost:3000`, not Live Server |
| “Failed to add product” | Restart server after code changes; check manager/primary role |
| Edit modal empty | Hard refresh (`Ctrl+F5`) — fade-in animation conflict was fixed |
| Product hidden after Active = No | Expected on website; still visible in staff Inventory |
| Analytics tab missing | Only **manager** and **primary** see Business Analytics |

---

## Contact

For deployment or environment setup, configure `.env` and contact the repository maintainer.
