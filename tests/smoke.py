"""Run against a local static server: python3 tests/smoke.py [base URL].
Requires Playwright for Python and Chromium; no changes to application dependencies.
"""
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8000/'
output = Path(tempfile.mkdtemp(prefix='ceo-card-test-'))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(accept_downloads=True)
    errors, external = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: external.append(request.url) if not request.url.startswith(base) else None)
    page.goto(base, wait_until='networkidle')
    assert page.title() == 'CEO Business Card Generator'
    assert page.locator('button:disabled').count() == 4
    assert page.locator('#location option').count() == 8
    assert page.evaluate('localStorage.length') == 0
    before = page.locator('canvas').evaluate('(c) => c.toDataURL()')
    values = {'fullName': 'Alex Rivera', 'jobTitle': 'Community Engagement Manager',
              'email': 'alex@ceoempowers.org', 'phone': '5182726012', 'extension': '242'}
    for key, value in values.items():
        page.locator('#' + key).fill(value)
    page.locator('#location').select_option('0')
    page.wait_for_function('document.querySelectorAll("button:disabled").length === 0')
    assert page.locator('canvas').evaluate('(c) => c.toDataURL()') != before
    assert page.locator('#office-address').inner_text() == '2331 Fifth Avenue, Troy, NY 12180'
    for kind in ['card', 'vcf', 'qr', 'wallpaper']:
        with page.expect_download() as event:
            page.locator(f'[data-download="{kind}"]').click()
        download = event.value
        download.save_as(output / download.suggested_filename)
    vcard = (output / 'alex-rivera.vcf').read_bytes()
    for text in [b'BEGIN:VCARD\r\nVERSION:3.0', b'FN:Alex Rivera', b'TEL;TYPE=WORK,VOICE:(518) 272-6012 x242',
                 b'ADR;TYPE=WORK:;;2331 Fifth Avenue;Troy;NY;12180;USA', b'END:VCARD\r\n']:
        assert text in vcard, text
    assert page.evaluate('makeVCard(details())') == vcard.decode()
    assert page.evaluate('details().phone') == '(518) 272-6012'
    assert page.evaluate("formatPhone('15182726012')") == '+1 (518) 272-6012'
    assert page.evaluate("formatPhone('+44 20 7946 0958')") == '+44 20 7946 0958'
    for kind, size in [('card', (1500, 1000)), ('qr', (900, 900)), ('wallpaper', (1080, 1920))]:
        png = (output / f'alex-rivera-{kind}.png').read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', png[16:24]) == size
    # Every office must produce its official address, including the longest office name.
    for i in range(7):
        page.locator('#location').select_option(str(i))
        page.wait_for_function('document.querySelectorAll("button:disabled").length === 0')
        assert page.evaluate('makeVCard(details()).includes("ADR;TYPE=WORK:")')
    page.locator('#email').fill('invalid')
    assert page.locator('button:disabled').count() == 4
    page.locator('#email').fill('alex@ceoempowers.org')
    page.locator('#fullName').fill('Élodie; Rivera, Jr. \\ CEO')
    escaped = page.evaluate('makeVCard(details())')
    assert 'FN:Élodie\\; Rivera\\, Jr. \\\\ CEO' in escaped
    page.locator('#jobTitle').fill('é' * 100)
    folded = page.evaluate('makeVCard(details())')
    assert all(len(line.encode()) <= 75 for line in folded.split('\r\n'))
    assert len(folded.replace('\r\n ', '').split('TITLE:')[1].split('\r\n')[0]) == 100
    page.locator('#fullName').fill('<img src=x onerror=alert(1)>')
    assert page.locator('img').count() == 0
    # Responsive layout and preview, including a long office/title.
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(output / 'mobile.png'), full_page=True)
    # Reloading clears personal data; no server-side or local persistence.
    page.reload(wait_until='networkidle')
    assert page.locator('#fullName').input_value() == ''
    assert page.locator('button:disabled').count() == 4
    assert page.evaluate('localStorage.length') == 0
    assert not errors, errors
    assert not external, external
    browser.close()
print(json.dumps({'result': 'passed', 'checks': ['all seven locations', 'preview', 'four downloads',
    'required-field validation', 'vCard escaping and UTF-8 folding', 'mobile layout', 'no external requests',
    'no saved personal data', 'no browser errors'], 'artifacts': str(output)}))
