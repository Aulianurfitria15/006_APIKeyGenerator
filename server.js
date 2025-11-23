require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

function authRequired(req, res, next) {
    if (!req.session || !req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}


// Redirect root to login.html
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

// Register admin
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  db.query('INSERT INTO admins (email, password) VALUES (?, ?)', [email, password], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
});

// Login admin
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM admins WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length > 0) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// Generate API key & save user
app.post('/api/generate', (req, res) => {
  const { firstName, lastName, email } = req.body;
  const startDate = new Date().toISOString().slice(0, 10);
  db.query('INSERT INTO users (first_name, last_name, email, start_date) VALUES (?, ?, ?, ?)', [firstName, lastName, email, startDate], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    const userId = result.insertId;
    const apiKey = 'aulss15_' + Math.random().toString(36).substr(2, 24);
    const expiresAt = new Date(Date.now() + 24*60*60*1000*24).toISOString().slice(0, 10); // +24 hari
    db.query('INSERT INTO apikeys (api_key, status, user_id, user_email, expires_at) VALUES (?, ?, ?, ?, ?)', [apiKey, 'active', userId, email, expiresAt], (err2) => {
      if (err2) return res.status(500).json({ error: err2 });
      res.json({ apiKey });
    });
  });
});

// Get dashboard data
app.get('/api/dashboard', (req, res) => {
  db.query('SELECT * FROM users', (err, users) => {
    if (err) return res.status(500).json({ error: err });
    db.query('SELECT * FROM apikeys', (err2, apikeys) => {
      if (err2) return res.status(500).json({ error: err2 });
      res.json({ users, apikeys });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// ======================= FUNCTION QUERY =======================
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ======================= DELETE USER =======================
app.delete('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Hapus semua API key milik user dulu
    await query('DELETE FROM apikeys WHERE user_id = ?', [id]);
    
    // Baru hapus user
    await query('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus user' });
  }
});


// ======================= DELETE API KEY =======================
app.delete('/api/apikey/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM apikeys WHERE id = ?', [id]);
    res.json({ success: true, message: 'API Key deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus API key' });
  }
});
