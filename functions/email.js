/**
 * Email Notification Service (Mailgun API)
 * https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

const MAILGUN_API_KEY = defineString("MAILGUN_API_KEY");
const MAILGUN_DOMAIN = defineString("MAILGUN_DOMAIN", {
  default: "sandbox25e3e4eff380415ba1f48111d617ca82.mailgun.org",
});
const MAILGUN_FROM_EMAIL = defineString("MAILGUN_FROM_EMAIL", {
  default: "Accel Net <mailgun@sandbox25e3e4eff380415ba1f48111d617ca82.mailgun.org>",
});
const MAILGUN_BASE_URL = defineString("MAILGUN_BASE_URL", { default: "https://api.mailgun.net" });

async function sendEmailViaMailgun(payload) {
  const apiKey = MAILGUN_API_KEY.value();
  const domain = MAILGUN_DOMAIN.value();
  const fromEmail = MAILGUN_FROM_EMAIL.value();
  const baseUrl = MAILGUN_BASE_URL.value();

  if (!apiKey) {
    throw new Error("MAILGUN_API_KEY not set. Run: pnpm run set-functions-config");
  }

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const url = `${baseUrl.replace(/\/$/, "")}/v3/${domain}/messages`;

  const params = new URLSearchParams();
  params.append("from", fromEmail);
  params.append("to", payload.to);
  params.append("subject", payload.subject || "Notification from Accel Net");
  params.append("text", payload.text || (payload.html ? payload.html.replace(/<[^>]*>/g, "") : ""));
  if (payload.html) params.append("html", payload.html);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mailgun API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  return { messageId: result.id || `mailgun-${Date.now()}` };
}

exports.sendEmailViaMailgun = sendEmailViaMailgun;

exports.sendNotificationEmail = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject) {
      res.status(400).json({ error: "Missing required fields: to, subject" });
      return;
    }

    const info = await sendEmailViaMailgun({ to, subject, html, text });

    console.log("Email sent successfully via Mailgun:", info.messageId);
    res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send email",
    });
  }
});

exports.sendNotificationEmailCallable = onCall({ invoker: "public" }, async (request) => {
  try {
    const { to, subject, html, text } = request.data;

    if (!to || !subject) {
      throw new HttpsError("invalid-argument", "Missing required fields: to, subject");
    }

    const info = await sendEmailViaMailgun({ to, subject, html, text });

    console.log("Email sent successfully via Mailgun:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new HttpsError("internal", error.message || "Failed to send email");
  }
});
