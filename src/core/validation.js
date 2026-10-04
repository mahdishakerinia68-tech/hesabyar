import { invoiceSubtotal, invoiceTotal } from '../modules/invoices.js';
export function parseMoney(value) {
  const normalized = String(value ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
export function positiveMoney(value, label = 'مبلغ') { const n = parseMoney(value); if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} باید بیشتر از صفر باشد`); return n; }
export function nonNegativeMoney(value, label = 'مبلغ') { const n = parseMoney(value); if (!Number.isFinite(n) || n < 0) throw new Error(`${label} نمی‌تواند منفی باشد`); return n; }
export function validPercent(value, label = 'درصد') { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${label} باید بین صفر و صد باشد`); return n; }
export function validateInvoice(invoice) {
  if (!invoice || !Array.isArray(invoice.items) || !invoice.items.length) throw new Error('فاکتور باید حداقل یک ردیف داشته باشد');
  for (const item of invoice.items) { if (!(Number(item.qty) > 0)) throw new Error('تعداد هر ردیف باید بیشتر از صفر باشد'); if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) throw new Error('قیمت نمی‌تواند منفی یا نامعتبر باشد'); }
  const subtotal = invoiceSubtotal(invoice);
  const discount = nonNegativeMoney(invoice.discount ?? 0, 'تخفیف');
  if (discount > subtotal) throw new Error('تخفیف نمی‌تواند بیشتر از جمع جزء باشد');
  const discountPercent = validPercent(invoice.discountPercent ?? 0, 'درصد تخفیف');
  const taxRate = validPercent(invoice.taxRate ?? 0, 'مالیات');
  const paid = nonNegativeMoney(invoice.paid ?? 0, 'مبلغ پرداختی');
  const total = invoiceTotal(invoice);
  if (paid > total) throw new Error('مبلغ پرداختی بیشتر از مبلغ فاکتور است');
  return { subtotal, discount, discountPercent, taxRate, paid, total };
}
