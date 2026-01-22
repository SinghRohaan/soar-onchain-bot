import axios from "axios";
import fs from "fs";

/* ======================
   ENV CHECK
====================== */

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
if (!DISCORD_WEBHOOK) {
  console.error("❌ DISCORD_WEBHOOK not set");
  process.exit(1);
}

/* ======================
   CONFIG
====================== */

const SOAR_API =
  "https://api.launchonsoar.com/app/projects/curated?limit=10&sortBy=createdAt&sortDirection=desc";

const POLL_INTERVAL = 5_000; // 5 seconds
const SEEN_FILE = "seen.json";

/* ======================
   SEEN CACHE
====================== */

let seen = new Set();

if (fs.existsSync(SEEN_FILE)) {
  seen = new Set(JSON.parse(fs.readFileSync(SEEN_FILE)));
}

/* ======================
   DISCORD ALERT
====================== */

async function sendDiscordAlert(project) {
  const payload = {
    content: `<@${282852614947864576}>`, // 👈 THIS TAGS YOU
    username: "SOAR Curated Alerts",
    embeds: [
      {
        title: "✅ New SOAR Curated Project",
        color: 0x2ecc71,
        fields: [
          {
            name: "Project",
            value: project.name || project.slug || "Unknown",
            inline: false
          },
          {
            name: "Category",
            value: project.category || "—",
            inline: true
          },
          {
            name: "View",
            value: `[Open on SOAR](https://app.launchonsoar.com/project/${project.slug})`,
            inline: false
          }
        ],
        footer: {
          text: "SOAR Curated / Verified"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  await axios.post(DISCORD_WEBHOOK, payload);
}


/* ======================
   POLLER
====================== */

async function poll() {
  try {
    const res = await axios.get(SOAR_API);
    const projects = res.data?.data || res.data || [];

    for (const project of projects) {
      const id = project.id || project.slug;
      if (!id) continue;

      if (seen.has(id)) continue;

      seen.add(id);
      fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));

      console.log("✅ New curated project:", id);
      await sendDiscordAlert(project);
    }
  } catch (err) {
    console.error("Error polling SOAR:", err.message);
  }
}

/* ======================
   START
====================== */

console.log("🚀 Listening for SOAR curated projects...");
setInterval(poll, POLL_INTERVAL);
