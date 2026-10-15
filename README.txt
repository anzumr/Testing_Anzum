WAVE Digital Website

Upload these files together, in the same folder:
  index.html
  thank-you.html        (the page Stripe sends clients to after they pay)
  styles.css
  script.js             (all the settings below live at the top of this one file)
  wave-bg.js            (the animated "tide coming in" hero background)
  wave-logo.png         (full-size logo: social-share image, and the hero artwork in older browsers)
  wave-logo.webp        (full-size logo, lighter WebP version used by the hero, the portfolio and the thank-you page)
  wave-logo-420.webp    (smaller WebP logo used on phones and tablets)
  wave-logo-sm.png      (small logo: header and footer)
  favicon.png           (browser tab icon)
  apple-touch-icon.png  (home-screen icon for phones and tablets)
  README.txt            (this file; optional to upload)

The site needs no build step. You can also open index.html straight from your computer to preview it.

BEFORE GOING LIVE:
1. Open script.js and set CONFIG.formspreeEndpoint to your real Formspree form URL.
   Create a form at formspree.io and paste its endpoint, which looks like https://formspree.io/f/xxxxxxxx (it must start with https://). Send one test inquiry and confirm it in Formspree's verification email.
2. Set CONFIG.bookingUrl so the "Schedule a Free Consultation" button books a Google Meet call:
   a. In Google Calendar, create an appointment schedule (Create > Appointment schedule).
   b. Set your availability and meeting length, and under "Location and conferencing" keep "Google Meet video conferencing" selected so every booking gets its own Meet link.
   c. Open the schedule's booking page, copy its link (it starts with https://calendar.app.google/ or https://calendar.google.com/), and paste it into CONFIG.bookingUrl.
   A Calendly scheduling page link also works. The link must start with https://.
   The same button on the thank-you page uses this link too.
3. Set up payments with Stripe: follow "TAKING PAYMENTS WITH STRIPE" below.
4. Confirm the exact scope of the $100-$150 website plan and whether annual plans include setup fees.
5. Confirm advertising budget is billed separately and whether bundle setup fees apply.
6. The portfolio shows your two client projects, which link to their live sites (their previews are stylized illustrations, not screenshots; replace them with your own screenshots if desired), plus a "Your business could be next" tile that takes visitors to the contact form. Add new client projects as you complete them.
7. Test the contact form, checkout, booking and "Manage subscription" links on your live domain before sharing.
8. Once your domain is live, update index.html so link previews on social media show the logo:
   a. Change the og:image and twitter:image tags to the full address of wave-logo.png (for example https://yourdomain.com/wave-logo.png).
   b. Add these two lines inside <head>, with your real address:
        <link rel="canonical" href="https://yourdomain.com/">
        <meta property="og:url" content="https://yourdomain.com/">


TAKING PAYMENTS WITH STRIPE

Every "Subscribe", "Get Full WAVE", "Choose Annual", "Pay ... Fee" and "Purchase" button (the
9 payment buttons in the Rates section) opens a Stripe Payment Link: a secure checkout page
hosted by Stripe. Payment Links are made in the Stripe Dashboard with no code. The website
needs no server and no API keys, and card details are never entered on or stored by this
website.

a. Create a Stripe account at stripe.com and activate payments (Stripe asks for your business
   and bank details before it lets you take live payments).

b. In the Dashboard's Product catalogue, create these products and prices so they match the
   site exactly:
     Website Creation          $100-$150 per month   recurring, monthly (see step d)
     Social Media Maintenance  $100 per month        recurring, monthly
     Advertising               $150 per month        recurring, monthly
     Full WAVE Package         $350 per month        recurring, monthly
     Website Creation          $1,000 per year       recurring, yearly
     Full WAVE Package         $3,000 per year       recurring, yearly
     Website Signup            $100                  one-time
     Social Media Creation     $350                  one-time
     Logo / Rebranding         $250                  one-time
   (Website Creation and Full WAVE Package can each be one product with a monthly and a
   yearly price.) All prices are in USD.

c. Create one Payment Link per button you use (see step e): Payment Links > New, then pick the
   product and price. Copy its address (it starts with https://buy.stripe.com/) and paste it
   between the quotes of the matching entry in CONFIG.payments at the top of script.js:
     Key in script.js   Button on the site
     websiteMonthly     Website Creation, $100-$150/mo "Subscribe"      (recurring, monthly)
     socialMonthly      Social Media Maintenance, $100/mo "Subscribe"   (recurring, monthly)
     adsMonthly         Advertising, $150/mo "Subscribe"                (recurring, monthly)
     bundleMonthly      Full WAVE Package, $350/mo "Get Full WAVE"      (recurring, monthly)
     websiteYearly      Website Creation, $1,000/yr "Choose Annual"     (recurring, yearly)
     bundleYearly       Full WAVE Package, $3,000/yr "Choose Annual"    (recurring, yearly)
     websiteSignup      Website Signup, $100 "Pay Signup Fee"           (one-time)
     socialSetup        Social Media Creation, $350 "Pay Setup Fee"     (one-time)
     logo               Logo / Rebranding, $250 "Purchase"              (one-time)
   For example:  websiteMonthly: "https://buy.stripe.com/abc123",
   The site only opens links on Stripe's own checkout addresses (buy.stripe.com or
   checkout.stripe.com) that start with https://. Anything else shows "The checkout link needs
   to be a valid Stripe HTTPS link." instead. If you set up a custom checkout domain in Stripe
   (for example pay.yourdomain.com), add it to CONFIG.stripe.extraHosts, like
   extraHosts: ["pay.yourdomain.com"].
   A button whose link is still empty shows a short notice asking the visitor to contact you,
   and takes them to the contact form.

d. A subscription link charges one fixed price. For the $100-$150/mo website plan, either
   create two links ($100/mo and $150/mo), put the one that fits most clients on the site and
   send the other directly to clients whose site needs it, or settle on a single price.

e. Setup fees ($100 website signup, $350 social media setup): either keep selling them through
   the separate one-time buttons, or add the one-time fee as an extra item on the subscription's
   Payment Link so Stripe charges it once with the first payment. Don't do both, or the client
   pays the fee twice. If you add the fee to the subscription link, leave websiteSignup and/or
   socialSetup empty in CONFIG.payments (those buttons then send visitors to the contact form).
   Use the fee's own one-time link only for clients who pay the fee separately (send it to
   them directly).

