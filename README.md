# INFINITY Total-Com Solutions Web App

## Overview

Full-stack web application for INFINITY Total-Com Solutions, built with **Node.js**, **Express**, **MongoDB**, and a responsive HTML/CSS frontend. It supports:

- Customer storefront (catalog, cart, checkout, order history)
- Multi-method checkout with **payment receipt upload** (Bank Transfer & InstaPay)
- Staff dashboard (inventory, orders with receipt review, customers, analytics, user management, **team management**)
- Role-based access for customers, technical staff, employees, managers, and primary admin
- Public **Our Team** page (dynamic roster from MongoDB) with company values
- **Cloudinary** image hosting for product photos, team photos, and payment receipts (with local fallbacks)
- MongoDB-backed users, products, team members, carts, orders, and sessions

> Payment processor implementation details are intentionally excluded from this README.

**Important:** Run the app with `npm start` and open **`http://localhost:3000`**. Opening HTML files directly or via Live Server will break API calls (cart, dashboard, products, team page, etc.).

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

| Role | Storefront | Staff dashboard | Edit inventory | Add / delete products | Manage Our Team | Business analytics | Create staff users |
|------|------------|-----------------|----------------|----------------------|-----------------|--------------------|------------------|
| `customer` | Yes | No | — | — | — | — | — |
| `technical` | Yes | Yes (view) | No | No | No | No | No |
| `employee` | Yes | Yes | Yes | No | No | No | No |
| `manager` | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `primary` | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

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
| `image` | Cloudinary URL, path under `assets/products/`, or external URL |
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
- **`payment.html`** — Checkout with multiple payment methods (see below)

### 6. Checkout & Payment (`payment.html`)

Customers choose a payment method, review the order summary (optional 14% VAT), and submit.

| Method | Flow |
|--------|------|
| **Visa Card** | Card form → `POST /api/process-payment` (mock processor in dev) |
| **Bank Transfer** | Copy CIB account details → pay → **upload receipt image** → submit order |
| **InstaPay** | Copy InstaPay number → pay → **upload receipt image** → submit order |
| **Cash on Delivery** | Submit order (status `pending`; pay on delivery) |

**Payment receipt upload (Bank Transfer & InstaPay):**

- Drag-and-drop or tap-to-upload zone with image preview
- Client-side compression before upload (JPEG, max ~1400px)
- **Required** before order submission for these methods
- Saved to **Cloudinary** (`payment-receipts/{orderId}`) when configured; URL stored in MongoDB (`paymentReceiptImage`)
- Falls back to `assets/orders/receipts/` locally only if Cloudinary env vars are missing (dev)

**Payment page UI:**

- Two-column desktop layout (methods left, details + summary right)
- Step pills for bank/InstaPay (copy → pay → upload receipt)
- Copy-to-clipboard buttons for account fields
- Sticky order summary, gradient submit button, inline success/error messages

### 7. Order Data Model

| Field | Description |
|-------|-------------|
| `userId` | Customer who placed the order |
| `transactionId` | Unique reference (`manual_*` or card transaction id) |
| `amount` / `currency` | Order total (EGP) |
| `orderItems` | Line items from cart |
| `paymentMethod` | `visa`, `bank`, `instapay`, or `cash` |
| `paymentReceiptImage` | Cloudinary URL (or local path) for uploaded receipt (bank / instapay only) |
| `status` | `pending`, `processing`, `completed`, `cancelled`, `failed` |
| `vatApplied` | Whether 14% VAT was included |
| Customer profile fields | Name, email, phone, company, billing address (visa), etc. |

### 8. Staff Dashboard (`dashboard.html`)

Tabbed interface for staff operations:

| Tab | Who sees it | Capabilities |
|-----|-------------|--------------|
| **Inventory** | technical, employee, manager, primary | View all products (including inactive). Edit price, install, stock inline. **Save All**. **Edit** opens full product modal. |
| **Add Product** | manager, primary | Create products with drag-and-drop image upload or image path, descriptions, categorized spec sections |
| **Our Team** | manager, primary | Add, edit, hide, or delete team members for the public Our Team page |
| **Orders** | all staff roles | List, search, filter by status, update status, export PDF, **view payment receipt** thumbnail |
| **Customers** | all staff roles | Customer profiles and contact info |
| **Analytics** | **manager, primary only** | Business analytics: KPIs, charts (revenue, top items, status, payment methods, top customers), date range |
| **User Management** | all staff roles | List users; create (manager/primary); delete with role rules |

