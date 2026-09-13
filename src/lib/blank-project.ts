import type { ProjectFile, ProjectKind } from "./schema";

/** Starter file tree so New website / game / app is immediately editable. */
export function blankWebFiles(kind: Extract<ProjectKind, "website" | "game" | "app">): ProjectFile[] {
  if (kind === "game") {
    return [
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Untitled game</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1>Untitled game</h1>
    <p class="hint">Click or tap the court to score. Ask Injaz to turn this into any game.</p>
    <canvas id="court" width="640" height="360" aria-label="Game court"></canvas>
    <p id="score">Score: 0</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
      },
      {
        path: "styles.css",
        content: `html, body { margin: 0; background: #11110f; color: #f4f1ea; font-family: system-ui, sans-serif; }
main { max-width: 680px; margin: 0 auto; padding: 24px 16px; }
h1 { font-size: 1.4rem; margin: 0 0 8px; }
.hint { color: #b8b0a2; font-size: 0.92rem; }
#court { width: 100%; height: auto; display: block; background: #1b1a17; border-radius: 12px; cursor: pointer; }
#score { font-variant-numeric: tabular-nums; }
`,
      },
      {
        path: "app.js",
        content: `const court = document.getElementById("court");
const scoreEl = document.getElementById("score");
const ctx = court.getContext("2d");
let score = 0;
let x = 80;
let y = 80;
function draw() {
  ctx.fillStyle = "#1b1a17";
  ctx.fillRect(0, 0, court.width, court.height);
  ctx.fillStyle = "#c4a265";
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
}
function move() {
  x = 40 + Math.random() * (court.width - 80);
  y = 40 + Math.random() * (court.height - 80);
  draw();
}
court.addEventListener("click", () => {
  score += 1;
  scoreEl.textContent = "Score: " + score;
  move();
});
draw();
`,
      },
    ];
  }

  if (kind === "app") {
    return [
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Untitled app</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1>Notes</h1>
    <form id="form">
      <input id="input" type="text" placeholder="Add a note" autocomplete="off" />
      <button type="submit">Add</button>
    </form>
    <ul id="list"></ul>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
      },
      {
        path: "styles.css",
        content: `html, body { margin: 0; background: #11110f; color: #f4f1ea; font-family: system-ui, sans-serif; }
main { max-width: 420px; margin: 0 auto; padding: 28px 16px; }
h1 { font-size: 1.35rem; }
form { display: flex; gap: 8px; }
input, button { font: inherit; border-radius: 10px; border: 1px solid #3a372f; padding: 10px 12px; }
input { flex: 1; background: #1b1a17; color: inherit; }
button { background: #c4a265; color: #16140f; border: 0; font-weight: 600; }
li { list-style: none; padding: 10px 0; border-bottom: 1px solid #2a271f; }
ul { padding: 0; }
`,
      },
      {
        path: "app.js",
        content: `const form = document.getElementById("form");
const input = document.getElementById("input");
const list = document.getElementById("list");
const notes = JSON.parse(localStorage.getItem("notes") || "[]");
function render() {
  list.innerHTML = notes.map((n) => "<li>" + n.replace(/[<>]/g, "") + "</li>").join("");
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  notes.unshift(text);
  localStorage.setItem("notes", JSON.stringify(notes));
  input.value = "";
  render();
});
render();
`,
      },
    ];
  }

  return [
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Untitled site</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <strong>Untitled site</strong>
    <nav><a href="#about">About</a></nav>
  </header>
  <main>
    <h1>Start here</h1>
    <p>A blank page you can edit, or ask Injaz to rebuild into any site.</p>
    <section id="about">
      <h2>About</h2>
      <p>Replace this copy with your story.</p>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
    },
    {
      path: "styles.css",
      content: `html, body { margin: 0; background: #11110f; color: #f4f1ea; font-family: system-ui, sans-serif; }
header, main { max-width: 720px; margin: 0 auto; padding: 20px 16px; }
header { display: flex; justify-content: space-between; align-items: center; }
a { color: #c4a265; }
h1 { font-size: 2.2rem; letter-spacing: -0.03em; }
`,
    },
    {
      path: "app.js",
      content: `console.log("Untitled site ready");
`,
    },
  ];
}
