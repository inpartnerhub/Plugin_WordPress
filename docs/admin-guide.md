# Admin guide

For Inpartner website administrators. No technical background needed. Technical setup is in [deployment.md](deployment.md); hooks and settings for developers are in [developer-reference.md](developer-reference.md). Written for plugin version 1.2.1.

## What the assistant does

- Answers visitor questions about Inpartner using **only** the approved Inpartner knowledge base (company profile and service pages).
- Shows the page(s) it used as clickable sources under each answer.
- Answers in the visitor's language: English, Bahasa Indonesia, 한국어, 日本語 or 简体中文.
- When it is not sure, says so and points the visitor to the Inpartner team instead of guessing.
- Offers a **Request Consultation** form when the conversation turns to a consultation, and sends the request to you.
- Identifies itself as an AI assistant and shows a short disclaimer ("AI can make mistakes. Please verify important information.").
- Does **not** give prices, client names, guarantees or personal investment, legal or tax advice unless they are in the approved content. Most of these are not.

## Where to find the admin screens

The **WP Knowledge Chat** menu in the WordPress dashboard has three screens, visible only to administrators (`manage_options`):

1. **Settings**: chatbot behaviour, languages, contact link and the AI backend status.
2. **Knowledge Base**: which website pages the assistant may use.
3. **Analytics & Leads**: usage figures, consultation requests and unanswered topics.

---

### 1. Settings

| Setting | What it does | Tips |
|---|---|---|
| **Enable Chatbot** | Turns the chat button on or off for the whole site | Untick it to switch the assistant off immediately |
| **Greeting Messages** | The first message visitors see, one field per language (English, Bahasa Indonesia, 한국어, 日本語, 简体中文) | Plain text only, max 500 characters each. Leave a field empty to restore that language's default greeting |
| **Default Language** | Language of the chat (buttons, messages and answers) when the visitor has not chosen one | Content of the knowledge base stays in its original language; service names are not translated |
| **Language Switcher** | Shows a globe dropdown (`🌐 EN ▾`) in the chat header | The visitor's choice is remembered in their browser |
| **Browser Language** | Starts the chat in the visitor's browser language if it is English, Indonesian, Korean, Japanese or Chinese (any Chinese region, e.g. `zh-TW`, starts in Simplified Chinese) | Otherwise *Default Language* is used |
| **Contact URL** | Where "Contact the Inpartner team" links go | Default: the homepage, `https://inpartnerglobal.com`. Only https links on inpartnerglobal.com, inpartner.id, this site or WhatsApp (`wa.me`) are accepted |

Click **Save Changes**. If a value is not accepted, a red message explains why and the old value is kept. With LiteSpeed Cache, the page cache is purged automatically when settings change; with any other page cache, **purge it** after saving so visitors see the change.

#### The "AI backend" status box

- **Configured**: the connection details (`WP_KNOWLEDGE_CHAT_BACKEND_URL`, `WP_KNOWLEDGE_CHAT_SHARED_SECRET`) are in `wp-config.php`. They are never shown on screen.
- **Test connection**: checks that the AI backend is reachable, accepts the shared secret, and has its knowledge base loaded.
- **Not configured** or a failed test: contact the technical team. The chat button stays hidden while the backend is not configured.

---

### 2. Knowledge Base

Lists the site's published pages so you can choose which ones the assistant may use.

- **Sync Selected Pages** / **Sync All Eligible Pages** send the chosen pages to the AI backend. *Replace entire backend knowledge base* also removes pages you did not select.
- After a page is synced, **edits are sent automatically**. Unpublishing, trashing, password-protecting or deleting it removes it from the assistant. **New pages are never added automatically**; sync them here.
- Password-protected pages are never used.
- If an automatic update fails (for example, the backend is down), a notice lists the pages and retries every few minutes; **Retry now** tries immediately.
- Syncing needs the separate `WP_KNOWLEDGE_CHAT_INDEX_API_TOKEN` in `wp-config.php` (without it the screen shows **Sync not ready**) and a backend that can store updates. A serverless backend (Vercel, Netlify) refuses updates, so there the technical team changes the knowledge base instead ([knowledge-base.md](knowledge-base.md)).

---

### 3. Analytics & Leads

**Summary cards**

| Card | Meaning |
|---|---|
| Total Conversations | Questions asked by visitors |
| Answered from Knowledge | Answers backed by the knowledge base (with the percentage) |
| Consultation Fallbacks | Questions the assistant could not answer and passed to the team |
| Captured Leads | Consultation requests received |
| Threats & Spam Blocked | Honeypot hits, disposable e-mails and abuse or rate limits |

**Captured Consultation Leads**

Each request shows:

