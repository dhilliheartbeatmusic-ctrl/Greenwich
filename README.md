# Greenwich

Premium website for **Greenwich Global Institute of Hotel Management**, Visakhapatnam.

- Founder: **KOMARA GANAPATHI RAO**
- CEO: **LANDA DHILLESWARA RAO**
- Phone / WhatsApp: **+91 99676 25438**

## Included

- Responsive forest-green, ivory and gold website with original illustrative hospitality imagery.
- Institute, study areas, learning experience, career directions, leadership, admissions, fee guidance, FAQs and enquiry sections.
- Accessible navigation, keyboard-operable course dialogs, enquiry validation, call and WhatsApp links.
- Printable institute guide and privacy notice.
- Optional Node.js admissions backend with SQLite storage, enquiry references and duplicate-request protection.
- Password-protected staff dashboard with search, status filters, updates, deletion and CSV export.
- Staff editor for course titles, descriptions, topics, duration, eligibility, fees and the announcement.
- No third-party packages, analytics, remote fonts or external image dependencies.

## Choose your hosting mode

| Mode | Website | WhatsApp enquiries | Stored enquiries / admin |
| --- | --- | --- | --- |
| Static hosting: upload `public/` or `dist/` | Yes | Yes, visitor opens and sends the message | No |
| Node.js 24 hosting with a persistent disk | Yes | Direct link also available | Yes |

The frontend detects this project's admissions API. On static hosting it explicitly says **Continue on WhatsApp**, creates a message link, and never claims the enquiry has been submitted. On the Node server it says **Send admission enquiry** and only confirms after the database accepts the record. No SMS, email notification or automatic WhatsApp delivery service is configured.

## Local development

Use **Node.js 24 LTS**. No install step is required.

```bash
cp .env.example .env
# Edit .env for local use:
# NODE_ENV=development
# PUBLIC_ORIGIN=http://127.0.0.1:3000
# ADMIN_PASSWORD=<choose a unique password of at least 14 characters>
npm start
```

Open `http://127.0.0.1:3000`. The staff dashboard is at `/admin.html`. Do not put passwords in frontend files, commits or this README.

```bash
npm run check
npm test
npm run build
```

`npm run build` copies the public website into `dist/`. The backend is not needed for the static version. Opening `public/index.html` directly also works for browsing and preparing WhatsApp enquiries.

## Deploy to your domain

### Static / shared hosting

1. Copy the **contents** of `public/` into the domain's public document root, keeping `assets/` intact. Alternatively run `npm run build` and upload the contents of `dist/`.
2. Configure your domain's DNS using the exact records supplied by your host, and enable HTTPS.
3. Open the domain, check call / WhatsApp links, and submit a trial enquiry through WhatsApp yourself.
4. Static hosting does not run `server.mjs` or the staff dashboard. Use Node hosting if you need the database.

### Node.js hosting / VPS / Docker

1. Use Node.js 24 and run `npm start`, or build the provided Dockerfile.
2. Set `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT` as required by the host, `PUBLIC_ORIGIN=https://your-actual-domain` (no trailing slash) and a unique `ADMIN_PASSWORD` of at least 14 characters in the host's secret settings.
3. Mount a **persistent disk** and set `DATA_DIR` to it. In Docker, mount it at `/app/data` with write permission for the `node` user. Do not use an ephemeral serverless disk for enquiries.
4. Put the service behind an HTTPS reverse proxy. The production server uses Secure, HttpOnly, SameSite session cookies, so access it over HTTPS.
5. Leave `TRUST_PROXY=0` unless your trusted reverse proxy replaces the `X-Forwarded-For` header. Then set `TRUST_PROXY=1` for per-visitor rate limits. Never trust client-supplied forwarding headers.
6. Open `/admin.html`, sign in and complete one test enquiry before launch. Remove your own test record from the staff dashboard.
7. Back up the SQLite database with a SQLite-aware backup tool or while the server is stopped. Restrict database backups and CSV exports to authorised staff.

Production startup refuses an empty/short password or a missing HTTPS origin. Sessions expire after eight hours and after a restart. This is a single-instance staff dashboard, not a multi-tenant student/parent portal. Use one server instance with its persistent disk; add a managed database and shared sessions before horizontal scaling. No online fee payments are implemented.

### GitHub Pages (static only)

GitHub Pages serves static files; it does not run this Node server. You can deploy `dist/` with your chosen Pages workflow or publish the public files from a separate Pages branch. The `.nojekyll` file is included. Do not commit `.env`, database files, student enquiries or CSV exports. This package does not activate Pages or bind a domain automatically.

## Content you must confirm before public launch

- Current course names, qualifications, awarding body, eligibility, duration and complete fee structure.
- Full street address, campus visit timings, actual facility details and photographs.
- Any verified affiliations, approvals, hotel partnerships, internship arrangements and placement evidence.
- The institute's final privacy, retention and admissions policies, reviewed by its responsible staff.

No invented approvals, success statistics, testimonials, job promises, founder biographies or campus photos have been added. Study areas and career examples are explicitly introductory. The supplied city is shown without an invented street address or map pin.

Edit `public/index.html` for leadership, contact and page content. Edit `public/site-data.js` for default study areas. Staff changes are stored in SQLite on the Node deployment; they do not modify the source file or a separate static deployment. All user-supplied content is rendered as text, not HTML.

## Image asset

`public/assets/hospitality-hero.png` was generated with the built-in image generation tool for this website. It is illustrative and does not show the actual Greenwich campus or students. The reusable generation brief is in `ASSETS.md`. Replace it with approved real photography when available.

## Verification

Automated integration tests cover successful submission, validation, repeat requests, database persistence, authentication, CSRF checks, protected exports, spreadsheet formula neutralisation, status changes, deletion, logout and content editing. Responsive styles are implemented; a full browser visual QA pass is still recommended on the target host.

Official deployment references: [Node.js SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
