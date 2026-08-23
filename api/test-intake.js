/**
 * Unit tests for the form-intake validator. Run: node api/test-intake.js
 * No dependencies, no network, no side effects.
 */
'use strict';
const { validateIntake } = require('./server.js');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) { pass++; } else { fail++; console.log('  FAIL  ' + name + '\n        got ' + got + ', want ' + want); }
}
function accepts(name, kind, fields) {
  const r = validateIntake(kind, fields);
  check(name, r.ok, true);
  return r;
}
function rejects(name, kind, fields, expectStatus) {
  const r = validateIntake(kind, fields);
  check(name, r.ok, false);
  if (r.ok === false && expectStatus) check(name + ' (status)', r.status, expectStatus);
  return r;
}

const goodSample = {
  request_type: 'Sample pack', company: 'De Boer Webshop B.V.', contact_name: 'Sanne de Boer',
  email: 'sanne@deboerwebshop.nl', address: 'Keizersgracht 1, 1015 CJ Amsterdam, Netherlands',
  phone: '+31 20 555 0100', printer_model: 'HP LaserJet Pro M404', uses_nshift: 'Yes', notes: ''
};
const goodOrder = {
  company: 'Welkoop Retail B.V.', contact_name: 'Jan Visser', email: 'j.visser@welkoop.nl',
  vat: 'NL812345678B01', product: 'A5 Print & Ship EU', cases: '40',
  address: 'Apeldoorn, Netherlands', po_ref: 'PO-99123', notes: '', currency: 'EUR'
};
const goodContact = {
  request_type: 'Contact enquiry', company: 'STULZ GROEP B.V.', contact_name: 'Conny van Buuren',
  email: 'c.vanbuuren@stulz.nl', notes: 'Can we see the A4 format?'
};

console.log('THE DEFECT THIS EXISTS TO STOP');
rejects('completely empty POST (sample)', 'sample', {}, 400);
rejects('completely empty POST (order)',  'order',  {}, 400);
rejects('completely empty POST (contact)','contact',{}, 400);
rejects('all fields present but blank',   'sample',
  { request_type: '', company: '', contact_name: '', email: '', address: '' }, 400);
rejects('whitespace-only fields',         'sample',
  { request_type: '   ', company: '\t', contact_name: ' ', email: ' ', address: '  ' }, 400);

console.log('REAL SUBMISSIONS STILL GET THROUGH');
accepts('valid sample request',  'sample',  goodSample);
accepts('valid 50-sheet test',   'sample',  Object.assign({}, goodSample, { request_type: '50-count laser test pack' }));
accepts('valid paid order',      'order',   goodOrder);
accepts('valid contact enquiry', 'contact', goodContact);
accepts('order with no PO or notes', 'order', Object.assign({}, goodOrder, { po_ref: '', notes: '' }));
accepts('contact with no phone',  'contact', goodContact);

console.log('PARTIAL AND MALFORMED');
rejects('sample missing address',   'sample', Object.assign({}, goodSample, { address: '' }), 400);
rejects('sample missing email',     'sample', Object.assign({}, goodSample, { email: '' }), 400);
rejects('email is not an email',    'sample', Object.assign({}, goodSample, { email: 'not-an-email' }), 400);
rejects('email has no domain dot',  'sample', Object.assign({}, goodSample, { email: 'a@b' }), 400);
rejects('order with zero cases',    'order',  Object.assign({}, goodOrder, { cases: '0' }), 400);
rejects('order with negative cases','order',  Object.assign({}, goodOrder, { cases: '-5' }), 400);
rejects('order with junk cases',    'order',  Object.assign({}, goodOrder, { cases: 'lots' }), 400);
rejects('order with absurd cases',  'order',  Object.assign({}, goodOrder, { cases: '99999' }), 400);
rejects('order with bad VAT',       'order',  Object.assign({}, goodOrder, { vat: '12345' }), 400);
rejects('unknown form kind',        'wibble', goodSample, 404);
rejects('honeypot filled',          'sample', Object.assign({}, goodSample, { pp_hp: 'bot' }), 400);

console.log('SANITISING');
{
  const r = accepts('VAT with spaces and dashes is accepted', 'order',
    Object.assign({}, goodOrder, { vat: 'NL 8123-45678 B01' }));
  check('surrounding whitespace trimmed', validateIntake('sample',
    Object.assign({}, goodSample, { company: '  De Boer Webshop B.V.  ' })).payload.company,
    'De Boer Webshop B.V.');
  const injected = validateIntake('sample', Object.assign({}, goodSample,
    { contact_name: 'Sanne\r\nBcc: attacker@evil.test' }));
  check('control characters stripped from fields', injected.payload.contact_name,
    'SanneBcc: attacker@evil.test');
  const long = validateIntake('sample', Object.assign({}, goodSample, { notes: 'x'.repeat(9000) }));
  check('over-long field truncated', long.payload.notes.length, 4000);
  const extra = validateIntake('sample', Object.assign({}, goodSample, { evil: 'passthrough' }));
  check('unknown fields are dropped, not forwarded', extra.payload.evil, undefined);
  check('order payload carries only known fields',
    Object.keys(validateIntake('order', goodOrder).payload).sort().join(','),
    'address,cases,company,contact_name,currency,email,notes,po_ref,product,vat');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
