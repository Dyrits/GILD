export interface Line {
  price: number;
  quantity: number;
}

/** Sums a cart, then applies the discount rate and VAT. */
export const totalOf = (lines: Line[], discount: number, vat: number) => {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return Math.round(subtotal * (1 - discount) * (1 + vat) * 100) / 100;
};
