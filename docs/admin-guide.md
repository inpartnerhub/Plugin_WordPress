# Admin guide

For Inpartner website administrators. No technical background needed. Technical setup is in [deployment.md](deployment.md).

## What the assistant does

- Answers visitor questions about Inpartner using **only** the approved pages of inpartnerglobal.com.
- Shows the page(s) it used as clickable sources under each answer.
- When it is not sure, says so and offers a link to the contact page instead of guessing.
- Identifies itself as an AI assistant and shows a short disclaimer ("Not professional or investment advice").
- Does **not** give prices, client names, guarantees or personal investment advice unless they are published on the approved pages. Most of these are not.

## Where to find the settings

## Where to find the admin screens

The plugin provides three dedicated administration screens under the **WP Knowledge Chat** menu in the WordPress dashboard (accessible only by users with `manage_options` capability):

1. **WP Knowledge Chat → Settings**
2. **WP Knowledge Chat → Analytics & Leads**
3. **WP Knowledge Chat → Knowledge Base**

---

### 1. Settings Screen

Contains the general chatbot behavior, language settings, and AI backend connectivity test. Styled with Inpartner's corporate royal blue banner and real-time connection status pill.

| Setting | What it does | Tips |
|---|---|---|
| **Enable Chatbot** | Turns the chat button on or off for the whole site | Untick it to switch the assistant off immediately |
| **Greeting Messages** | The first message visitors see when they open the chat, one field per language (English, Bahasa Indonesia, 한국어) | Plain text only, max 500 characters each. Leave a field empty to restore that language's default greeting |
| **Default Language** | Language of the buttons and messages (English, Bahasa Indonesia or 한국어) when the visitor has not chosen one, and the language the assistant answers in | Content on the website stays in its original language; service names are not translated |
| **Language Switcher** | Shows EN · ID · 한국어 buttons in the chat header | The visitor's choice is remembered in their browser |
| **Browser Language** | Starts the chat in the visitor's browser language if it is English, Indonesian or Korean | Otherwise *Default Language* is used |
| **Contact URL** | Where "Contact the Inpartner team" links go | Default: the homepage, `https://inpartnerglobal.com`. Switching to a dedicated contact page (for example `/contact/`) needs the site owner's approval first. Only https links on inpartnerglobal.com (or this site) are accepted |

Click **Save Changes**. If a value is not accepted, a red message explains why and the old value is kept. With LiteSpeed Cache, the page cache is purged automatically when settings change; with any other page cache, **purge it** after saving so visitors see the change.

#### The "AI Backend" Status Box
- **Configured**: The connection constants (`WP_KNOWLEDGE_CHAT_BACKEND_URL`, `WP_KNOWLEDGE_CHAT_SHARED_SECRET`) are present in `wp-config.php`.
- **Test connection**: Runs a signed live health check against the AI backend. It verifies that the backend is reachable, the shared secret matches, and the knowledge base index is ready.
- If it says **Not configured** or the test fails, contact the technical team. The chat button stays hidden while it is not configured.

---

### 2. Analytics & Leads Screen

Provides high-level performance metrics, lead management, and content gap tracking:

- **Executive KPI Cards**: Real-time cards showing *Total Conversations*, *Grounded Answers Rate*, *Active Leads Captured*, and *Blocked Security Threats*.
- **Consultation Requests (Leads)**: When visitors request a consultation via the widget, their name, email, company, and message are stored safely in WordPress.
  - **Export CSV**: Download all leads for your sales or advisory team with one click.
  - **Lead Privacy**: Integrates automatically with WordPress core *Tools → Export Personal Data* and *Erase Personal Data*.
  - **Spam Protection**: Automatically discards disposable email addresses and honeypot submissions.
- **Unanswered Topics & Knowledge Gaps**: Shows queries where the assistant did not find sufficient evidence in the knowledge base. Use this table to decide which new services or explanations should be added to the website.
- **Security & Blocked Threats Counter**: Displays how many malicious prompt-injection, secret-extraction, or out-of-scope abuse attempts were safely intercepted before reaching AI models.

---

### 3. Knowledge Base Sync Screen

Lists all published Inpartner service pages approved for the assistant:
- Displays page title, URL, post ID, and synchronization timestamp.
- Allows administrators to trigger an on-demand sync of updated pages to the AI backend.
- Automatically handles trashed or unpublished pages so the assistant never quotes outdated or private content.

## Common tasks

**Switch the assistant off quickly.** Untick *Enable Chatbot*, save, and purge the cache. The rest of the website is not affected.

**Change the greeting.** Edit the field for that language under *Greeting Messages*, save, and purge the cache.

**Change the default language.** Set *Default Language* (for example to 한국어), save, and purge the cache. Suggested questions and the greeting follow the language automatically. Visitors who already picked a language with the switcher keep their choice.

**Offer only one language.** Untick *Language Switcher* and *Browser Language*; every visitor then sees *Default Language*.

**Admin screens in Indonesian or Korean.** Choose the language under *Users → Profile → Language* (or *Settings → General → Site Language*). The plugin's settings page is translated.

**Show it only on some pages.** This needs a small code snippet from the technical team (see the plugin's readme, "Can I show the widget only on some pages?").

**Update what the assistant knows.** The assistant does **not** read new pages automatically. After publishing or changing service pages, ask the technical team to rebuild the knowledge base ([knowledge-base.md](knowledge-base.md)). Review the text before it goes live.

## What visitors see

| Situation | What the visitor sees |
|---|---|
| Answer found | Answer text plus "Sources" with links to the pages used |
| Not enough information | "I couldn't find enough information… please contact the Inpartner team" plus the contact link |
| Too many questions in a minute | A request to wait a minute (limit: 6 questions per minute per visitor) |
| AI service unavailable | "The assistant is unavailable right now…", a **Try again** button and the contact link |

Conversations are not saved on the website. They disappear when the visitor closes the browser tab.

## Before launch: content to fix on the website

The assistant can only be as accurate as the website. These were found during setup (details in [knowledge-base.md](knowledge-base.md)):

1. Contact page: remove the placeholder phone number **(406) 555-0120** and the sentence "Ready to take control of your financial future?…".
2. The footer and the Contact page show **different phone numbers**. Keep one. Until you confirm the correct number, the assistant does not give out any phone number.
3. The **Cross-Border M&A Advisory** page is empty, so the assistant cannot explain this service yet.
4. Fix typos: "Start a Convertation", "Lear More", "Build for Companies".