**Inventory actions (manager / primary):**

- **Edit** — Modal with product details, image upload/path, descriptions, and spec sections (separate English / Arabic fields per line)
- **Delete** — Permanent removal from database and website (custom confirmation dialog)
- **Active on website = No** — Hides from Our Products only; product stays in inventory for editing

**Inventory actions (employee):**

- Inline stock/price/install edits, **Edit** modal, **Save All** (no add/delete product)

**Our Team tab (manager / primary):**

- Grouped form: **Profile**, **Display options**, **Photo**, **Bio**
- Category chips (Leadership, Technical, Employees, Operations, Sales)
- Drag-and-drop photo upload or path (e.g. `assets/images/team/name.jpg`)
- **Team roster** table with search, member count, edit/hide/delete
- **Hide** removes from public page; **Delete** removes permanently from DB
- Mobile-friendly: stacked form, card-style roster rows, full-width actions

**Orders — payment receipts:**

- For bank transfer and InstaPay orders, staff see a **Payment receipt** block with thumbnail and link to open full size
- Helps verify customer payments before marking orders `processing` or `completed`

**UI/UX on dashboard:**

- Custom confirm/alert dialogs (no browser `confirm()` popups)
- Toast notifications for save/delete feedback
- Mobile-friendly tables (card layout on phones/tablets) and analytics layout
- **Guide** button — role-based how-to articles plus **separate interactive tours** per section (Inventory, Add Product, Our Team, Orders, Customers, Analytics, Users)
- Interactive tours **move the tooltip next to each control** and **auto-scroll** the page so the highlighted area stays visible; you can still scroll manually anytime
- Preferences saved per user in the browser (`localStorage` key prefix `infinity-dash-pref:v1:{userId}`): “don’t show welcome again” and optional tour completion

### 9. Business Analytics

Available only to **manager** and **primary** roles:

- KPIs: total revenue, order count, average order, customer count
- Charts: top selling items, order status (bar + donut), revenue over time, payment methods, top customers
- Range: last 7 / 30 / 90 days, all time, or custom dates

### 10. Our Team Page (`team.html`)

Public page loaded from MongoDB via `GET /api/team/public`:

- **Hero** with company intro and live member count
- **Category sections** — Leadership, Technical Team, Employees, Operations, Sales & Support (empty categories are hidden)
- Member cards: photo, job title, bio, skill tags, optional featured highlight and badge
- **Our Team Values** — six value cards (Creativity, Team Work, Collaboration, Compassion, Passion, Happiness)
- **Contact CTA** linking to home contact section
- Responsive spacing and card layout on mobile (values: 2 per row on phones)
- Scroll-reveal animations applied after dynamic load (members fetched from API)

**Default seed members** (created on server startup if missing):

| Member | Category | Role |
|--------|----------|------|
| Mohamed Zidan | Leadership | Managing Director |
| Mazen Mahmoud Mohamed | Technical | Communication & Computer Engineer (featured) |

### 11. Team Member Data Model

Each team member in MongoDB includes:

| Field | Description |
|-------|-------------|
| `memberId` | Unique slug (auto-generated from name if omitted) |
| `name` | Full display name |
| `positionTitle` | Job title on the card |
| `bio` | Short introduction |
| `category` | `leadership`, `technical`, `employees`, `operations`, or `sales` |
| `skills` | Array of skill tag strings |
| `image` | Cloudinary URL or path under `assets/images/team/` |
| `badge` | Optional label (e.g. “Platform builder”) |
| `featured` | Highlight card styling when `true` |
| `sortOrder` | Display order within category (lower first) |
| `active` | `true` = on public page; `false` = hidden |

### 12. General UI/UX

- Responsive layout (`mazen.css`), mobile nav, lazy-loaded images
- Scroll reveal animations on marketing pages (modals excluded; team cards bound after API load)
- Enhanced contact footer on key pages (phone, email, address EN/AR, Google Maps link)
- Accessible forms and keyboard support (Escape closes edit modals / dialogs)

---

## Application Pages

