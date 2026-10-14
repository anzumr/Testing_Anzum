WAVE Digital Website

Upload these files together, in the same folder:
  index.html
  styles.css
  script.js
  wave-bg.js            (the animated "tide coming in" hero background)
  wave-logo.png         (full-size logo: social-share image, and the hero artwork in older browsers)
  wave-logo.webp        (full-size logo, lighter WebP version used by the hero)
  wave-logo-420.webp    (smaller WebP logo used by the hero on phones and tablets)
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
3. Set each CONFIG.payments entry to the matching Stripe/Square/PayPal hosted payment link.
   Which key belongs to which plan on the page:
     websiteMonthly = Website Creation, $100-$150/mo        (recurring, monthly)
     socialMonthly  = Social Media Maintenance, $100/mo     (recurring, monthly)
     adsMonthly     = Advertising, $150/mo                  (recurring, monthly)
     bundleMonthly  = Full WAVE Package, $350/mo            (recurring, monthly)
     websiteYearly  = Website Creation, $1,000/yr           (recurring, yearly)
     bundleYearly   = Full WAVE Package, $3,000/yr          (recurring, yearly)
     websiteSignup  = Website Signup, $100                  (one-time)
     socialSetup    = Social Media Creation, $350           (one-time)
     logo           = Logo / Rebranding, $250               (one-time)
4. For monthly/yearly services create recurring subscriptions, not one-time payment links.
5. Confirm the exact scope of the $100-$150 website plan and whether annual plans include setup fees.
6. Confirm advertising budget is billed separately and whether bundle setup fees apply.
7. The two portfolio cards link to the live sites; their previews are stylized illustrations, not screenshots. Replace them with your own screenshots if desired.
8. Test the contact form, checkout and booking links on your live domain before sharing.
9. Once your domain is live, update index.html so link previews on social media show the logo:
   a. Change the og:image and twitter:image tags to the full address of wave-logo.png (for example https://yourdomain.com/wave-logo.png).
   b. Add these two lines inside <head>, with your real address:
        <link rel="canonical" href="https://yourdomain.com/">
        <meta property="og:url" content="https://yourdomain.com/">

Until the links above are filled in, the payment and booking buttons show a short on-screen notice asking visitors to contact you instead, and the contact form explains that it is not connected yet. Card details are never collected by this website.

Visitors can stop the hero animation and the other looping effects with the "Pause animation" button in the bottom-left corner of the hero; the choice is remembered in their browser. People who have "reduce motion" switched on in their device settings get a still version automatically.

No payment processor or contact form account can be activated by uploading these files alone.
