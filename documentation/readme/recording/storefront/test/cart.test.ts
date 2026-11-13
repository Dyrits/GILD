import { expect, test } from "bun:test";
import { totalOf } from "../src/cart";

test("a plain cart", () => {
  expect(totalOf([{ price: 12.5, quantity: 2 }], 0, 0.2)).toBe(30);
});

test("a discounted cart rounds like the invoice", () => {
  expect(
    totalOf(
      [
        { price: 19.99, quantity: 3 },
        { price: 4.35, quantity: 1 },
      ],
      0.15,
      0.2,
    ),
  ).toBe(65.6);
});
