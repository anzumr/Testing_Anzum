WAVE Digital Website

Upload these files together, in the same folder:
  index.html
  styles.css
  script.js
  wave-bg.js            (the animated "tide coming in" hero background)
  wave-logo.png         (full-size logo: hero artwork and social-share image)
  wave-logo-sm.png      (small logo: header and footer)
  favicon.png           (browser tab icon)
  apple-touch-icon.png  (home-screen icon for phones and tablets)
  README.txt            (this file; optional to upload)

The site needs no build step. You can also open index.html straight from your computer to preview it.

BEFORE GOING LIVE:
1. Open script.js and set CONFIG.formspreeEndpoint to your real Formspree form URL.
2. Set CONFIG.bookingUrl so the "Schedule a Free Consultation" button books a Google Meet call:
   a. In Google Calendar, create an appointment schedule (Create > Appointment schedule).
   b. Set your availability and meeting length. Google Calendar adds a Google Meet video link to every booking automatically.
   c. Open the schedule's booking page, copy its link (it starts with https://calendar.app.google/ or https://calendar.google.com/), and paste it into CONFIG.bookingUrl.
   A Calendly scheduling page link also works. The link must start with https://.
3. Set each CONFIG.payments entry to the matching Stripe/Square/PayPal hosted payment link.
4. For monthly/yearly services create recurring subscriptions, not one-time payment links.
5. Confirm the exact scope of the $100-$150 website plan and whether annual plans include setup fees.
6. Confirm advertising budget is billed separately and whether bundle setup fees apply.
7. Portfolio cards link to live sites; their previews are stylized illustrations, not screenshots. Replace them with your own screenshots if desired.
8. Test the contact form, checkout and booking links on your live domain before sharing.
9. Optional: once your domain is live, change the og:image and twitter:image tags in index.html to the full address of wave-logo.png (for example https://yourdomain.com/wave-logo.png) so link previews on social media show the logo.

Until the links above are filled in, the payment and booking buttons show a short on-screen notice asking visitors to contact you instead, and the contact form explains that it is not connected yet. Card details are never collected by this website.

No payment processor or contact form account can be activated by uploading these files alone.
