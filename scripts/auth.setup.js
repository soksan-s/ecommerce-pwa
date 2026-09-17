const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const BASE_URL = "https://ecommerce-pwa-murex.vercel.app";

const accounts = {
  admin: {
    output: "playwright/.auth/admin.json",
  },

  cashier: {
    output: "playwright/.auth/cashier.json",
  },

  customer: {
    output: "playwright/.auth/customer.json",
  },
};

async function askAccount() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\nWhich account do you want to authenticate? (admin/cashier/customer): ",
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase());
      }
    );
  });
}

async function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${message}\n\nPress ENTER when finished: `, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const accountName = await askAccount();

  if (!accounts[accountName]) {
    console.log(
      "\nInvalid account. Please use: admin, cashier, or customer."
    );

    process.exit(1);
  }

  const account = accounts[accountName];

  fs.mkdirSync(path.dirname(account.output), {
    recursive: true,
  });

  console.log(`\nOpening login page for ${accountName}...`);

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();

  const page = await context.newPage({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  await page.goto(`${BASE_URL}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("\n======================================");
  console.log(`LOGIN AS: ${accountName.toUpperCase()}`);
  console.log("======================================");

  await waitForEnter(
    "Log in normally in the browser.\n" +
      "Make sure you reach the correct dashboard/home page."
  );

  await context.storageState({
    path: account.output,
  });

  console.log(`\n✓ ${accountName} session saved:`);
  console.log(account.output);

  await browser.close();

  console.log("\nAuthentication setup completed.");
}

main().catch((error) => {
  console.error("\nAuthentication setup failed:");
  console.error(error);

  process.exit(1);
});