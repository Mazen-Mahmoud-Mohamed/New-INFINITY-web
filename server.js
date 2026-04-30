require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const compression = require("compression");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cors = require("cors");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const PDFDocument = require("pdfkit");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in environment (.env).");
}

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";
const PRIMARY_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || "").trim().toLowerCase();
const PRIMARY_ADMIN_PASSWORD = process.env.PRIMARY_ADMIN_PASSWORD || "";
const MANAGER_EMAILS = (process.env.MANAGER_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const EMPLOYEE_EMAILS = (process.env.EMPLOYEE_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

// Payment configuration (keep secrets in env)
const STRIPE_API_KEY_BASE64 = process.env.STRIPE_API_KEY_BASE64 || "";

// Mock payment processor (for development/testing)
const mockPaymentProcessor = {
    processPayment: async (paymentData) => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const isSuccess = Math.random() > 0.1;
        if (!isSuccess) {
            throw new Error("Payment declined by bank");
        }

        return {
            success: true,
            transactionId: "txn_" + Math.random().toString(36).slice(2, 11),
            amount: paymentData.amount,
            currency: paymentData.currency
        };
    }
};

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(compression());
app.use(express.static(__dirname, {
    maxAge: "7d",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            res.setHeader("Surrogate-Control", "no-store");
        }
    }
}));
app.use(bodyParser.json());

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true behind HTTPS
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: "sessions",
        ttl: 60 * 60 * 24 * 7 // 7 days
    })
}));

app.use(passport.initialize());
app.use(passport.session());

// Keep session role in sync with database/email role lists.
app.use(async (req, _res, next) => {
    try {
        if (!req.session?.user?.id) return next();
        const user = await User.findById(req.session.user.id).select("email name role").lean();
        if (!user) {
            req.session.user = null;
            return next();
        }
        const computedRole = getRoleForEmail(user.email) || user.role || "customer";
        if (computedRole !== user.role) {
            await User.updateOne({ _id: user._id }, { $set: { role: computedRole } });
        }
        req.session.user = {
            id: String(user._id),
            email: user.email,
            name: user.name,
            role: computedRole,
        };
        next();
    } catch (_err) {
        next();
    }
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+20|0)?1[0-2,5]\d{8}$/;

function validateInput(email, password, name = null) {
    if (!email || !password) {
        return { valid: false, message: "Email and password are required" };
    }
    if (!emailRegex.test(email)) {
        return { valid: false, message: "Invalid email format" };
    }
    if (password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters long" };
    }
    if (name && name.length < 2) {
        return { valid: false, message: "Name must be at least 2 characters long" };
    }
    return { valid: true };
}

function validateRegistrationProfile(profile = {}) {
    const {
        phone,
        age,
        gender,
        state,
        companyName,
        companyLocation
    } = profile;

    if (!phone || !phoneRegex.test(String(phone).trim())) {
        return { valid: false, message: "Please enter a valid Egyptian phone number" };
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 16 || parsedAge > 100) {
        return { valid: false, message: "Age must be a number between 16 and 100" };
    }

    const allowedGenders = ["male", "female", "prefer_not_to_say"];
    if (!allowedGenders.includes(gender)) {
        return { valid: false, message: "Please select a valid gender" };
    }

    if (!state || String(state).trim().length < 2) {
        return { valid: false, message: "State in Egypt is required" };
    }

    if (companyName && String(companyName).trim().length > 120) {
        return { valid: false, message: "Company name is too long" };
    }

    if (companyLocation && String(companyLocation).trim().length > 200) {
        return { valid: false, message: "Company location is too long" };
    }

    return { valid: true };
}

function requireAuth(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    next();
}

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
        if (!allowedRoles.includes(req.session.user.role)) {
            return res.status(403).json({ error: "Not authorized" });
        }
        next();
    };
}

function getSessionUserObjectId(req) {
    return new mongoose.Types.ObjectId(req.session.user.id);
}