| Page | Purpose |
|------|---------|
| `index.html` | Home / landing (services, clients, contact + map) |
| `products.html` | Product catalog (Our Products) |
| `product-details.html` | Product specifications (`?id=`) |
| `auth.html` | Sign in / sign up |
| `complete-profile.html` | Finish profile after registration |
| `user-dashboard.html` | Customer order history |
| `dashboard.html` | Staff dashboard |
| `payment.html` | Checkout (Visa, Bank Transfer, InstaPay, COD + receipt upload) |
| `order-success.html` | Order confirmation |
| `team.html` | Our Team (dynamic roster + values) |
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

### Products, Team & Cart (Storefront)

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/products/public` | Public | Active products catalog |
| GET | `/api/products/public/:productId` | Public | Single active product (incl. specs) |
| GET | `/api/team/public` | Public | Active team members grouped by category |
| GET | `/api/cart` | Auth | Get cart |
| PUT | `/api/cart` | Auth | Update cart |
| DELETE | `/api/cart` | Auth | Clear cart |

### Orders

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/orders` | Auth | Create order (bank / instapay / cash). Body: `paymentMethod`, `amount`, `currency`, `orderItems`, `vatApplied`, **`paymentReceiptData`** (base64 image, required for `bank` and `instapay`) |
| POST | `/api/process-payment` | Auth | Process Visa card payment (checkout) |
| GET | `/api/orders/me` | Auth | My orders |
| GET | `/api/orders/:id` | Auth | Order details |
| GET | `/api/orders/:id/pdf` | Auth | Order PDF |
| PATCH | `/api/orders/:id` | Auth | Update order |
| DELETE | `/api/orders/:id` | Auth | Delete order |

### Staff Dashboard

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/dashboard/products` | technical, employee, manager, primary | All products |
| POST | `/api/dashboard/products` | manager, primary | Create product (`image`, `imageData` base64 upload) |
| PATCH | `/api/dashboard/products/:productId/stock` | employee, manager, primary | Update stock, price, names, specs, image, active, etc. |
| DELETE | `/api/dashboard/products/:productId` | manager, primary | `?permanent=1` removes from DB; without it, soft-hides (`active: false`). Dashboard delete uses permanent by default |
| GET | `/api/dashboard/orders` | staff | Orders list (includes `paymentReceiptImage` when set) |
| PATCH | `/api/dashboard/orders/:id/status` | employee, manager, primary | Update status |
| GET | `/api/dashboard/orders/:id/pdf` | staff | Order PDF |
| GET | `/api/dashboard/customers` | staff | Customers |
| GET | `/api/dashboard/users` | staff | Staff users |
| POST | `/api/dashboard/users` | manager, primary | Create staff user |
| DELETE | `/api/dashboard/users/:id` | employee, manager, primary | Delete user (role rules apply) |
| GET | `/api/dashboard/team` | manager, primary | All team members (incl. hidden) |
| POST | `/api/dashboard/team` | manager, primary | Create team member (`image`, `imageData`) |
| PATCH | `/api/dashboard/team/:memberId` | manager, primary | Update member |
| DELETE | `/api/dashboard/team/:memberId` | manager, primary | Hide (`active: false`); `?permanent=1` removes from DB |

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
5. Go to **`payment.html`**, select a payment method
6. For **Bank Transfer** or **InstaPay**: copy details, complete payment, **upload your receipt screenshot**, then submit
7. View orders on **`user-dashboard.html`**

### As Staff / Admin

1. Sign in with a staff email (see `.env` role lists)
2. Open **`http://localhost:3000/dashboard.html`**
3. Use **Inventory** to edit or (manager/primary) add/delete products
4. Use **Orders** to review orders, **open payment receipts** for bank/InstaPay, and update status
5. Use **Customers** for customer profiles
6. **Manager / primary:** use **Analytics** for business reports
7. **Manager / primary:** use **User Management** to add staff accounts
8. **Manager / primary:** use **Our Team** to manage the public team page

### Adding a Product (Manager / Primary)

1. Dashboard → **Add Product**
2. Fill English/Arabic names, category, price, installation, stock
3. Upload an image (saved to Cloudinary when configured) **or** set path `assets/products/your-file.png` without uploading
4. Add **Specification sections** with a title and English / Arabic lines
5. Submit — product appears on **Our Products** when **Active** is Yes

