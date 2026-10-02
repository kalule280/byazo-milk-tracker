require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const authRoutes = require('./auth');

// Middleware to attach db (pool) to request for auth.js
app.use((req, res, next) => {
    req.db = pool;
    next();
});

app.use('/api/auth', authRoutes);

const tierPrices = [1500, 1600, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2200];
const expenseFields = [
    'expense_fuel', 'expense_transport', 'expense_electricity', 'expense_salaries',
    'expense_packaging', 'expense_repairs', 'expense_other'
];

const calculateRecordTotals = (record) => {
    const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const litersSold = tierPrices.map(price => number(record[`liters_sold_${price}`]));
    const totalLiters = litersSold.reduce((total, liters) => total + liters, 0);
    const totalSales = litersSold.reduce((total, liters, index) => total + liters * tierPrices[index], 0);
    const totalExpenses = expenseFields.reduce((total, field) => total + number(record[field]), 0);
    const totalCostOfGoodsSold = number(record.buying_price) * totalLiters;
    const closingStock = number(record.old_stock) + number(record.new_stock) - totalLiters;

    return {
        total_liters_sold: totalLiters,
        total_sales: totalSales,
        total_expenses: totalExpenses,
        total_cost_of_goods_sold: totalCostOfGoodsSold,
        closing_stock: closingStock,
        net_profit: totalSales - totalCostOfGoodsSold - totalExpenses
    };
};

const getDashboardRows = async (date) => {
    const [records] = await pool.query(
        'SELECT * FROM daily_milk_records WHERE record_date = ?',
        [date]
    );
    const recordsByBranch = new Map(records.map(record => [record.branch_name, record]));

    return ['Bakuli', 'Owiino', 'Kawempe'].map(branchName => {
        const record = recordsByBranch.get(branchName);
        const totals = record ? calculateRecordTotals(record) : {};
        return {
            branch_name: branchName,
            total_liters: totals.total_liters_sold || 0,
            total_revenue: totals.total_sales || 0,
            total_expenses: totals.total_expenses || 0,
            total_net_profit: totals.net_profit || 0,
            current_stock: totals.closing_stock || 0,
            total_buying_cost: totals.total_cost_of_goods_sold || 0
        };
    });
};

const ensureMilkRecordColumns = async () => {
    try {
        const [existingColumns] = await pool.query('SHOW COLUMNS FROM daily_milk_records');
        const columns = existingColumns.map(col => col.Field);
        const requiredColumns = ['liters_sold_1750', 'liters_sold_1850', 'liters_sold_1950'];

        for (const column of requiredColumns) {
            if (!columns.includes(column)) {
                await pool.query(`ALTER TABLE daily_milk_records ADD COLUMN ${column} DECIMAL(10,2) DEFAULT 0`);
                console.log(`Added missing column: ${column}`);
            }
        }
    } catch (err) {
        console.error('Error ensuring milk record columns:', err.message);
    }
};

