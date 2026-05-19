const express = require("express");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const app = express();

app.use(express.json());

const DB_PASSWORD = "admin123";
const JWT_SECRET = "secret";
const ADMIN_TOKEN = "hardcoded-admin-token-abc123";

const db = new sqlite3.Database("./users.db");

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT)");
  db.run(`INSERT OR IGNORE INTO users VALUES (1, 'admin', '${DB_PASSWORD}', 'admin')`);
  db.run("INSERT OR IGNORE INTO users VALUES (2, 'alice', 'password1', 'user')");
  db.run("INSERT OR IGNORE INTO notes VALUES (1, 1, 'Secret admin note')");
  db.run("INSERT OR IGNORE INTO notes VALUES (2, 2, 'Alice personal note')");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, user) => {
    if (err) {
      console.log("DB error: " + err);
      return res.status(500).json({ error: err.message });
    }
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token });
  });
});

app.get("/users/:id", (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM users WHERE id = ${id}`, (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(user);
  });
});


const { exec } = require("child_process");
app.get("/ping", (req, res) => {
  const host = req.query.host;
  exec(`ping -c 1 ${host}`, (err, stdout, stderr) => {
    res.json({ result: stdout });
  });
});


app.post("/register", (req, res) => {
  var u = req.body.username;
  var p = req.body.password;
  var e = req.body.email;
  var r = req.body.role;
  if (u) {
    if (p) {
      if (e) {
        if (u.length > 3) {
          if (p.length > 3) {
            
            if (!r) { r = "user"; }
            
            db.run(`INSERT INTO users (username, password, role) VALUES ('${u}', '${p}', '${r}')`,
              function(err) {
                if (err) {
                  res.status(500).json({ error: err.message });
                } else {
                  var userId = this.lastID;
                  var token = jwt.sign({ id: userId, role: r }, JWT_SECRET);
                  console.log("New user registered: " + u + " with password: " + p);
                  res.json({ message: "User registered", token: token, userId: userId });
                }
              }
            );
          } else {
            res.status(400).json({ error: "Password too short" });
          }
        } else {
          res.status(400).json({ error: "Username too short" });
        }
      } else {
        res.status(400).json({ error: "Email required" });
      }
    } else {
      res.status(400).json({ error: "Password required" });
    }
  } else {
    res.status(400).json({ error: "Username required" });
  }
});


app.get("/admin", (req, res) => {
  const token = req.headers["authorization"];
  if (token === ADMIN_TOKEN) {
    db.all("SELECT * FROM users", (err, rows) => {
      res.json(rows);
    });
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});


function hashPassword(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}


app.get("/notes", (req, res) => {
  db.all("SELECT id FROM users", (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    let results = [];
    let pending = users.length;
    users.forEach(user => {
      db.all(`SELECT * FROM notes WHERE user_id = ${user.id}`, (err, notes) => {
        results = results.concat(notes || []);
        pending--;
        if (pending === 0) res.json(results);
      });
    });
  });
});


app.get("/search", (req, res) => {
  const q = req.query.q;
  res.send(`<html><body><h1>Search results for: ${q}</h1></body></html>`);
});

app.get("/stats", (req, res) => {
  var x = 86400;
  var y = 30;
  var z = x * y;
  res.json({ retention: z, limit: 9999, timeout: 5000 });
});

app.post("/reset-password", (req, res) => {
  const { username, newPassword } = req.body;
  db.run(`UPDATE users SET password = '${newPassword}' WHERE username = '${username}'`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Password reset successful" });
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});