### Adding a Team Member (Manager / Primary)

1. Dashboard → **Our Team**
2. Fill **Profile**: name, job title, category, optional skills
3. Set **Display options**: sort order, featured flag, optional badge
4. Upload a photo **or** enter path `assets/images/team/your-file.jpg`
5. Add a short **Bio**
6. Click **Add Team Member** — member appears on **`team.html`** when **Visible** is Yes
7. Use **Team roster** to **Edit**, **Hide**, or **Delete** existing members

---

## Backend Architecture

- **Express** server with `compression`, `cors`, JSON body parser (12MB limit for image uploads)
- Static files from project root; HTML served with no-cache headers
- **Mongoose** models: User, Product, **TeamMember**, Cart, Order, Session (MongoStore)
- **Passport** + **bcrypt** for OAuth and passwords
- **PDFKit** for order PDFs
- **Cloudinary** (via `cloudinary.js`) when `CLOUDINARY_*` env vars are set:

| Asset | Cloudinary folder | Local fallback |
|-------|-------------------|----------------|
| Product images | `products/{productId}` | `assets/products/` |
| Team photos | `team/{memberId}` | `assets/images/team/` |
| Payment receipts | `payment-receipts/{orderId}` | `assets/orders/receipts/` |

- Upload wins over image path when both are provided on create/edit
- Default products and team members are **seeded on server startup** if missing

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

After code changes that add models or routes, **restart the server** so seeds and new endpoints load.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

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
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (products, team, receipts) |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `STRIPE_API_KEY_BASE64` | Optional payment config |

---

## File Structure

| Path | Role |
|------|------|
| `server.js` | API, auth, models, product/team CRUD, orders, image storage |
| `cloudinary.js` | Cloudinary SDK config |
| `dashboard.html` | Staff dashboard (inventory, team, orders, analytics, users) |
| `products.html` | Storefront catalog + cart |
| `product-details.html` | Product specs page |
| `payment.html` | Checkout + receipt upload |
| `team.html` | Our Team page (API-driven roster) |
| `auth.html` | Login / register |
| `user-dashboard.html` | Customer orders |
| `script.js` | Shared frontend helpers, scroll reveal, cart |
| `mazen.css` | Global + team + contact styles |
| `assets/products/` | Product images (local fallback) |
| `assets/images/team/` | Team photos (local fallback) + SVG placeholders |
| `assets/orders/receipts/` | Receipt fallback (when Cloudinary not configured) |
| `package.json` | Dependencies and `npm start` |

---

## Dependencies

- `express`, `mongoose`, `bcrypt`, `body-parser`, `compression`, `cors`, `dotenv`
- `express-session`, `connect-mongo`
- `passport`, `passport-google-oauth20`, `passport-facebook`
- `pdfkit`
- `cloudinary`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API / cart / dashboard / team not working | Use `npm start` and `http://localhost:3000`, not Live Server or `file://` |
| Our Team page empty or “Could not load team” | Restart server (`npm start`); open `http://localhost:3000/team.html`; hard refresh (`Ctrl+F5`) |
| Team members in dashboard but not on website | Check **Visible = Yes** in roster; hidden members have `active: false` |
| Team cards invisible on page | Hard refresh — scroll-reveal runs after API load; ensure latest `script.js` |
| “Failed to add product” / team member | Restart server; confirm manager/primary role; check image size (max ~15 MB) |
| Edit modal empty | Hard refresh (`Ctrl+F5`) — fade-in animation conflict was fixed |
| Product hidden after Active = No | Expected on website; still visible in staff Inventory |
| Analytics / Our Team tab missing | Only **manager** and **primary** see those tabs |
| “Receipt required” on checkout | Select Bank Transfer or InstaPay and upload an image before Submit |
| Receipt not visible in dashboard | Confirm bank/instapay order; check `paymentReceiptImage` in DB; verify Cloudinary env vars |
| Cloudinary upload fails | Verify `CLOUDINARY_*` in `.env`; restart server; check Cloudinary dashboard quotas |
| Team / product photo not showing | Confirm URL in DB; for local paths use `assets/images/team/...` or `assets/products/...`; SVG placeholder used on error |

---

## Contact

For deployment or environment setup, configure `.env` and contact the repository maintainer.
