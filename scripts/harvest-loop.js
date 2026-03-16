#!/usr/bin/env node
/**
 * Continuously runs all 3 harvesters in parallel, restarting each when it
 * finishes a batch (they self-terminate after ~8 minutes to avoid memory leaks).
 *
 * Usage:
 *   node scripts/harvest-loop.js          # Run all 3 harvesters in loop
 *   node scripts/harvest-loop.js 1mg      # Run only 1mg
 *   node scripts/harvest-loop.js netmeds  # Run only netmeds
 *   node scripts/harvest-loop.js pharmeasy # Run only pharmeasy
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");

const HARVESTERS = {
  "1mg": {
    script: "scripts/harvest-1mg-sitemap.js",
    urlFile: "data/harvested/1mg-sitemap/_urls.json",
    productFile: "data/harvested/1mg-sitemap/_products.jsonl",
  },
  netmeds: {
    script: "scripts/harvest-netmeds-fast.js",
    urlFile: "data/harvested/netmeds-fast/_urls.json",
    productFile: "data/harvested/netmeds-fast/_products.jsonl",
  },
  pharmeasy: {
    script: "scripts/harvest-pharmeasy-sitemap.js",
    urlFile: "data/harvested/pharmeasy-sitemap/_urls.json",
    productFile: "data/harvested/pharmeasy-sitemap/_products.jsonl",
  },
};

function countLines(file) {
  try {
    const content = fs.readFileSync(file, "utf-8");
    return content.split("\n").filter(Boolean).length;
  } catch { return 0; }
}

function countUrls(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")).length;
  } catch { return 0; }
}

function runHarvester(name, config) {
  return new Promise((resolve) => {
    const startCount = countLines(config.productFile);
    const totalUrls = countUrls(config.urlFile);
    const pct = totalUrls > 0 ? ((startCount / totalUrls) * 100).toFixed(1) : "?";

    console.log(`\n[${new Date().toLocaleTimeString()}] Starting ${name}: ${startCount}/${totalUrls} (${pct}%)`);

    const child = spawn("node", [config.script, "--resume"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let lastLine = "";
    child.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.includes("%]") || line.includes("COMPLETE") || line.includes("ERROR")) {
          lastLine = line.trim();
          process.stdout.write(`  [${name}] ${lastLine}\n`);
        }
      }
    });

    child.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) process.stdout.write(`  [${name} ERR] ${msg}\n`);
    });

    child.on("close", (code) => {
      const endCount = countLines(config.productFile);
      const added = endCount - startCount;
      const newPct = totalUrls > 0 ? ((endCount / totalUrls) * 100).toFixed(1) : "?";
      console.log(`[${new Date().toLocaleTimeString()}] ${name} batch done: +${added} products (${endCount}/${totalUrls}, ${newPct}%) [exit ${code}]`);

      // Check if complete
      if (endCount >= totalUrls * 0.99 || added === 0) {
        console.log(`  ${name}: HARVEST COMPLETE or stalled`);
        resolve(true); // done
      } else {
        resolve(false); // needs more
      }
    });
  });
}

async function loop(names) {
  console.log("=".repeat(60));
  console.log("  CostMini Harvest Loop");
  console.log("  Harvesters:", names.join(", "));
  console.log("=".repeat(60));

  const active = new Map(names.map((n) => [n, HARVESTERS[n]]));

  let round = 0;
  while (active.size > 0) {
    round++;
    console.log(`\n--- Round ${round} (${active.size} active harvesters) ---`);

    // Run all active harvesters in parallel
    const results = await Promise.all(
      Array.from(active.entries()).map(async ([name, config]) => {
        const done = await runHarvester(name, config);
        return { name, done };
      })
    );

    // Remove completed harvesters
    for (const { name, done } of results) {
      if (done) active.delete(name);
    }

    if (active.size > 0) {
      console.log(`\nWaiting 5s before next round...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("ALL HARVESTERS COMPLETE");

  // Final stats
  for (const [name, config] of Object.entries(HARVESTERS)) {
    if (names.includes(name)) {
      const count = countLines(config.productFile);
      const total = countUrls(config.urlFile);
      console.log(`  ${name}: ${count}/${total} (${((count / total) * 100).toFixed(1)}%)`);
    }
  }
  console.log("=".repeat(60));
}

// Parse args
const arg = process.argv[2];
const names = arg ? [arg] : Object.keys(HARVESTERS);
for (const n of names) {
  if (!HARVESTERS[n]) {
    console.error(`Unknown harvester: ${n}. Options: ${Object.keys(HARVESTERS).join(", ")}`);
    process.exit(1);
  }
}

loop(names).catch(console.error);
