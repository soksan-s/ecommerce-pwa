import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { cloudinary, getCloudinaryFolder } from "@/lib/cloudinary";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

/**
 * Python processing timeout (ms).
 * rembg model is ~176MB and only downloads once. After it is cached the script
 * finishes in ~3-8 seconds. Allow 2 min to handle first-run downloads.
 */
const PYTHON_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Cloudinary upload helper
// ---------------------------------------------------------------------------

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) { reject(error); return; }
      resolve(result);
    });
    stream.end(buffer);
  });
}

/**
 * Build a Cloudinary delivery URL that applies FREE transformation effects
 * (no paid add-ons required). Used when Python enhancement is skipped.
 *
 * Available free effects: auto_contrast, vibrance, sharpen, brightness, auto quality.
 */
function buildEnhancedDeliveryUrl(publicId, cloudName) {
  return (
    `https://res.cloudinary.com/${cloudName}/image/upload` +
    `/e_auto_contrast,e_vibrance:25,e_sharpen:50,q_auto,f_auto` +
    `/${publicId}`
  );
}

// ---------------------------------------------------------------------------
// Python runner
// ---------------------------------------------------------------------------

async function runPythonAI(inputPath, outputPath, action, bgColor) {
  const scriptPath = path.join(process.cwd(), "ai-services", "process_image.py");

  if (!fs.existsSync(scriptPath)) {
    throw new Error("AI script missing: " + scriptPath);
  }

  const cmd = process.platform === "win32" ? "python" : "python3";

  const { stderr } = await execFileAsync(
    cmd,
    ["--input", inputPath, "--output", outputPath, "--action", action, "--bg_color", bgColor],
    { timeout: PYTHON_TIMEOUT_MS, env: { ...process.env }, cwd: process.cwd() },
    // pass scriptPath as first positional — prepend it:
  );

  if (stderr) console.warn("[AI] Python stderr:", stderr);
}

// ---------------------------------------------------------------------------
// POST /api/ai/process-image
// ---------------------------------------------------------------------------

export async function POST(request) {
  const admin = await requireAdminUser();
  if (!admin) return fail("Admin access required.", 403);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const action = formData.get("action") || "auto_magic"; // remove_bg | enhance | auto_magic
    const bgColor = formData.get("bgColor") || "transparent";

    if (!(file instanceof File)) {
      return fail("No image file provided.", 422);
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // -----------------------------------------------------------------------
    // Step 1 — Local Python AI (background removal via rembg / GrabCut,
    //           image enhancement via OpenCV + PIL)
    // -----------------------------------------------------------------------
    const tempDir = os.tmpdir();
    const ext = file.name ? path.extname(file.name) : ".jpg";
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempIn  = path.join(tempDir, `ai-in-${uid}${ext}`);
    const tempOut = path.join(tempDir, `ai-out-${uid}.png`);

    let processedBuffer = null;

    try {
      await fs.promises.writeFile(tempIn, inputBuffer);

      // Execute Python script (scriptPath must be the first argument)
      const scriptPath = path.join(process.cwd(), "ai-services", "process_image.py");
      const cmd = process.platform === "win32" ? "python" : "python3";

      const { stderr } = await execFileAsync(
        cmd,
        [scriptPath, "--input", tempIn, "--output", tempOut, "--action", action, "--bg_color", bgColor],
        { timeout: PYTHON_TIMEOUT_MS, cwd: process.cwd() },
      );

      if (stderr) console.warn("[AI] Python stderr:", stderr);

      if (fs.existsSync(tempOut)) {
        processedBuffer = await fs.promises.readFile(tempOut);
        console.log(`[AI] Python OK — action=${action}, output ${processedBuffer.length} bytes`);
      } else {
        console.warn("[AI] Python ran but wrote no output file.");
      }
    } catch (err) {
      console.error("[AI] Python failed:", err.message);
      if (err.stderr) console.error("[AI] Python stderr:", err.stderr);
    } finally {
      for (const p of [tempIn, tempOut]) {
        try { if (fs.existsSync(p)) await fs.promises.unlink(p); } catch (_) { /* ignore */ }
      }
    }

    // -----------------------------------------------------------------------
    // Step 2 — Upload to Cloudinary
    // -----------------------------------------------------------------------
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const hasCloudinary =
      cloudName &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (!hasCloudinary) {
      // No Cloudinary — return processed buffer or original as base64
      const buf = processedBuffer || inputBuffer;
      const mime = processedBuffer ? "image/png" : (file.type || "image/jpeg");
      return ok({
        data: {
          url: `data:${mime};base64,${buf.toString("base64")}`,
          processedBy: processedBuffer ? "python-ai-local" : "none",
          action,
          warning: "Cloudinary not configured — base64 returned.",
        },
      });
    }

    // Upload whichever buffer we have (processed preferred, original as fallback)
    const uploadBuf = processedBuffer || inputBuffer;
    const isPng = processedBuffer !== null; // Python always outputs PNG

    const uploadResult = await uploadBufferToCloudinary(uploadBuf, {
      folder: getCloudinaryFolder(),
      resource_type: "image",
      public_id: `product-ai-${uid}`,
      ...(isPng ? { format: "png" } : {}),
    });

    // -----------------------------------------------------------------------
    // Step 3 — Build final delivery URL
    // -----------------------------------------------------------------------
    let finalUrl = uploadResult.secure_url;
    let processedBy = "none";

    if (processedBuffer) {
      // Python succeeded — apply lightweight free Cloudinary quality optimisations
      processedBy = "python-ai";
      if (action === "enhance" || action === "auto_magic") {
        // Extra delivery-side sharpening + quality optimisation (free)
        finalUrl =
          `https://res.cloudinary.com/${cloudName}/image/upload` +
          `/e_sharpen:20,q_auto,f_auto/${uploadResult.public_id}`;
      }
    } else {
      // Python unavailable — use Cloudinary delivery transforms for enhancement
      processedBy = "cloudinary-transforms";
      if (action === "enhance" || action === "auto_magic") {
        finalUrl = buildEnhancedDeliveryUrl(uploadResult.public_id, cloudName);
      }
      // For remove_bg with no Python, we cannot do BG removal without a paid add-on
      // — inform the user and return the original image
      if (action === "remove_bg" || action === "auto_magic") {
        console.warn(
          "[AI] rembg model not ready yet — background removal skipped. " +
          "Run: python ai-services/download_model.py  to pre-cache the model.",
        );
      }
    }

    return ok({
      data: {
        url: finalUrl,
        publicId: uploadResult.public_id,
        processedBy,
        action,
        bgRemoved: processedBuffer !== null && action !== "enhance",
      },
    });

  } catch (error) {
    console.error("[AI] Route error:", error);
    return handleRouteError(error, "AI Image Processing failed.");
  }
}