| Column | Contents |
|---|---|
| Date (UTC) | Date, with the time underneath |
| Contact details | Name, with the e-mail address underneath (click it to write back) |
| Company / Role | Company, with job title · function underneath |
| Inquiry Message | The visitor's message. Long messages are shortened; click **Show more** to read all of it |
| Notification | Whether the notification e-mail was **Sent** or **Failed** |
| Delete | Deletes that one request permanently |

Buttons above the table:

- **Export CSV**: downloads every request (columns: date, name, email, company, job_title, department, message, language, notification). The function is exported as a short key such as `bizdev` or `finance`.
- **Delete all leads**: permanently deletes every request. Export first if you need them.
- **Reset metrics**: clears the conversation counts and the question lists. Leads and the *Captured Leads* count are not affected.

New requests are also e-mailed to the site's admin e-mail address. If an e-mail fails, the request is still saved and shows **Failed**.

**Recent Visitor Questions** shows the last 25 questions with e-mail addresses, phone numbers, links and long numbers removed, and whether they were answered from the knowledge base.

**Knowledge Gaps & Unanswered Topics** lists questions the assistant could not answer. Use it to decide what content to add to the website and the knowledge base.

#### Privacy of consultation requests

- Requests are visible only to administrators and are never published.
- They are kept until you delete them, unless the technical team sets a retention period.
- To answer a visitor's privacy request, use WordPress **Tools → Export Personal Data** or **Erase Personal Data** with their e-mail address; consultation requests are included.
- Settings → Privacy → Policy Guide contains suggested wording about the assistant and the consultation form for the site's privacy policy.

## How the consultation form works for visitors

The **Request Consultation** button appears under an answer when:

- the visitor asks for a consultation, a meeting, a price or a proposal, or asks how to contact the team (in any of the five languages);
- the answer itself suggests contacting the Inpartner team; or
- the assistant could not answer the question.

When the visitor asks for a consultation, the form **opens by itself** (once per visit) with their question already filled in. The form asks for name and work e-mail (required), and company, job title, function and the inquiry (optional). Function is a list: Owner / Founder, C-level / Director, Business Development / Strategy, Sales & Marketing, Finance / Investment, Operations / Supply Chain, Human Resources, Legal / Compliance, Other.

Spam protection: disposable e-mail addresses are refused, bots are caught by a hidden field, an identical request sent twice within 10 minutes is stored once, and each visitor can send 3 requests per 10 minutes (30 per hour for the whole site).

## Common tasks

**Switch the assistant off quickly.** Untick *Enable Chatbot*, save, and purge the cache. The rest of the website is not affected.

**Change the greeting.** Edit the field for that language under *Greeting Messages*, save, and purge the cache.

**Change the default language.** Set *Default Language* (for example to 한국어), save, and purge the cache. Suggested questions and the greeting follow the language automatically. Visitors who already picked a language with the switcher keep their choice.

**Offer only one language.** Untick *Language Switcher* and *Browser Language*; every visitor then sees *Default Language*.

**Admin screens in Indonesian, Korean, Japanese or Simplified Chinese.** Choose the language under *Users → Profile → Language* (or *Settings → General → Site Language*).

**Show it only on some pages.** This needs a small code snippet from the technical team ([developer-reference.md](developer-reference.md), `wp_knowledge_chat_should_load`).

**Send lead e-mails to someone else.** Ask the technical team to set the `wp_knowledge_chat_lead_notification_email` filter, or change the site's admin e-mail under *Settings → General*.

**Update what the assistant knows.** The assistant does **not** read new pages by itself. After publishing or changing content, sync the page on the *Knowledge Base* screen if syncing is available, or ask the technical team to rebuild the knowledge base ([knowledge-base.md](knowledge-base.md)). Review the text before it goes live.

**Update the plugin.** New versions appear under *Dashboard → Updates* like any other plugin. Read the "Upgrade Notice", update, then purge the page cache.

## What visitors see

| Situation | What the visitor sees |
|---|---|
| Answer found | Answer text plus "Sources" with links to the pages used |
| Visitor asks for a consultation or price | Answer, the **Request Consultation** button, and the form opened with their question |
| Not enough information | A friendly message that the assistant focuses on Inpartner's services, the **Request Consultation** button and the contact link |
| Too many questions in a minute | A request to wait a minute (limit: 6 questions per minute per visitor) |
| AI service unavailable | "The assistant is unavailable right now…", a **Try again** button and the contact link |
| Consultation request sent | "Thank you! Your consultation request has been sent to the Inpartner team." |

Conversations are not saved on the website. They stay in the visitor's browser tab and disappear when it is closed. Only consultation requests are stored.

## Website content to keep consistent

The assistant can only be as accurate as its content, and every answer links to a page on the website. Items still open on 2026-10-16 (phone number, contact page placeholders, figures that are only in the company profile) are listed in [site-content-request.md](site-content-request.md).