function getRoleForEmail(email = "") {
    const e = String(email).toLowerCase().trim();
    if (PRIMARY_ADMIN_EMAIL && e === PRIMARY_ADMIN_EMAIL) return "primary";
    if (MANAGER_EMAILS.includes(e)) return "manager";
    if (EMPLOYEE_EMAILS.includes(e)) return "employee";
    return null;
}

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true },
    age: { type: Number, default: null },
    gender: { type: String, enum: ["male", "female", "prefer_not_to_say"], default: null },
    state: { type: String, default: null, trim: true },
    companyName: { type: String, default: null, trim: true },
    companyLocation: { type: String, default: null, trim: true },
    role: { type: String, enum: ["customer", "technical", "employee", "manager", "primary"], default: "customer" },
    provider: { type: String, default: "local" },
    providerId: { type: String, default: null },
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transactionId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "EGP" },
    customerName: { type: String },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String },
    customerState: { type: String },
    customerAge: { type: Number },
    customerGender: { type: String },
    customerCompanyName: { type: String },
    customerCompanyLocation: { type: String },
    billingAddress: { type: String },
    orderItems: { type: Array, default: [] },
    paymentMethod: { type: String, default: "visa" },
    status: { type: String, default: "completed" },
    vatApplied: { type: Boolean, default: false }
}, { timestamps: true });

