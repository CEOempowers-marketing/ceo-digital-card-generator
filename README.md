# CEO Business Card Generator

A company-branded, self-service generator for Commission on Economic Opportunity employees. Hosted as a static site on GitHub Pages and linked from the intranet. No employee accounts, backend, database, or build step.

## Employee workflow

1. Enter your name, job title, work email, phone, and optional extension.
2. Select one of the seven official offices. Names and addresses match the CEO email signature generator.
3. Optionally choose a profile photo (JPG, PNG, or WebP up to 10 MB).
4. Review the preview and download a business card PNG, contact QR PNG, vCard (.vcf), or phone wallpaper.

The QR code encodes the **vCard contact details directly**, not a webpage URL. Recipients can scan it to add a contact, or open the shared .vcf file. Camera/contact support varies by phone; share the .vcf as a fallback. Extensions are included in the contact number and note; how they are imported or dialed depends on the contacts app. No employee contact pages are created.

Optional profile photos are processed locally, resized to at most 400 pixels on the longest side, and embedded as JPEG data in the downloaded .vcf file. They are not sent to a server, saved between visits, or included in the QR code or card/wallpaper images. To receive the photo, recipients must import the .vcf file; QR scanning transfers contact text only. Photo import support varies by contacts app.

Entries are processed in the browser and are not sent to a server or saved in browser storage. Reloading clears the form. The downloadable files contain the entered work information; share them deliberately. Updated information requires new downloads; already shared files do not update automatically.

## Run locally

```sh
cd /workspace/ceo-digital-card-generator
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the local server in a browser. No Node dependency installation is required for the site. `package.json` and its lockfile are retained from the previous generator; the website does not use its native Node dependencies. Its `npm test` script is an old placeholder, not the functional test runner.

## Validation

With the server running, and Python Playwright plus Chromium installed:

```sh
python3 tests/smoke.py
```

This exercises all seven offices, four actual downloads, vCard contents/escaping/UTF-8 folding, required fields, live preview, mobile layout, browser errors, external requests, absence of saved personal data, photo upload/removal, invalid-file handling, JPEG resizing, vCard photo embedding, and exclusion of photos from the QR code/card image. It prints the temporary artifact directory. A separate independent QR-decoder check was also used during development to compare exported QR payloads with the vCard. Before organization-wide release, scan a downloaded card with the phones your employees use to confirm their contact-import behavior.

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, **main**, **/ (root)**, and Save. No GitHub Actions build or secrets are needed. Once deployed, the intranet can link to:

https://ceoempowers-marketing.github.io/ceo-digital-card-generator/

The generator page is public. Employee entries do not become public web pages or get committed to this repository.

## Brand and office maintenance

- `locations.js`: the seven official location names and addresses.
- `assets/ceo-logo.png`: circular logo prepared from the supplied company logo. The tagline is drawn separately between the office address and website on the business card and near the bottom of the phone wallpaper.
- `styles.css` and `app.js`: fixed purple `#7B4198`, pink `#EA1956`, and gray `#35363A` brand treatment and export layouts.
- `vendor/qrcode.min.js`: locally hosted QRCode browser bundle, version 1.2.2, MIT licensed (see `vendor/qrcode-LICENSE.txt`). Local hosting removes the previous broken CDN dependency and avoids third-party script requests during form use.

The old generic generator, custom color picker, contact-page HTML export, and ZIP workflow have been replaced. Git history retains the previous version.
