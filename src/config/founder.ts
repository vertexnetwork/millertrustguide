// GLOBAL founder offer — the first `unitLimit` kit sales ACROSS ALL STATES get
// `price` (not per-state). The Stripe coupon (STRIPE_FOUNDER_COUPON_ID, with
// max_redemptions = unitLimit) is the HARD enforcement of the discounted charge;
// this file only drives the on-site DISPLAY (the $99 price + "N spots left"),
// which every state page reads so they stay congruent site-wide.
//
// Operator: bump `unitsSold` as real founder sales close, then redeploy. Keep it
// >= the coupon's times_redeemed so the site never advertises a founder price the
// coupon won't honor. NOTE: refunded/test purchases still count as coupon
// redemptions in Stripe — if test buys ate into the 25, issue a fresh coupon with
// max_redemptions=25 and repoint STRIPE_FOUNDER_COUPON_ID at it.
export const FOUNDER = {
  unitLimit: 25,
  unitsSold: 0,
  price: 99,
};