const CartItemSchema = new mongoose.Schema({
    id: { type: String, required: true }, // product id from UI
    name: { type: String, required: true },
    price: { type: Number, required: true },
    installation: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const CartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: { type: [CartItemSchema], default: [] },
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    price: { type: Number, required: true, default: 0 },
    installation: { type: Number, required: true, default: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    active: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
const Order = mongoose.model("Order", OrderSchema);
const Cart = mongoose.model("Cart", CartSchema);
const Product = mongoose.model("Product", ProductSchema);

async function seedDefaultProducts() {
    const defaults = [
        { productId: "fmb120", name: "GPS Tracker FMB120", image: "assets/products/fmb120.png", price: 3475, installation: 325, stock: 25, active: true },
        { productId: "cut-off", name: "Cut Off Engine", image: "assets/products/cut-off-engine.png", price: 170, installation: 80, stock: 50, active: true },
        { productId: "door-sensor", name: "Door Sensor", image: "assets/products/door-sensor.png", price: 240, installation: 350, stock: 40, active: true },
        { productId: "driver-button", name: "Driver ID Button", image: "assets/products/driver-button.png", price: 1220, installation: 0, stock: 30, active: true },
    ];
    for (const p of defaults) {
        const existing = await Product.findOne({ productId: p.productId }).lean();
        if (!existing) {
            await Product.create(p);
            continue;
        }

        // Backfill only missing fields; do NOT overwrite manager edits.
        const patch = {};
        if (!existing.name) patch.name = p.name;
        if (!existing.image) patch.image = p.image;
        if (typeof existing.price !== "number") patch.price = p.price;
        if (typeof existing.installation !== "number") patch.installation = p.installation;
        if (typeof existing.stock !== "number") patch.stock = p.stock;
        if (typeof existing.active !== "boolean") patch.active = p.active;
        if (Object.keys(patch).length) {
            await Product.updateOne({ productId: p.productId }, { $set: patch });
        }
    }
}

async function syncRoleFromEmailLists(user) {
    if (!user) return user;
    const expectedRole = getRoleForEmail(user.email);
    if (expectedRole && user.role !== expectedRole) {
        user.role = expectedRole;
        await user.save();
    }
    return user;
}

async function ensurePrimaryAdmin() {
    if (!PRIMARY_ADMIN_EMAIL || !PRIMARY_ADMIN_PASSWORD) return;
    const existing = await User.findOne({ email: PRIMARY_ADMIN_EMAIL });
    if (!existing) {
        const passwordHash = await bcrypt.hash(PRIMARY_ADMIN_PASSWORD, 10);
        await User.create({
            email: PRIMARY_ADMIN_EMAIL,
            name: "Primary Admin",
            passwordHash,
            role: "primary",
            provider: "local",
        });
        return;
    }
    if (existing.role !== "primary") {
        existing.role = "primary";
        await existing.save();
    }
}

async function reserveStock(orderItems = []) {
    const cleanItems = (Array.isArray(orderItems) ? orderItems : [])
        .filter(i => i && i.id && Number(i.quantity) > 0)
        .map(i => ({ id: String(i.id), quantity: Number(i.quantity) }));

    for (const item of cleanItems) {
        const updated = await Product.findOneAndUpdate(
            { productId: item.id, active: true, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { new: true }
        );
        if (!updated) {
            throw new Error(`Product ${item.id} is out of stock or not enough quantity`);
        }
    }
}

passport.serializeUser((user, done) => {
    done(null, String(user._id));
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user || false);
    } catch (err) {
        done(err);
    }
});

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: `${APP_BASE_URL}/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile?.emails?.[0]?.value?.toLowerCase();
                if (!email) return done(new Error("Google account has no email"));

                let user = await User.findOne({ email });
                if (!user) {
                    user = await User.create({
                        email,
                        name: profile.displayName || "Google User",
                        role: getRoleForEmail(email) || "customer",
                        provider: "google",
                        providerId: profile.id,
                        passwordHash: null,
                    });
                } else if (!user.providerId) {
                    user.provider = "google";
                    user.providerId = profile.id;
                    await user.save();
                }
                user = await syncRoleFromEmailLists(user);

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    ));
}

if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy(
        {
            clientID: FACEBOOK_APP_ID,
            clientSecret: FACEBOOK_APP_SECRET,
            callbackURL: `${APP_BASE_URL}/auth/facebook/callback`,
            profileFields: ["id", "displayName", "emails"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile?.emails?.[0]?.value?.toLowerCase();
                if (!email) return done(new Error("Facebook account has no email"));

                let user = await User.findOne({ email });
                if (!user) {
                    user = await User.create({
                        email,
                        name: profile.displayName || "Facebook User",
                        role: getRoleForEmail(email) || "customer",
                        provider: "facebook",
                        providerId: profile.id,
                        passwordHash: null,
                    });
                } else if (!user.providerId) {
                    user.provider = "facebook";
                    user.providerId = profile.id;
                    await user.save();
                }
                user = await syncRoleFromEmailLists(user);

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    ));
}

mongoose.set("strictQuery", true);
async function start() {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
        });
        await ensurePrimaryAdmin();
        await seedDefaultProducts();
        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("MongoDB connection error.");
        console.error("Fixes to try:");
        console.error("- Make sure your `.env` has a valid MONGODB_URI");
        console.error("- In MongoDB Atlas: Network Access → add your IP (or 0.0.0.0/0 for testing)");
        console.error("- If your password has special characters, URL-encode it");
        console.error("Raw error:", err?.message || err);
        process.exit(1);
    }
}

// Payment processing endpoint
app.post("/api/process-payment", requireAuth, async (req, res) => {
    try {
        const {
            cardNumber,
            expiryDate,
            cvv,
            cardholderName,
            billingEmail,
            billingPhone,
            billingAddress,
            amount,
            currency,
            orderItems
        } = req.body;

        // Validate required fields
        if (!cardNumber || !expiryDate || !cvv || !cardholderName || !billingEmail || !amount) {
            return res.status(400).json({ error: "Missing required payment information" });
        }

        // Basic card validation
        if (cardNumber.length < 13 || cardNumber.length > 19) {
            return res.status(400).json({ error: "Invalid card number" });
        }

        if (cvv.length < 3 || cvv.length > 4) {
            return res.status(400).json({ error: "Invalid CVV" });
        }

        // Process payment using mock processor (swap to Stripe later)
        const paymentResult = await mockPaymentProcessor.processPayment({
            cardNumber,
            expiryDate,
            cvv,
            cardholderName,
            billingEmail,
            billingPhone,
            billingAddress,
            amount,
            currency,
            orderItems
        });

        if (paymentResult.success) {
            await reserveStock(orderItems);
            const user = await User.findById(req.session.user.id).lean();
            const order = await Order.create({
                userId: getSessionUserObjectId(req),
                transactionId: paymentResult.transactionId,
                amount: amount,
                currency: currency,
                customerName: user?.name || req.session.user.name,
                customerEmail: billingEmail || req.session.user.email,
                customerPhone: billingPhone || user?.phone || null,
                customerState: user?.state || null,
                customerAge: user?.age ?? null,
                customerGender: user?.gender || null,
                customerCompanyName: user?.companyName || null,
                customerCompanyLocation: user?.companyLocation || null,
                billingAddress: billingAddress,
                orderItems: orderItems,
                paymentMethod: "visa",
                status: "completed"
            });

            res.json({
                success: true,
                transactionId: paymentResult.transactionId,
                amount: amount,
                currency: currency,
                orderId: order._id
            });
        } else {
            res.status(400).json({ error: "Payment failed" });
        }

    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ 
            error: error.message || "Payment processing failed" 
        });
    }
});

// Non-card orders (bank transfer / instapay / cash)
app.post("/api/orders", requireAuth, async (req, res) => {
    try {
        const { paymentMethod, amount, currency, orderItems, vatApplied } = req.body || {};
        if (!paymentMethod || typeof amount !== "number" || !currency) {
            return res.status(400).json({ error: "Missing order information" });
        }
        await reserveStock(orderItems);

        const user = await User.findById(req.session.user.id).lean();
        const order = await Order.create({
            userId: getSessionUserObjectId(req),
            transactionId: "manual_" + Math.random().toString(36).slice(2, 11),
            amount,
            currency,
            customerName: user?.name || req.session.user.name,
            customerEmail: req.session.user.email,
            customerPhone: user?.phone || null,
            customerState: user?.state || null,
            customerAge: user?.age ?? null,
            customerGender: user?.gender || null,
            customerCompanyName: user?.companyName || null,
            customerCompanyLocation: user?.companyLocation || null,
            orderItems: Array.isArray(orderItems) ? orderItems : [],
            paymentMethod,
            status: "pending",
            vatApplied: !!vatApplied
        });

        res.json({ success: true, orderId: order._id });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Public products with live stock for storefront
app.get("/api/products/public", async (_req, res) => {
    try {
        const products = await Product.find({ active: true }).select("productId name image price installation stock active -_id").lean();
        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// Cart (account-based) - persists across refresh/devices while logged in
app.get("/api/cart", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        const cart = await Cart.findOne({ userId });
        res.json({ items: cart?.items || [] });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put("/api/cart", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        const items = Array.isArray(req.body?.items) ? req.body.items : [];

        // Basic sanitization
        const normalized = items
            .filter(i => i && typeof i.id === "string" && typeof i.name === "string")
            .map(i => ({
                id: String(i.id),
                name: String(i.name).slice(0, 200),
                price: Number(i.price || 0),
                installation: Number(i.installation || 0),
                quantity: Math.max(1, Number(i.quantity || 1))
            }));

        const cart = await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: normalized } },
            { upsert: true, new: true }
        );

        res.json({ items: cart.items });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete("/api/cart", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { upsert: true }
        );
        res.json({ message: "Cart cleared" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// List current user's orders (for verification/debugging)
app.get("/api/orders/me", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(50);
        res.json({ orders });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// Staff dashboard endpoints
app.get("/api/dashboard/products", requireRole(["technical", "employee", "manager", "primary"]), async (_req, res) => {
    try {
        const products = await Product.find({}).sort({ productId: 1 }).lean();
        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/api/dashboard/products/:productId/stock", requireRole(["employee", "manager", "primary"]), async (req, res) => {
    try {
        const { productId } = req.params;
        const { stock, name, active, price, installation, image } = req.body || {};
        if (typeof stock !== "number" || stock < 0) {
            return res.status(400).json({ error: "Stock must be a non-negative number" });
        }
        const update = { stock: Math.floor(stock) };
        if (typeof name === "string" && name.trim()) update.name = name.trim();
        if (typeof active === "boolean") update.active = active;
        if (typeof price === "number" && price >= 0) update.price = price;
        if (typeof installation === "number" && installation >= 0) update.installation = installation;
        if (typeof image === "string" && image.trim()) update.image = image.trim();

        const product = await Product.findOneAndUpdate(
            { productId },
            { $set: update },
            { new: true }
        );
        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json({ product });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/dashboard/orders", requireRole(["technical", "employee", "manager", "primary"]), async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;
        const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(300).lean();

        // Enrich missing order item images from current product catalog.
        const productIds = new Set();
        orders.forEach((o) => {
            (o.orderItems || []).forEach((item) => {
                if (item?.id) productIds.add(String(item.id));
            });
        });
        const products = await Product.find({ productId: { $in: Array.from(productIds) } })
            .select("productId image -_id")
            .lean();
        const imageByProductId = {};
        products.forEach((p) => {
            imageByProductId[p.productId] = p.image;
        });

        const enrichedOrders = orders.map((o) => ({
            ...o,
            orderItems: (o.orderItems || []).map((item) => ({
                ...item,
                image: item?.image || imageByProductId[String(item?.id || "")] || "assets/images/infinity-logo.png"
            }))
        }));

        res.json({ orders: enrichedOrders });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/api/dashboard/orders/:id/status", requireRole(["employee", "manager", "primary"]), async (req, res) => {
    try {
        const allowedStatuses = ["pending", "processing", "completed", "cancelled", "failed"];
        const { status } = req.body || {};
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        );
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json({ order });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/dashboard/orders/:id/pdf", requireRole(["technical", "employee", "manager", "primary"]), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ error: "Order not found" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="order-${order.transactionId || order._id}.pdf"`);

        const doc = new PDFDocument({ margin: 36, size: "A4" });
        doc.pipe(res);

        // Use a Unicode-capable font when available (better Arabic/UTF-8 rendering)
        const arialPath = "C:\\Windows\\Fonts\\arial.ttf";
        if (fs.existsSync(arialPath)) {
            doc.registerFont("UI", arialPath);
            doc.font("UI");
        }

        const pageWidth = doc.page.width - 72;
        doc.fillColor("#0f172a");
        doc.fontSize(20).text("INFINITY - Order Report", { align: "left" });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Order ID: ${order._id}`);
        doc.text(`Transaction ID: ${order.transactionId || "-"}`);
        doc.text(`Created At: ${new Date(order.createdAt).toLocaleString()}`);
        doc.text(`Status: ${order.status || "-"}`);
        doc.moveDown(0.5);

        doc.fontSize(13).text("Customer");
        doc.fontSize(11);
        doc.text(`Name: ${order.customerName || "-"}`);
        doc.text(`Email: ${order.customerEmail || "-"}`);
        doc.text(`Phone: ${order.customerPhone || "-"}`);
        doc.text(`State: ${order.customerState || "-"}`);
        doc.text(`Company: ${order.customerCompanyName || "-"}`);
        doc.text(`Company Location: ${order.customerCompanyLocation || "-"}`);
        doc.text(`Billing Address: ${order.billingAddress || "-"}`);
        doc.moveDown(0.5);

        doc.fontSize(13).text("Payment");
        doc.fontSize(11);
        doc.text(`Method: ${order.paymentMethod || "-"}`);
        doc.text(`Currency: ${order.currency || "EGP"}`);
        doc.text(`Amount: ${Number(order.amount || 0).toFixed(2)}`);
        doc.text(`VAT Applied: ${order.vatApplied ? "Yes" : "No"}`);
        doc.moveDown(0.8);

        doc.fontSize(13).text("Order Items");
        doc.moveDown(0.4);

        const items = Array.isArray(order.orderItems) ? order.orderItems : [];

        // Build fallback image map from current product catalog using item.id
        const itemIds = items.map(i => String(i?.id || "")).filter(Boolean);
        const products = await Product.find({ productId: { $in: itemIds } }).select("productId image -_id").lean();
        const imageByProductId = {};
        products.forEach((p) => { imageByProductId[p.productId] = p.image; });

        const defaultLogo = "assets/images/infinity-logo.png";
        const resolveImagePath = (rawPath) => {
            if (!rawPath || typeof rawPath !== "string") return null;
            const normalized = rawPath.replace(/^\/+/, "");
            const abs = path.join(__dirname, normalized);
            return fs.existsSync(abs) ? abs : null;
        };
        for (const item of items) {
            if (doc.y > 720) doc.addPage();

            const blockTop = doc.y;
            const blockHeight = 70;
            doc.roundedRect(36, blockTop - 2, pageWidth, blockHeight, 8).fillColor("#f8fafc").fill();
            doc.fillColor("#0f172a");

            const preferredImage = item?.image || imageByProductId[String(item?.id || "")] || defaultLogo;
            const imagePath = resolveImagePath(preferredImage);
            const imageX = 44;
            const imageY = blockTop + 6;
            if (imagePath) {
                try {
                    doc.image(imagePath, imageX, imageY, { fit: [52, 52] });
                } catch (_e) {
                    // ignore invalid image formats
                }
            }

            const startX = 106;
            const startY = blockTop + 6;
            doc.fontSize(11).fillColor("#0f172a").text(`${item.name || "Item"}  x ${item.quantity || 1}`, startX, startY, { width: pageWidth - 120 });
            doc.fontSize(10).fillColor("#334155").text(`Price: EGP ${Number(item.price || 0).toFixed(2)}`, startX, startY + 18);
            doc.text(`Installation: EGP ${Number(item.installation || 0).toFixed(2)}`, startX, startY + 33);

            doc.y = blockTop + blockHeight + 6;
        }

        doc.end();
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

function canManageUsers(role) {
    return ["employee", "manager", "primary"].includes(role);
}

function canDeleteRole(actorRole, targetRole) {
    if (targetRole === "primary") return false;
    if (actorRole === "primary") return true;
    if (actorRole === "manager") return targetRole !== "primary";
    if (actorRole === "employee") return !["primary", "manager"].includes(targetRole);
    return false;
}

app.get("/api/dashboard/users", requireRole(["technical", "employee", "manager", "primary"]), async (_req, res) => {
    try {
        const users = await User.find({ role: { $in: ["technical", "employee", "manager", "primary"] } })
            .select("email name role phone state companyName createdAt")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/dashboard/customers", requireRole(["technical", "employee", "manager", "primary"]), async (_req, res) => {
    try {
        const customers = await User.find({ role: "customer" })
            .select("name email phone age gender state companyName companyLocation createdAt -_id")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ customers });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/dashboard/users", requireRole(["manager", "primary"]), async (req, res) => {
    try {
        const actorRole = req.session.user.role;
        if (!canManageUsers(actorRole)) return res.status(403).json({ error: "Not authorized" });

        const { name, email, password, role } = req.body || {};
        const allowedRoles = ["technical", "employee", "manager"];
        if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing required fields" });
        if (!allowedRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

        const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
        if (existing) return res.status(400).json({ error: "Email already registered" });

        const passwordHash = await bcrypt.hash(String(password), 10);
        const user = await User.create({
            name: String(name).trim(),
            email: String(email).toLowerCase().trim(),
            passwordHash,
            role,
            provider: "local",
        });
        res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete("/api/dashboard/users/:id", requireRole(["employee", "manager", "primary"]), async (req, res) => {
    try {
        const actorRole = req.session.user.role;
        const actorId = String(req.session.user.id);
        const target = await User.findById(req.params.id);
        if (!target) return res.status(404).json({ error: "User not found" });
        if (String(target._id) === actorId) return res.status(400).json({ error: "You cannot delete yourself" });

        if (!canDeleteRole(actorRole, target.role)) {
            return res.status(403).json({ error: "You cannot delete this role" });
        }
        await User.deleteOne({ _id: target._id });
        res.json({ message: "User deleted" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// Allow user to modify/delete their own PENDING orders
app.patch("/api/orders/:id", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        const orderId = new mongoose.Types.ObjectId(req.params.id);

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.status !== "pending") return res.status(400).json({ error: "Only pending orders can be modified" });

        const { orderItems, amount, vatApplied } = req.body || {};
        if (Array.isArray(orderItems)) order.orderItems = orderItems;
        if (typeof amount === "number") order.amount = amount;
        if (typeof vatApplied === "boolean") order.vatApplied = vatApplied;

        await order.save();
        res.json({ order });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete("/api/orders/:id", requireAuth, async (req, res) => {
    try {
        const userId = getSessionUserObjectId(req);
        const orderId = new mongoose.Types.ObjectId(req.params.id);

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.status !== "pending") return res.status(400).json({ error: "Only pending orders can be deleted" });

        await Order.deleteOne({ _id: orderId, userId });
        res.json({ message: "Order deleted" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/auth/google", (req, res, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Google OAuth is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", { session: false }, async (err, user) => {
        if (err || !user) return res.redirect("/auth.html?error=google_auth_failed");
        req.session.user = { id: String(user._id), email: user.email, name: user.name, role: user.role || "customer" };
        return res.redirect((["employee", "manager", "primary", "technical"].includes(user.role)) ? "/dashboard.html" : "/index.html");
    })(req, res, next);
});

app.get("/auth/facebook", (req, res, next) => {
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res.status(500).json({ error: "Facebook OAuth is not configured" });
    }
    passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
});

app.get("/auth/facebook/callback", (req, res, next) => {
    passport.authenticate("facebook", { session: false }, async (err, user) => {
        if (err || !user) return res.redirect("/auth.html?error=facebook_auth_failed");
        req.session.user = { id: String(user._id), email: user.email, name: user.name, role: user.role || "customer" };
        return res.redirect((["employee", "manager", "primary", "technical"].includes(user.role)) ? "/dashboard.html" : "/index.html");
    })(req, res, next);
});

app.post("/api/register", async (req, res) => {
    try {
        const { email, password, name, phone, age, gender, state, companyName, companyLocation } = req.body;
        
        const validation = validateInput(email, password, name);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }

        const profileValidation = validateRegistrationProfile({
            phone, age, gender, state, companyName, companyLocation
        });
        if (!profileValidation.valid) {
            return res.status(400).json({ error: profileValidation.message });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            email,
            passwordHash,
            name,
            role: getRoleForEmail(email) || "customer",
            phone: String(phone).trim(),
            age: Number(age),
            gender,
            state: String(state).trim(),
            companyName: companyName ? String(companyName).trim() : null,
            companyLocation: companyLocation ? String(companyLocation).trim() : null,
        });

        // optional auto-login after registration:
        req.session.user = { id: String(user._id), email: user.email, name: user.name, role: user.role || "customer" };

        res.json({ message: "Registration successful!", user: { email: user.email, name: user.name, role: user.role || "customer" } });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({ error: "Email already registered" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const validation = validateInput(email, password);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        await syncRoleFromEmailLists(user);

        req.session.user = { id: String(user._id), email: user.email, name: user.name, role: user.role || "customer" };
        res.json({ message: "Login successful!", user: { email: user.email, name: user.name, role: user.role || "customer" } });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/user", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    if (!req.session.user.role) {
        const user = await User.findById(req.session.user.id).select("role").lean();
        req.session.user.role = user?.role || "customer";
    }
    res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy();
    res.json({ message: "Logged out successfully" });
});

start();