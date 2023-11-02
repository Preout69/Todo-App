const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

const dbFile = "./todo.db";

// Check if the database file exists, if not, create it
if (!fs.existsSync(dbFile)) {
  fs.closeSync(fs.openSync(dbFile, "w"));
}

// Create a SQLite database connection
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  } else {
    console.log("Connected to the SQLite database.");
    db.run("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, completed BOOLEAN, username TEXT, recurring TEXT)");
  }
});

// Get all todos for a specific user
app.get("/todos/user/:username", (req, res) => {
  console.log("/todos/:username");
  const { username } = req.params;
  db.all("SELECT * FROM todos WHERE username = ?", [username], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Search todos based on task, completion status, username, or recurrence
app.get("/todos/search", (req, res) => {
  console.log("/todos/search");
  const { username, task, completed, recurring } = req.query;

  let query = "SELECT * FROM todos WHERE 1=1";
  const params = [];

  if (username) {
    query += " AND username = ?";
    params.push(username);
  }
  if (task) {
    query += " AND task LIKE ?";
    params.push("%" + task + "%");
  }
  if (completed !== undefined) {
    query += " AND completed = ?";
    params.push(completed === "true");
  }
  if (recurring) {
    query += " AND recurring = ?";
    params.push(recurring);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post("/todos", (req, res) => {
  const { task, username, recurring } = req.body;

  if (!task || !username || !recurring) {
    res.status(400).json({ error: "Task, username, and recurring fields are mandatory." });
    return;
  }

  if (recurring !== "daily" && recurring !== "weekly" && recurring !== "one-time") {
    res.status(400).json({ error: "Recurring field must be daily, weekly, or one-time." });
    return;
  }

  const completed = req.body.completed !== undefined ? req.body.completed : false;

  db.run("INSERT INTO todos (task, completed, username, recurring) VALUES (?, ?, ?, ?)", [task, completed, username, recurring], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, task, completed, username, recurring });
  });
});

app.put("/todos/:id", (req, res) => {
  const { id } = req.params;
  const { task, completed, recurring, username } = req.body;

  let updateFields = [];
  let updateValues = [];

  if (task !== undefined) {
    updateFields.push("task = ?");
    updateValues.push(task);
  }

  if (completed !== undefined) {
    updateFields.push("completed = ?");
    updateValues.push(completed);
  }

  if (recurring !== undefined) {
    if (recurring !== "daily" && recurring !== "weekly" && recurring !== "one-time") {
      res.status(400).json({ error: "Recurring field must be daily, weekly, or one-time." });
      return;
    }
    updateFields.push("recurring = ?");
    updateValues.push(recurring);
  }

  if (username !== undefined) {
    updateFields.push("username = ?");
    updateValues.push(username);
  }

  if (updateFields.length === 0) {
    res.status(400).json({ error: "No fields to update provided." });
    return;
  }

  updateValues.push(id); // Add id for WHERE clause

  const updateQuery = `UPDATE todos SET ${updateFields.join(", ")} WHERE id = ?`;

  db.run(updateQuery, updateValues, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ id: id, task, completed, recurring, username });
  });
});

app.delete("/todos/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM todos WHERE id = ?", id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ message: "Todo not found" });
      return;
    }

    res.json({ message: "Todo deleted", changes: this.changes });
  });
});

const PORT = 2222;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
