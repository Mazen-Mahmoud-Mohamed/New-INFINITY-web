const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;
const FILE_PATH = path.join(__dirname, "database", "users.txt");

// Ensure database directory exists
if (!fs.existsSync(path.join(__dirname, "database"))) {
    fs.mkdirSync(path.join(__dirname, "database"));
}

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(session({
    secret: 'infinity-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true if using HTTPS
}));

function parseUsers() {
    if (!fs.existsSync(FILE_PATH)) return [];
    const lines = fs.readFileSync(FILE_PATH, "utf8").trim().split("\n");
    return lines.map(line => {
        const [email, password, name] = line.split(",");
        return { email, password, name };
    });
}

function validateInput(email, password, name = null) {
    if (!email || !password) {
        return { valid: false, message: "Email and password are required" };
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
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

app.post("/api/register", async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        const validation = validateInput(email, password, name);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }

        const users = parseUsers();
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const entry = `${email},${hashedPassword},${name}\n`;
        fs.appendFileSync(FILE_PATH, entry);
        res.json({ message: "Registration successful!" });
    } catch (error) {
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

        const users = parseUsers();
        const user = users.find(u => u.email === email);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        req.session.user = { email: user.email, name: user.name };
        res.json({ message: "Login successful!", user: { email: user.email, name: user.name } });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/user", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy();
    res.json({ message: "Logged out successfully" });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 