# INFINITY Total-Com Solutions Web App

## Overview
This web application is a full-stack site built with Node.js, Express, MongoDB, and a responsive UI. It includes:
- User authentication and account management
- Role-based access for customers, technical staff, employees, managers, and a primary admin
- Product catalog with stock tracking
- Persistent shopping cart and order history
- Dashboard tools for staff and administrators
- Database-backed storage of users, carts, orders, products, and sessions
- Responsive UI/UX for desktop and mobile
- General payment support for checkout and order confirmation

> Payment implementation details are intentionally excluded from this README.

## Key Features

### 1. Authentication & Account Flow
- Local email/password sign-up and sign-in
- OAuth support for Google and Facebook when configured
- Complete-profile flow requiring phone number and password setup before continuing
- Session-based login using `express-session` and `connect-mongo`
- Automatic role assignment based on configured email lists
- Logout endpoint and session invalidation

### 2. Role-Based Access & Security
- User roles: `customer`, `technical`, `employee`, `manager`, `primary`
- Role mapping from environment variables for admin and staff users
- Protected routes for authenticated users only
- Route guards that validate roles before returning staff or order data
- Staff dashboard access for non-customer accounts
- Access control for order details: users can view their own orders; staff can view broader order data

### 3. User Experience & UI/UX
- Responsive layout with modern branding and accessible forms
- Lightweight scroll progress and reveal animations
- Mobile-friendly navigation menu and adaptive hero sections
- Fast page load performance with lazy-loading images and optimized interactions
- Clear form validation, inline feedback, and animated transitions
- Accessible menu toggle and keyboard-friendly controls

### 4. Product & Storefront Experience
- Product catalog loaded from the database
- Stock and active state tracked for each product
- Cart persistence per user account
- Add, update, and remove cart items through API endpoints
- Automatic reservation of stock during order creation

### 5. Payment & Checkout Support
- General checkout flow for converting cart contents into orders
- Support for payment validation, order confirmation, and receipts
- Payment page available to authenticated customers when ready to checkout
- Order status is updated as checkout progresses
- General payment integration is supported without exposing specific card processors

### 6. Order Management
- Manual order creation endpoint for non-card payment methods
- Order storage with customer metadata, transaction IDs, and status
- Customer order history view with search and filters
- PDF order export capability
- Order details available to authorized users and staff

### 6. Dashboard & Admin Tools
- Staff dashboard UI with sections for orders, inventory, and user management
- Order listing with status badges and summary cards
- Inventory table with editable stock and active toggles
- User management tools and quick role-aware actions
- Search, filters, and tabbed dashboard navigation
- Status toasts and save indicators for live updates

### 7. Database & Persistence
- MongoDB database using Mongoose schemas
- Models for users, carts, products, orders, and sessions
- Default product seeding on startup
- Persistent cart storage across sessions and devices
- Order item tracking and stock reservation logic
- Session persistence with MongoDB-backed store

## How to Use the Website

### As a Customer
Customers can browse the public product catalog, add items to their cart, and complete orders through the checkout flow. After signing up and finishing the required profile fields, customers can open `user-dashboard.html` to review their own orders, filter by status, and download invoices as PDF files. The cart stays saved while logged in, and product stock is reserved once an order is placed.

### As Staff or Admin
Staff and admin users access `dashboard.html` to manage business operations. These users can review and update orders, manage inventory, change product availability, and support customer workflows. Staff roles also gain visibility into more order information than standard customers, which helps them verify status and resolve issues faster.

## Roles & Permissions

- `customer` — a regular buyer who can shop the catalog, manage their own cart, place orders, and view only their own order history. Customers must complete required profile fields before accessing the full site experience.
- `technical` — technical support staff who can access the staff dashboard to diagnose problems, inspect order details, and assist with inventory or processing issues. Technical staff cannot create or delete user accounts.
- `employee` — operations staff who can manage orders, update product stock and availability, and support fulfillment or customer service tasks. Employees can delete certain staff users, but they cannot create new staff accounts.
- `manager` — management staff with broader access to orders, inventory, and staff activity. Managers can create new `technical`, `employee`, or `manager` users and can remove staff users with lower roles.
- `primary` — the main admin account with the highest level of access. The primary admin is created from environment settings and can manage core system configuration, create and delete staff users, and oversee the entire application.

### User Creation and Removal Rules

