/**
 * Firebase Cloud Functions for Accel Net (2nd gen)
 *
 * - Email Notification Service (Inboxroad API)
 * - Nightly unread messages email (3 AM daily)
 * - Search analytics (record search requests)
 *
 * Config uses params (not deprecated functions.config).
 * Values come from functions/.env.{projectId} - set via: pnpm run set-functions-config
 *
 * SETUP:
 * 1. cp functions-config.example.json functions-config.json and fill in values
 * 2. pnpm run set-functions-config   (writes .env for params)
 * 3. firebase deploy --only functions
 */

const admin = require("firebase-admin");

admin.initializeApp();

const email = require("./email");
const analytics = require("./analytics");
const nightlyUnreadMessages = require("./nightlyUnreadMessages");
const adminUsers = require("./adminUsers");
const { suggestSearchFilters, suggestSearchFiltersHttp } = require("./suggestSearchFilters");

exports.sendNotificationEmail = email.sendNotificationEmail;
exports.sendNotificationEmailCallable = email.sendNotificationEmailCallable;

exports.nightlyUnreadMessagesEmail = nightlyUnreadMessages.nightlyUnreadMessagesEmail;

exports.recordSearch = analytics.recordSearch;

exports.adminCreateUser = adminUsers.adminCreateUser;

exports.suggestSearchFilters = suggestSearchFilters;
exports.suggestSearchFiltersHttp = suggestSearchFiltersHttp;
