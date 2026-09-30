// A day before a free trial ends, email the institution once, unless it has already subscribed.
const { sendTrialReminderEmail } = require('./mailer');
const { quoteFor, formatMoney } = require('./currency');
const { plans } = require('./subscription');

const HOUR = 60 * 60 * 1000;
const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function start({ data, save }) {
  async function check() {
    for (const user of data.users) {
      if (user.role !== 'institution' || user.status !== 'verified' || user.plan !== 'trial' || !user.trialEndsAt || user.trialReminderSentAt) continue;
      const left = Date.parse(user.trialEndsAt) - Date.now();
      if (left <= 0 || left > 24 * HOUR) continue;
      // A trial of a day or less has no separate "tomorrow" to warn about.
      if (user.verifiedAt && Date.parse(user.trialEndsAt) - Date.parse(user.verifiedAt) <= 24 * HOUR) continue;
      user.trialReminderSentAt = new Date().toISOString(); // claimed first so it can never go out twice
      save();
      try {
        const quote = await quoteFor(user.country);
        const students = data.students.filter((item) => item.institutionId === user.id).length;
        const staff = data.staff.filter((item) => item.institutionId === user.id).length;
        await sendTrialReminderEmail(user.email, user.name, user.institutionName, { endsAt: dateLabel(user.trialEndsAt), students, staff, price: formatMoney(quote.convert(plans()[0].price), quote.currency) });
      } catch (error) {
        console.error('Trial reminder failed:', error.message);
        delete user.trialReminderSentAt; // try again on the next check, until the trial ends
        save();
      }
    }
  }
  const timer = setInterval(() => check().catch((error) => console.error('Reminder check failed:', error.message)), 30 * 60 * 1000);
  timer.unref();
  setTimeout(() => check().catch((error) => console.error('Reminder check failed:', error.message)), 20 * 1000).unref();
}

module.exports = { start };
