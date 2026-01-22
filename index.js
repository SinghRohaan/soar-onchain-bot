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
   CONSTANTS
====================== */

// SOAR deployer wallet (fee payer)
const SOAR_DEPLOYER = new PublicKey(
  "97Qy3dyZF4U2b3iqADnuptwu2M8D72UYB2tpSCQnhegR"
);

// SPL Token program (this emits InitializeMint logs)
const SPL_TOKEN_PROGRAM = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

// 🔑 Helius RPC (REQUIRED)
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=f4071dd5-0241-40ba-ab5f-0558e9efedc1";

/* ======================
   CONNECTION
====================== */

const connection = new Connection(RPC_URL, "processed");
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
          text: "Detected directly from Solana (Helius)"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  await axios.post(DISCORD_WEBHOOK, payload);
}

/* ======================
   CORE LISTENER (CORRECT)
====================== */

connection.onLogs(
  SPL_TOKEN_PROGRAM,
  async (logInfo) => {
    try {
      // Fast filter: only mint initializations
      const hasInitMint = logInfo.logs.some(log =>
        log.includes("InitializeMint")
      );
      if (!hasInitMint) return;

      // Fetch parsed transaction
      const tx = await connection.getParsedTransaction(
        logInfo.signature,
        { maxSupportedTransactionVersion: 0 }
      );
      if (!tx) return;

      // Fee payer check (SOAR filter)
      const feePayer =
        tx.transaction.message.accountKeys[0].pubkey.toBase58();

      if (feePayer !== SOAR_DEPLOYER.toBase58()) return;

      // Extract mint
      for (const ix of tx.transaction.message.instructions) {
        if (
          ix.program === "spl-token" &&
          ix.parsed?.type === "initializeMint"
        ) {
          const mint = ix.parsed.info.mint;

          if (seenMints.has(mint)) return;
          seenMints.add(mint);

          console.log("🆕 SOAR mint detected:", mint);
          await sendDiscordAlert(mint, logInfo.signature);
        }
      }
    } catch (err) {
      console.error("Error processing tx:", err.message);
    }
  },
  "processed"
);
