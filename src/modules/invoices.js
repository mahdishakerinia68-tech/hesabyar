// Reference implementation of the invoice math. It mirrors app.js exactly (see the differential
// test in tests/e2e-browser.mjs, which compares both on hundreds of random invoices).
export function invoiceSubtotal(inv) {
  return (inv?.items || []).reduce((s, x) => s + (Number(x.qty) || 0) * (Number(x.price) || 0), 0);
}
export function invoiceTotal(inv) {
  const sub = invoiceSubtotal(inv);
  const discountAmount = Math.min(sub, Math.max(0, Number(inv?.discount) || 0));
  const discountPercent = Math.min(100, Math.max(0, Number(inv?.discountPercent) || 0));
  const percentAmount = Math.min(sub - discountAmount, Math.round((sub - discountAmount) * discountPercent / 100));
  const discount = discountAmount + percentAmount;
  const tax = Math.max(0, Math.round((sub - discount) * (Number(inv?.taxRate) || 0) / 100));
  return Math.max(0, sub - discount + tax);
}
export function invoiceRemaining(inv) {
  return Math.max(0, invoiceTotal(inv) - (Number(inv?.paid) || 0));
}