- Only `manager` and `primary` roles may create new staff users through the dashboard.
- `employee`, `manager`, and `primary` roles may delete users, but role restrictions apply:
  - `primary` may delete any user except itself.
  - `manager` may delete any user except one with the `primary` role.
  - `employee` may delete users only when the target is not `primary` or `manager`.
- No user may delete their own account via the dashboard delete endpoint.

## Application Pages

- `index.html` — Home / landing page
- `auth.html` — Sign in / sign up page
- `complete-profile.html` — Profile completion page for new users
- `dashboard.html` — Staff/admin dashboard page
- `user-dashboard.html` — Customer order history page
- `products.html` — Public product catalog page
- `payment.html` — Payment page (implementation details excluded)
- `test-payment.html` — Payment test page (implementation details excluded)

## API Endpoints

### Authentication & User
- `POST /api/login` — Sign in with email/password
- `POST /api/signup` — Create a new user account
- `POST /api/logout` — Sign out current user
- `GET /api/user` — Retrieve current user information and profile status
- `POST /api/profile/complete` — Complete profile information after registration

### Products & Cart
- `GET /api/products/public` — Get public product catalog
- `GET /api/cart` — Read current user cart
- `PUT /api/cart` — Update current user cart
- `DELETE /api/cart` — Clear current user cart

### Orders
- `POST /api/orders` — Create a manual or alternate order
- `GET /api/orders/me` — List orders for the current user
- `GET /api/orders/:id` — Retrieve a specific order
- `GET /api/orders/:id/pdf` — Download order invoice PDF

## Backend Architecture

### Server
- Built with `express`
- Uses `compression` for performance
- Uses `cors` for cross-origin support
- Serves static frontend pages and assets
- Applies cache-control headers for HTML pages

### Database
- Uses `mongoose` for MongoDB schema definitions and queries
- Includes validation, indexing, and defaults in schemas
- Seeds default products if missing on startup
- Persists user sessions and cart contents

### Authentication
- Uses `passport` for OAuth providers
- Supports Google and Facebook sign-in when credentials are configured
- Stores user provider metadata and synchronizes role assignment
- Passwords are hashed with `bcrypt`

## Setup & Run

### Prerequisites
- Node.js 18+ (or compatible version)
- MongoDB Atlas or local MongoDB instance
- `.env` file with:
  - `MONGODB_URI`
  - `SESSION_SECRET`
  - `APP_BASE_URL`
  - `PRIMARY_ADMIN_EMAIL`
  - `PRIMARY_ADMIN_PASSWORD`
  - `MANAGER_EMAILS`
  - `EMPLOYEE_EMAILS`

### Install

```bash
npm install
```

### Run

```bash
npm start
```

Open the app at:

```text
http://localhost:3000/
```

## Environment Variables

- `MONGODB_URI` — MongoDB connection string
- `SESSION_SECRET` — Secret for session cookies
- `APP_BASE_URL` — App base URL for OAuth callbacks
- `PRIMARY_ADMIN_EMAIL` — Email for primary admin account
- `PRIMARY_ADMIN_PASSWORD` — Password for primary admin account
- `MANAGER_EMAILS` — Comma-separated manager emails
- `EMPLOYEE_EMAILS` — Comma-separated employee emails
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Optional Google OAuth
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` — Optional Facebook OAuth

## File Structure

- `server.js` — Express server, API routes, auth, and data models
- `script.js` — Frontend interactivity, animations, auth UI, and data loading
- `mazen.css` — Site styling and responsive layouts
- `auth.html` — Authentication page
- `complete-profile.html` — Profile completion page
- `dashboard.html` — Staff/admin dashboard page
- `user-dashboard.html` — Customer order history page
- `products.html` — Product catalog page
- `index.html` — Landing page
- `package.json` — Project dependencies and start command

## Notes

- The app is designed to support both customer-facing storefront features and internal staff workflows.
- Role-based access is enforced across API endpoints and dashboard pages.
- Customer orders, carts, and product inventory are persisted in MongoDB.
- UI/UX is optimized for responsive behavior, accessible menus, and navigation.

## Dependencies

- `express`
- `mongoose`
- `passport`
- `passport-google-oauth20`
- `passport-facebook`
- `bcrypt`
- `body-parser`
- `compression`
- `connect-mongo`
- `cors`
- `dotenv`
- `pdfkit`

## Contact

For any development or deployment questions, adjust the `.env` setup and contact the repository maintainer.
