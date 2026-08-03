import { redirect } from 'next/navigation';

/**
 * The front door is always the sign-in screen — deliberately, and regardless
 * of whether a session is already sitting in the browser.
 *
 * This used to send an authenticated visitor straight to /hub, which meant a
 * shared or demo machine walked whoever opened it into the app without ever
 * showing who they were signed in as. /login now makes that explicit: if a
 * session exists it offers to continue with it, or to sign out and switch.
 */
export default function HomePage() {
  redirect('/login');
}
