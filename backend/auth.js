const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret key for JWT (in production, use an environment variable like process.env.JWT_SECRET)
const JWT_SECRET = 'byazo_secret_key_2026';

// 1. REGISTER ROUTE (To create your boss/admin or staff accounts)
router.post('/register', async (req, res) => {
    const { email, password, role, branch_id } = req.body;

    try {
        // Check if user already exists
        const [existing] = await req.db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already exists with this email.' });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user into MySQL
        await req.db.query(
            'INSERT INTO users (email, password, role, branch_id) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role || 'cashier', branch_id || null]
        );

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// 2. LOGIN ROUTE (To authenticate users)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const [users] = await req.db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const user = users[0];

        // Compare submitted password with the hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        // Create a JWT token valid for 1 day
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, branch_id: user.branch_id },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                branch_id: user.branch_id
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = router;
