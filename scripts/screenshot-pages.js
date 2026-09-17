const { chromium } = require("playwright");
const fs = require("fs");

const BASE_URL = "https://ecommerce-pwa-murex.vercel.app";

const screenshotGroups = {
  admin: {
    auth: "playwright/.auth/admin.json",

    pages: [
      {
        name: "01-dashboard",
        path: "/admin/dashboard",
      },
      {
        name: "02-product-management",
        path: "/admin/product-management",
      },
      {
        name: "03-inventory-management",
        path: "/admin/inventory",
      },
      {
        name: "04-order-management",
        path: "/admin/order-management",
      },
      {
        name: "05-sales-report",
        path: "/admin/sales-report",
      },
    ],
  },

  pos: {
    auth: "playwright/.auth/cashier.json",

    pages: [
      {
        name: "01-pos-dashboard",
        path: "/pos",
      },
      {
        name: "02-new-sale",
        path: "/pos/new-sale",
      },
      {
        name: "03-pos-products",
        path: "/pos/products",
      },
      {
        name: "04-pos-orders",
        path: "/pos/orders",
      },
      {
        name: "05-pos-reports",
        path: "/pos/reports",
      },
    ],
  },

  customer: {
    auth: "playwright/.auth/customer.json",

    pages: [
      {
        name: "01-home",
        path: "/client",
      },
      {
        name: "02-product-list",
        path: "/client/product-list",
      },
      {
        name: "03-cart",
        path: "/client/cart",
      },
      {
        name: "04-checkout",
        path: "/client/checkout",
      },
      {
        name: "05-order-history",
        path: "/client/order-history",
      },
    ],
  },
};

async function captureGroup(browser, groupName, config) {
  console.log("\n======================================");
  console.log(`CAPTURING: ${groupName.toUpperCase()}`);
  console.log("======================================");

  if (!fs.existsSync(config.auth)) {
    console.log(`\n✗ Authentication file missing: ${config.auth}`);
    console.log(`Run the authentication setup for ${groupName} first.`);
    return;
  }

  const context = await browser.newContext({
    storageState: config.auth,

    viewport: {
      width: 1440,
      height: 900,
    },

    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const outputDirectory = `screenshots/${groupName}`;

  fs.mkdirSync(outputDirectory, {
    recursive: true,
  });

  for (const item of config.pages) {
    const url = `${BASE_URL}${item.path}`;

    console.log(`\n→ ${item.name}`);
    console.log(`  ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000,
      });

      // Give React/Next.js time to finish rendering.
      await page.waitForTimeout(2000);

      // Scroll through the page so lazy-loaded content has a chance to render.
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;

          const distance = 500;

          const timer = setInterval(() => {
            window.scrollBy(0, distance);

            totalHeight += distance;

            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);

              window.scrollTo(0, 0);

              resolve();
            }
          }, 100);
        });
      });

      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${outputDirectory}/${item.name}.png`,
        fullPage: true,
      });

      console.log(`  ✓ Saved`);
    } catch (error) {
      console.log(`  ✗ Failed`);
      console.log(`  ${error.message}`);
    }
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  for (const [groupName, config] of Object.entries(screenshotGroups)) {
    await captureGroup(browser, groupName, config);
  }

  await browser.close();

  console.log("\n======================================");
  console.log("ALL SCREENSHOTS COMPLETED");
  console.log("======================================");
}

main().catch((error) => {
  console.error("\nScreenshot process failed:");
  console.error(error);

  process.exit(1);
});