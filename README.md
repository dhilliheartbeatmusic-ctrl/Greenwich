# Greenwich

Premium website for **Greenwich Global Institute of Hotel Management**, Visakhapatnam.

- Founder & CTO: **GK RAO**
- CEO: **LANDA DHILLESWARA RAO**
- Phone / WhatsApp: **+91 99676 25438**

## Included

- Responsive forest-green, ivory and gold website with the supplied Greenwich logo and GK RAO portrait.
- Photo-led course catalogue with filters, course detail dialogs and direct booking requests.
- Shore and ship career pathways, keyboard-accessible tabs and career enquiry forms.
- Institute, study areas, learning experience, career directions, leadership, admissions, fee guidance, FAQs and enquiry sections.
- Accessible navigation, keyboard-operable course dialogs, enquiry validation, call and WhatsApp links.
- Printable institute guide and privacy notice.
- Optional Node.js backend with SQLite storage, admission enquiries, course booking requests and career enquiries. Each request gets a reference with duplicate protection. Existing databases are migrated without dropping records.
- Course booking requests capture qualification, preferred month and contact details. Career enquiries capture qualification and Shore / Ship / Either preference. No payment or inventory reservation is implemented.
- Password-protected staff dashboard with search, status, request-type and career-direction filters, updates, deletion and CSV export including booking fields.
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

Production startup refuses an empty/short password or a missing HTTPS origin. Sessions expire after eight hours and after a restart. This is a single-instance staff dashboard, not a multi-tenant student/parent portal. Use one server instance with its persistent disk; add a managed database and shared sessions before horizontal scaling. No online fee payments are implemented. A booking is a request pending institute confirmation. There is no seat inventory, automatic allocation or job application to an employer. Staff may mark a request Confirmed after completing the official process. No automated messages are sent.

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

The supplied logo and GK RAO portrait are in `public/assets/greenwich-logo.png` and `public/assets/gk-rao.webp`. Course and career images were created using the built-in image generator and are clearly described as illustrative. They do not depict the actual campus, students, partners or employers. WebP versions are used to reduce loading time. Asset provenance and generation briefs are in `ASSETS.md`.

## Verification

Automated integration tests cover successful submission, validation, repeat requests, database persistence, authentication, CSRF checks, protected exports, spreadsheet formula neutralisation, status changes, deletion, logout, content editing, booking validation, career directions, idempotency conflicts and upgrades of existing databases. Responsive styles are implemented for mobile, tablet and desktop. Browser visual QA was unavailable in the authoring environment; check the final domain on Android and desktop before launch.

Official deployment references: [Node.js SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Premium update

The public site now includes the provided Greenwich brand mark, GK RAO as Founder & CTO with the supplied portrait, and LANDA DHILLESWARA RAO as CEO. No CEO portrait was supplied, so that card uses initials. Supporting guide and privacy pages use the same branding.

On Node hosting, requests go into the protected staff dashboard at `/admin.html`. On static hosting, visitors prepare a WhatsApp request and must tap Send themselves. GitHub stores the source; a GitHub push alone does not start the backend or configure a live domain.