// --- Initialize Branch Tables on Startup ---
const initBranchTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_milk_records (
                record_id INT AUTO_INCREMENT PRIMARY KEY,
                record_date DATE NOT NULL,
                branch_name VARCHAR(100) NOT NULL,
                buying_price DECIMAL(12,2) NOT NULL DEFAULT 0,
                old_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
                new_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1500 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1600 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1700 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1750 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1800 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1850 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1900 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_1950 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_2000 DECIMAL(12,2) NOT NULL DEFAULT 0,
                liters_sold_2200 DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_fuel DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_transport DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_electricity DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_salaries DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_packaging DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_repairs DECIMAL(12,2) NOT NULL DEFAULT 0,
                expense_other DECIMAL(12,2) NOT NULL DEFAULT 0,
                total_liters_sold DECIMAL(12,2) NOT NULL DEFAULT 0,
                total_sales DECIMAL(14,2) NOT NULL DEFAULT 0,
                total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
                total_cost_of_goods_sold DECIMAL(14,2) NOT NULL DEFAULT 0,
                closing_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
                net_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_daily_milk_record_date_branch (record_date, branch_name)
            )
        `);
        // Initialize users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'cashier',
                branch_id VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Initialize branch tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS branch_profiles (
                branch_name VARCHAR(100) PRIMARY KEY,
                manager_name VARCHAR(200) DEFAULT '',
                contact_phone VARCHAR(50) DEFAULT '',
                address VARCHAR(500) DEFAULT '',
                status ENUM('Active','Inactive','Under Maintenance') DEFAULT 'Active',
                notes VARCHAR(1000) DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stock_transfers (
                transfer_id INT AUTO_INCREMENT PRIMARY KEY,
                from_branch VARCHAR(100) NOT NULL,
                to_branch VARCHAR(100) NOT NULL,
                liters DECIMAL(10,2) NOT NULL,
                transfer_date DATE NOT NULL,
                reason VARCHAR(500) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS branch_staff (
                staff_id INT AUTO_INCREMENT PRIMARY KEY,
                branch_name VARCHAR(100) NOT NULL,
                staff_name VARCHAR(200) NOT NULL,
                role VARCHAR(100) DEFAULT 'Cashier',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Seed known branches if not present
        const branches = ['Bakuli', 'Owiino', 'Kawempe'];
        for (const b of branches) {
            await pool.query(
                `INSERT IGNORE INTO branch_profiles (branch_name) VALUES (?)`,
                [b]
            );
        }
        console.log('Branch tables initialized.');
        await ensureMilkRecordColumns();
    } catch (err) {
        console.error('Error initializing branch tables:', err.message);
    }
};
initBranchTables();

// 1. Get the previous closing stock for auto-filling old stock per branch
app.get('/api/previous-stock/:date/:branch', async (req, res) => {
    try {
        const { date, branch } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM daily_milk_records WHERE branch_name = ? AND record_date < ? ORDER BY record_date DESC LIMIT 1`,
            [branch, date]
        );
        const previousStock = rows.length > 0 ? calculateRecordTotals(rows[0]).closing_stock : 0.00;
        res.json({ old_stock: previousStock });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Submit a new daily milk record
