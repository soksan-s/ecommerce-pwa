/**
 * OTP Provider abstraction for Better Auth migration.
 * Supports switching between providers using process.env.OTP_PROVIDER
 */

/**
 * Sends a 6-digit OTP to the specified phone number.
 * @param {string} phone The user's phone number
 * @param {string} code The 6-digit OTP
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
export async function sendOTP(phone, code) {
  const provider = process.env.OTP_PROVIDER || "console";

  try {
    switch (provider) {
      case "console":
        // Console provider for development mode
        console.log("==========================================");
        console.log(`[OTP CONSOLE] Action: Send Verification Code`);
        console.log(`[OTP CONSOLE] To: ${phone}`);
        console.log(`[OTP CONSOLE] Code: ${code}`);
        console.log("==========================================");
        return true;

      case "twilio":
        // Placeholder for Twilio integration
        // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
        // await client.messages.create({ body: `Your verification code is ${code}`, from: process.env.TWILIO_PHONE, to: phone });
        console.log(`[OTP TWILIO] Simulated sending to ${phone}`);
        return true;

      case "vonage":
        // Placeholder for Vonage integration
        console.log(`[OTP VONAGE] Simulated sending to ${phone}`);
        return true;

      default:
        console.error(`[OTP ERROR] Unknown provider: ${provider}`);
        return false;
    }
  } catch (error) {
    console.error(`[OTP ERROR] Failed to send OTP via ${provider}:`, error);
    return false;
  }
}

/**
 * Generates a random 6-digit OTP.
 * @returns {string} The 6-digit string
 */
export function generateOTPCode() {
  // Generate a random number between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}
