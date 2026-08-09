import { redirect } from 'next/navigation';

/**
 * The sales desk has no dashboard of its own yet, and an empty landing page
 * between the click and the work is just a page to click through. The invoice
 * queue is where the day starts, so that is where the module opens.
 */
export default function SotuvPage() {
  redirect('/hub/sotuv/faktura');
}