app.post('/api/milk-records', async (req, res) => {
    try {
        const {
            record_date,
            branch_name,
            buying_price,
            old_stock,
            new_stock,
            liters_sold_1500,
            liters_sold_1600,
            liters_sold_1700,
            liters_sold_1750,
            liters_sold_1800,
            liters_sold_1850,
            liters_sold_1900,
            liters_sold_1950,
            liters_sold_2000,
            liters_sold_2200,
            expense_fuel,
            expense_transport,
            expense_electricity,
            expense_salaries,
            expense_packaging,
            expense_repairs,
            expense_other
        } = req.body;

        const query = `
            INSERT INTO daily_milk_records (
                record_date, branch_name, buying_price, old_stock, new_stock,
                liters_sold_1500, liters_sold_1600, liters_sold_1700, liters_sold_1750, liters_sold_1800, liters_sold_1850,
                liters_sold_1900, liters_sold_1950, liters_sold_2000, liters_sold_2200,
                expense_fuel, expense_transport, expense_electricity, 
                expense_salaries, expense_packaging, expense_repairs, expense_other
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                buying_price = VALUES(buying_price),
                old_stock = VALUES(old_stock),
                new_stock = VALUES(new_stock),
                liters_sold_1500 = VALUES(liters_sold_1500),
                liters_sold_1600 = VALUES(liters_sold_1600),
                liters_sold_1700 = VALUES(liters_sold_1700),
                liters_sold_1750 = VALUES(liters_sold_1750),
                liters_sold_1800 = VALUES(liters_sold_1800),
                liters_sold_1850 = VALUES(liters_sold_1850),
                liters_sold_1900 = VALUES(liters_sold_1900),
                liters_sold_1950 = VALUES(liters_sold_1950),
                liters_sold_2000 = VALUES(liters_sold_2000),
                liters_sold_2200 = VALUES(liters_sold_2200),
                expense_fuel = VALUES(expense_fuel),
                expense_transport = VALUES(expense_transport),
                expense_electricity = VALUES(expense_electricity),
                expense_salaries = VALUES(expense_salaries),
                expense_packaging = VALUES(expense_packaging),
                expense_repairs = VALUES(expense_repairs),
                expense_other = VALUES(expense_other)
        `;

        const parseNum = (val) => (val === '' || val === undefined || val === null) ? 0 : Number(val);

        let oldStockNum = parseNum(old_stock);

        // If the user left opening stock blank/zero for a new day, roll it over from the previous day's closing stock.
        const [existingRows] = await pool.query(
            `SELECT record_id FROM daily_milk_records WHERE record_date = ? AND branch_name = ? LIMIT 1`,
            [record_date, branch_name]
        );

        if (existingRows.length === 0 && (old_stock === '' || old_stock === undefined || old_stock === null || Number(old_stock) === 0)) {
            const [previousRows] = await pool.query(
                `SELECT * FROM daily_milk_records WHERE branch_name = ? AND record_date < ? ORDER BY record_date DESC LIMIT 1`,
                [branch_name, record_date]
            );
            oldStockNum = previousRows.length > 0 ? calculateRecordTotals(previousRows[0]).closing_stock : 0;
        }

        // Calculate total stock available before sales
        const newStockAddedNum = parseNum(new_stock);
        const totalAvailableStock = oldStockNum + newStockAddedNum;

        // Sum up all liters sold across the different price tiers
        const liters1500 = parseNum(liters_sold_1500);
        const liters1600 = parseNum(liters_sold_1600);
        const liters1700 = parseNum(liters_sold_1700);
        const liters1750 = parseNum(liters_sold_1750);
        const liters1800 = parseNum(liters_sold_1800);
        const liters1850 = parseNum(liters_sold_1850);
        const liters1900 = parseNum(liters_sold_1900);
        const liters1950 = parseNum(liters_sold_1950);
        const liters2000 = parseNum(liters_sold_2000);
        const liters2200 = parseNum(liters_sold_2200);

        const totalLitersSold = liters1500 + liters1600 + liters1700 + liters1750 + liters1800 + liters1850 + liters1900 + liters1950 + liters2000 + liters2200;
        const totalSales = liters1500 * 1500 + liters1600 * 1600 + liters1700 * 1700 + liters1750 * 1750 + liters1800 * 1800 + liters1850 * 1850 + liters1900 * 1900 + liters1950 * 1950 + liters2000 * 2000 + liters2200 * 2200;
        const totalExpenses = [expense_fuel, expense_transport, expense_electricity, expense_salaries, expense_packaging, expense_repairs, expense_other]
            .reduce((total, expense) => total + parseNum(expense), 0);
        const totalCostOfGoodsSold = parseNum(buying_price) * totalLitersSold;

        // Calculate the remaining current/closing stock
        const currentStock = totalAvailableStock - totalLitersSold;

        const values = [
            record_date, branch_name, parseNum(buying_price), oldStockNum, newStockAddedNum,
            liters1500, liters1600, liters1700, liters1750, liters1800, liters1850,
            liters1900, liters1950, liters2000, liters2200,
            parseNum(expense_fuel), parseNum(expense_transport), parseNum(expense_electricity),
            parseNum(expense_salaries), parseNum(expense_packaging), parseNum(expense_repairs), parseNum(expense_other)
        ];

        const [result] = await pool.query(query, values);
        const [recordColumns] = await pool.query('SHOW COLUMNS FROM daily_milk_records');
        const generatedColumns = new Set(
            recordColumns
                .filter(column => String(column.Extra || '').toLowerCase().includes('generated'))
                .map(column => column.Field)
        );
        const derivedValues = {
            total_liters_sold: totalLitersSold,
            total_sales: totalSales,
            total_expenses: totalExpenses,
            total_cost_of_goods_sold: totalCostOfGoodsSold,
            closing_stock: currentStock,
            net_profit: totalSales - totalCostOfGoodsSold - totalExpenses
        };
        const storedDerivedValues = Object.entries(derivedValues)
            .filter(([column]) => !generatedColumns.has(column));

        if (storedDerivedValues.length > 0) {
            await pool.query(
                `UPDATE daily_milk_records SET ${storedDerivedValues.map(([column]) => `${column} = ?`).join(', ')} WHERE record_date = ? AND branch_name = ?`,
                [...storedDerivedValues.map(([, value]) => value), record_date, branch_name]
            );
        }

        res.status(201).json({ 
            message: "Daily record saved successfully!", 
            recordId: result.insertId,
            calculatedStock: currentStock
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get Dashboard Metrics for a specific date
app.get('/api/dashboard', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        res.json(await getDashboardRows(date));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/dashboard/:date', async (req, res) => {
    try {
        const { date } = req.params;
        res.json(await getDashboardRows(date));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get specific daily record
app.get('/api/milk-records/:date/:branch', async (req, res) => {
    try {
        const { date, branch } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM daily_milk_records WHERE record_date = ? AND branch_name = ? LIMIT 1`,
            [date, branch]
        );
        res.json(rows.length > 0 ? { ...rows[0], ...calculateRecordTotals(rows[0]) } : null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Analytics Summary — total volume + revenue with % change vs previous day
app.get('/api/analytics/summary', async (req, res) => {
    try {
        const { date, branch } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const prevDate = new Date(targetDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];

        const branchCond = branch && branch !== 'All' ? 'AND branch_name = ?' : '';
        const buildParams = (d) => branch && branch !== 'All' ? [d, branch] : [d];

        const [curRows] = await pool.query(
            `SELECT COALESCE(SUM(total_liters_sold),0) AS total_volume, COALESCE(SUM(total_sales),0) AS total_revenue FROM daily_milk_records WHERE record_date = ? ${branchCond}`,
            buildParams(targetDate)
        );
        const [prevRows] = await pool.query(
            `SELECT COALESCE(SUM(total_liters_sold),0) AS total_volume, COALESCE(SUM(total_sales),0) AS total_revenue FROM daily_milk_records WHERE record_date = ? ${branchCond}`,
            buildParams(prevDateStr)
        );

        const cur = curRows[0];
        const prev = prevRows[0];
        const volumeChange = prev.total_volume > 0
            ? Math.round(((cur.total_volume - prev.total_volume) / prev.total_volume) * 100)
            : null;
        const revenueChange = prev.total_revenue > 0
            ? Math.round(((cur.total_revenue - prev.total_revenue) / prev.total_revenue) * 100)
            : null;

        res.json({
            total_volume: Number(cur.total_volume),
            total_revenue: Number(cur.total_revenue),
            volume_change: volumeChange,
            revenue_change: revenueChange
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. 7-Day Trend — daily totals for last N days
app.get('/api/analytics/trend', async (req, res) => {
    try {
        const { date, branch, days = 7 } = req.query;
        const endDate = date || new Date().toISOString().split('T')[0];
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (parseInt(days) - 1));
        const startDateStr = startDate.toISOString().split('T')[0];

        const branchCond = branch && branch !== 'All' ? 'AND branch_name = ?' : '';
        const params = branch && branch !== 'All'
            ? [startDateStr, endDate, branch]
            : [startDateStr, endDate];

        const [rows] = await pool.query(
            `SELECT record_date, SUM(total_liters_sold) AS total_volume, SUM(total_sales) AS total_revenue
             FROM daily_milk_records
             WHERE record_date BETWEEN ? AND ? ${branchCond}
             GROUP BY record_date ORDER BY record_date ASC`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Recent Transactions — latest records for a given date
app.get('/api/analytics/transactions', async (req, res) => {
    try {
        const { date, branch, limit = 5 } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const branchCond = branch && branch !== 'All' ? 'AND branch_name = ?' : '';
        const params = branch && branch !== 'All'
            ? [targetDate, branch, parseInt(limit)]
            : [targetDate, parseInt(limit)];

        const [rows] = await pool.query(
            `SELECT branch_name, record_date, total_sales, total_liters_sold, new_stock, closing_stock
             FROM daily_milk_records
             WHERE record_date = ? ${branchCond}
             ORDER BY branch_name ASC LIMIT ?`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Range Records — fetch all records between startDate and endDate
app.get('/api/analytics/range-records', async (req, res) => {
    try {
        const { startDate, endDate, branch } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate are required" });
        }
        
        let query = `SELECT * FROM daily_milk_records WHERE record_date BETWEEN ? AND ?`;
        const params = [startDate, endDate];
        
        if (branch && branch !== 'All') {
            query += ` AND branch_name = ?`;
            params.push(branch);
        }
        
        query += ` ORDER BY record_date ASC, branch_name ASC`;
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =========================================================
// BRANCHES API
// =========================================================

// B1. Get all branch profiles
app.get('/api/branches', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM branch_profiles ORDER BY branch_name ASC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B2. Update a branch profile
app.put('/api/branches/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { manager_name, contact_phone, address, status, notes } = req.body;
        await pool.query(
            `UPDATE branch_profiles SET manager_name=?, contact_phone=?, address=?, status=?, notes=? WHERE branch_name=?`,
            [manager_name || '', contact_phone || '', address || '', status || 'Active', notes || '', name]
        );
        res.json({ message: 'Branch profile updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B3. Get all stock transfers (optionally filter by branch)
app.get('/api/stock-transfers', async (req, res) => {
    try {
        const { branch } = req.query;
        let query = `SELECT * FROM stock_transfers`;
        const params = [];
        if (branch && branch !== 'All') {
            query += ` WHERE from_branch = ? OR to_branch = ?`;
            params.push(branch, branch);
        }
        query += ` ORDER BY transfer_date DESC, created_at DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B4. Log a new stock transfer
app.post('/api/stock-transfers', async (req, res) => {
    try {
        const { from_branch, to_branch, liters, transfer_date, reason } = req.body;
        if (!from_branch || !to_branch || !liters || !transfer_date) {
            return res.status(400).json({ error: 'from_branch, to_branch, liters, and transfer_date are required.' });
        }
        if (from_branch === to_branch) {
            return res.status(400).json({ error: 'Source and destination branches must be different.' });
        }
        const [result] = await pool.query(
            `INSERT INTO stock_transfers (from_branch, to_branch, liters, transfer_date, reason) VALUES (?, ?, ?, ?, ?)`,
            [from_branch, to_branch, Number(liters), transfer_date, reason || '']
        );
        res.status(201).json({ message: 'Stock transfer logged.', transfer_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B5. Get all staff assignments
app.get('/api/branch-staff', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM branch_staff ORDER BY branch_name ASC, staff_name ASC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B6. Add a staff member to a branch
app.post('/api/branch-staff', async (req, res) => {
    try {
        const { branch_name, staff_name, role } = req.body;
        if (!branch_name || !staff_name) {
            return res.status(400).json({ error: 'branch_name and staff_name are required.' });
        }
        const [result] = await pool.query(
            `INSERT INTO branch_staff (branch_name, staff_name, role) VALUES (?, ?, ?)`,
            [branch_name, staff_name.trim(), role || 'Cashier']
        );
        res.status(201).json({ message: 'Staff member assigned.', staff_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B7. Remove a staff assignment
app.delete('/api/branch-staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM branch_staff WHERE staff_id = ?`, [id]);
        res.json({ message: 'Staff assignment removed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});