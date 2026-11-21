const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL. Configure a PostgreSQL connection string in the hosting environment.");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("Missing/weak SESSION_SECRET. Set a random secret of at least 32 characters.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase hosted PostgreSQL requires SSL. This setting is suitable for its hosted endpoint.
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const episodes = JSON.parse(fs.readFileSync(path.join(__dirname, "episodes.json"), "utf8"));

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (LOWER(username))`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id TEXT NOT NULL,
      watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(user_id, episode_id)
    )
  `);
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "سجّل الدخول الأول." });
  next();
}
function validUsername(s) {
  return typeof s === "string" && /^[A-Za-z0-9_.-]{3,24}$/.test(s);
}

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body || {};
    if (!validUsername(username)) return res.status(400).json({ error: "اسم المستخدم من 3 إلى 24 حرفًا/رقمًا، ويسمح بـ . _ -" });
    if (typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ error: "كلمة المرور لازم تكون 8 أحرف على الأقل." });
    if (password !== confirmPassword) return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users(username, password_hash) VALUES($1, $2) RETURNING id, username",
      [username, hash]
    );
    req.session.userId = result.rows[0].id;
    req.session.username = result.rows[0].username;
    res.json({ ok: true, username: result.rows[0].username });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل." });
    console.error("Registration error:", e);
    res.status(500).json({ error: "تعذر إنشاء الحساب، جرّب مرة أخرى." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "اكتب اسم المستخدم وكلمة المرور." });
    const result = await pool.query("SELECT id, username, password_hash FROM users WHERE LOWER(username)=LOWER($1)", [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ ok: true, username: user.username });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "حصلت مشكلة أثناء تسجيل الدخول." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "تعذر تسجيل الخروج." });
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});
app.get("/api/me", auth, (req, res) => res.json({ username: req.session.username }));
app.get("/api/progress", auth, async (req, res) => {
  try {
    const rows = await pool.query("SELECT episode_id FROM watched WHERE user_id=$1", [req.session.userId]);
    res.json({ watched: rows.rows.map(x => x.episode_id) });
  } catch (e) {
    console.error("Progress read error:", e);
    res.status(500).json({ error: "تعذر تحميل تقدم المشاهدة." });
  }
});
app.put("/api/progress/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!episodes.some(e => e.id === id)) return res.status(404).json({ error: "الحلقة غير موجودة." });
    if (req.body && req.body.watched) {
      await pool.query("INSERT INTO watched(user_id, episode_id) VALUES($1, $2) ON CONFLICT DO NOTHING", [req.session.userId, id]);
    } else {
      await pool.query("DELETE FROM watched WHERE user_id=$1 AND episode_id=$2", [req.session.userId, id]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Progress update error:", e);
    res.status(500).json({ error: "تعذر حفظ تقدم المشاهدة." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`The Supernatural World running on port ${PORT}`));
  })
  .catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
