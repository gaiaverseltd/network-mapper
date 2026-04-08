/**
 * Nightly scheduled function: email users who have unread messages.
 * Runs at 3 AM daily (America/New_York).
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { sendEmailViaMailgun } = require("./email");

exports.nightlyUnreadMessagesEmail = onSchedule(
  {
    schedule: "0 3 * * *", // 3 AM every day (cron: min hour day month dow)
    timeZone: "America/New_York",
  },
  async () => {
    const db = admin.firestore();

    // 1. Get all unread messages
    const unreadSnapshot = await db
      .collection("messages")
      .where("read", "==", false)
      .get();

    if (unreadSnapshot.empty) {
      console.log("Nightly unread: no unread messages");
      return;
    }

    // 2. Group by recipient (toUid) -> count
    const unreadByUser = new Map();
    for (const doc of unreadSnapshot.docs) {
      const toUid = doc.data().toUid;
      if (toUid) {
        unreadByUser.set(toUid, (unreadByUser.get(toUid) || 0) + 1);
      }
    }

    if (unreadByUser.size === 0) {
      console.log("Nightly unread: no valid recipients");
      return;
    }

    // 3. For each recipient, get profile email and send if they have email
    const appUrl = process.env.GCLOUD_PROJECT
      ? `https://${process.env.GCLOUD_PROJECT}.web.app`
      : "https://accelnet.com";
    const messagesUrl = `${appUrl}/messages`;

    let sent = 0;
    for (const [uid, count] of unreadByUser) {
      if (count < 1) continue;

      try {
        const profileDoc = await db.collection("profiles").doc(uid).get();
        if (!profileDoc.exists) continue;

        const profile = profileDoc.data();
        const email = (profile.email || "").toString().trim();
        if (!email) continue;

        const name = (profile.name || profile.username || "there").toString().trim();
        const displayName = name === "there" ? "there" : name.split(/\s+/)[0];
        const subject = count === 1
          ? "You have 1 unread message on NetMap"
          : `You have ${count} unread messages on NetMap`;

        const html = `
          <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Hi ${displayName},</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">
              You have ${count === 1 ? "1 unread message" : count + " unread messages"} on NetMap.
            </p>
            <p style="margin-top: 24px;">
              <a href="${messagesUrl}" style="display: inline-block; padding: 12px 24px; background: #1d9bf0; color: white; text-decoration: none; border-radius: 9999px; font-weight: 600;">
                View messages
              </a>
            </p>
            <p style="margin-top: 32px; font-size: 13px; color: #888;">
              This is a daily reminder from NetMap. You can adjust your notification preferences in settings.
            </p>
          </div>
        `;

        await sendEmailViaMailgun({ to: email, subject, html });
        sent++;
        console.log(`Nightly unread: sent email to ${email} (${count} unread)`);
      } catch (err) {
        console.error(`Nightly unread: failed to email uid ${uid}:`, err.message);
      }
    }

    console.log(`Nightly unread: sent ${sent} emails to users with unread messages`);
  }
);
