import { router } from 'expo-router';

// Module-level lock so two entry points (cart icon + view-cart bar) can't
// double-push the same route during the modal's present animation.
let locked = false;

export function navOnce(fn: () => void) {
  if (locked) return;
  locked = true;
  fn();
  setTimeout(() => {
    locked = false;
  }, 600);
}

/** Open the cart modal — guarded against double-open. */
export const openCart = () => navOnce(() => router.push('/cart'));