f. In each Payment Link's "After payment" settings, choose to redirect customers to your
   website (instead of Stripe's confirmation page) and enter:
     https://YOUR-DOMAIN/thank-you.html
   (with your real domain). Clients then land on the site's thank-you page after paying.

g. Let clients manage their own subscriptions: in Stripe's billing settings, open Customer
   portal, activate it, and copy its login link (it starts with
   https://billing.stripe.com/p/login/). Paste it into CONFIG.stripe.customerPortalUrl in
   script.js. A "Manage subscription" link then appears in the footer and on the thank-you page,
   where clients can update their card, see invoices or cancel. While it is empty, the link
   stays hidden (it also stays hidden if the link is not a https://billing.stripe.com/ address,
   or one on your custom domain listed in CONFIG.stripe.extraHosts).

h. Test first. Switch the Dashboard to test mode and make the links there (test links start
   with https://buy.stripe.com/test_). Paste them in, then pay with the test card
   4242 4242 4242 4242, any future expiry date and any CVC. Check that you land on
   thank-you.html and that the payment shows up in Stripe. When everything works, create the
   same products and links in live mode and replace every test link (and a test portal link)
   with its live one. Test links never charge real cards.

i. Never paste secret keys. Payment Links are all this site needs. Never put a Stripe secret
   key (sk_live_... or sk_test_...) or restricted key (rk_...) into script.js or any other
   file: anyone can read a website's files.

j. Turn on Stripe's email receipts (in Stripe's settings for customer emails, switch on emails
   for successful payments) so every client gets a receipt. The thank-you page tells clients
   that Stripe will email it.


Until the links above are filled in, the payment and booking buttons show a short on-screen notice asking visitors to contact you instead, and the contact form explains that it is not connected yet. Card details are never collected by this website.

Visitors can stop the hero animation and the other looping effects with the "Pause animation" button in the bottom-left corner of the hero; the choice is remembered in their browser. The thank-you page has no looping effects (its few animations finish within five seconds), so it needs no such button. People who have "reduce motion" switched on in their device settings get a still version automatically.

No payment processor or contact form account can be activated by uploading these files alone.
