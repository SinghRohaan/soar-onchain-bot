import { Connection, PublicKey } from "@solana/web3.js";
import axios from "axios";

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

const SOAR_DEPLOYER = new PublicKey(
  "97Qy3dyZF4U2b3iqADnuptwu2M8D72UYB2tpSCQnhegR"
);

const RPC_URL = "https://api.mainnet-beta.solana.com";

/* ======================
   SOLANA CONNECTION
====================== */

const connection = new Connection(RPC_URL, "confirmed");
console.log("🚀 Listening for SOAR on-chain launches...");

/* ======================
   DUPLICATE PROTECTION
====================== */

const seenMints = new Set();

/* ======================
   DISCORD ALERT
====================== */

async function sendDiscordAlert(mint, signature) {
  const payload = {
    username: "SOAR Onchain Alerts",
    embeds: [
      {
        title: "🚀 New SOAR Launch (ON-CHAIN)",
        color: 0x14f195,
        fields: [
          {
            name: "Mint Address",
            value: `\`\`\`${mint}\`\`\``,
            inline: false
          },
          {
            name: "Transaction",
            value: `[View on Solscan](https://solscan.io/tx/${signature})`,
            inline: false
          }
        ],
        footer: {
          text: "Detected directly from Solana"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  await axios.post(DISCORD_WEBHOOK, payload);
}

/* ======================
   CORE LISTENER
====================== */

connection.onLogs(
  SOAR_DEPLOYER,
  async (logInfo) => {
    try {
      const signature = logInfo.signature;

      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) return;

      const instructions = tx.transaction.message.instructions;

      for (const ix of instructions) {
        if (
          ix.program === "spl-token" &&
          ix.parsed?.type === "initializeMint"
        ) {
          const mint = ix.parsed.info.mint;

          if (seenMints.has(mint)) return;
          seenMints.add(mint);

          console.log("🆕 SOAR mint detected:", mint);
          await sendDiscordAlert(mint, signature);
        }
      }
    } catch (err) {
      console.error("Error processing tx:", err.message);
    }
  },
  "confirmed"
);
