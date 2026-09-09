/** Astore money / delivery rules (kobo integers). */

export const STORE_CURRENCY = "NGN" as const;

/** Flat delivery fee outside Lagos: ₦5,000 */
export const OUTSIDE_LAGOS_DELIVERY_FEE_KOBO = 500_000;

export type DeliveryZoneValue = "lagos" | "outside_lagos";

export const deliveryFeeKobo = (zone: DeliveryZoneValue): number =>
  zone === "outside_lagos" ? OUTSIDE_LAGOS_DELIVERY_FEE_KOBO : 0;

export const MAX_CART_ITEM_QTY = 99;
