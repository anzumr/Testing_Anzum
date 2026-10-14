// SETUP: Replace the blank values with your real provider links.
// Use hosted recurring-subscription links for monthly/yearly plans, not one-time checkout links.
// bookingUrl: for Google Meet consultations, paste the booking-page link of a Google Calendar
// appointment schedule (each booking gets its own Google Meet link). A Calendly link also works.
const CONFIG = {
  formspreeEndpoint: "",
  bookingUrl: "",
  payments: {
    websiteMonthly: "",
    socialMonthly: "",
    adsMonthly: "",
    bundleMonthly: "",
    websiteYearly: "",
    bundleYearly: "",
    websiteSignup: "",
    socialSetup: "",
    logo: ""
  }
};

(function () {
  "use strict";

  var NAV_BREAKPOINT = 900; // keep in sync with the 900px menu breakpoint in styles.css
  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  function scrollBehavior() { return reducedMotion() ? "auto" : "smooth"; }

  // Only accept absolute https:// links; returns the normalised URL or null.
  function safeHttpsUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch (err) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
     Hero background (wave-bg.js) — mounted per the hero contract
     ------------------------------------------------------------------ */
  var hero = document.getElementById("home");
  var brandLogo = document.querySelector(".brand-logo");
  var breakTimer = 0;
  var heroBroken = false; // the headline sheen plays once per visit, even if the background is re-mounted

  // Visitor's pause choice (WCAG 2.2.2): stops the hero water and every looping CSS animation.
  var MOTION_KEY = "waveDigital.motion";
  var motionPaused = false;
  try { motionPaused = window.localStorage.getItem(MOTION_KEY) === "paused"; } catch (err) { /* storage unavailable */ }

  function onBreak() {
    var first = !heroBroken;
    heroBroken = true;
    if (!first || motionPaused || reducedMotion() || !hero) return;
    hero.classList.remove("is-breaking");
    if (brandLogo) brandLogo.classList.remove("pulse");
    void hero.offsetWidth; // restart the CSS animations
    hero.classList.add("is-breaking");
    if (brandLogo) brandLogo.classList.add("pulse");
    clearTimeout(breakTimer);
    breakTimer = setTimeout(function () {
      hero.classList.remove("is-breaking");
      if (brandLogo) brandLogo.classList.remove("pulse");
    }, 2000);
  }

  var bg = null;
  function mountBackground(replay) {
    if (!hero || !window.WaveBackground) return;
    var opts = {
      logo: hero.querySelector(".hero-art"),
      textEl: hero.querySelector(".hero-inner"),
      onBreak: onBreak
    };
    if (motionPaused) opts.reducedMotion = true; // a composed still frame, whole logo
    if (!replay) opts.intro = false;              // resuming: no second tide-in
    try {
      bg = window.WaveBackground.mount(hero.querySelector(".wave-canvas"), opts);
    } catch (err) {
      bg = null; /* the static CSS backdrop and logo remain */
    }
  }

  var motionToggle = document.getElementById("motionToggle");
  var motionLabel = motionToggle ? motionToggle.querySelector(".motion-label") : null;
  function applyMotionState() {
    document.documentElement.classList.toggle("motion-paused", motionPaused);
    if (!motionToggle) return;
    motionToggle.classList.toggle("is-paused", motionPaused);
    if (motionLabel) motionLabel.textContent = motionPaused ? "Play animation" : "Pause animation";
  }
  applyMotionState();
  mountBackground(true);

  if (motionToggle) {
    motionToggle.hidden = false;
    motionToggle.addEventListener("click", function () {
      motionPaused = !motionPaused;
      try { window.localStorage.setItem(MOTION_KEY, motionPaused ? "paused" : "playing"); } catch (err) { /* storage unavailable */ }
      applyMotionState();
      if (bg) { try { bg.destroy(); } catch (err) { /* ignore */ } bg = null; }
      mountBackground(false);
    });
  }

  /* ------------------------------------------------------------------
     Smooth scrolling for in-page links only (native anchor behaviour and
     focus handling are kept; reduced motion jumps instantly)
     ------------------------------------------------------------------ */
  var smoothTimer = 0;
  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link || reducedMotion() || link.getAttribute("href").length < 2) return;
    document.documentElement.classList.add("smooth-scroll");
    clearTimeout(smoothTimer);
    smoothTimer = setTimeout(function () { document.documentElement.classList.remove("smooth-scroll"); }, 2500);
  }, true);

  /* ------------------------------------------------------------------
     Header: mobile menu + scrolled state
     ------------------------------------------------------------------ */
  var header = document.querySelector(".header");
  var menuButton = document.getElementById("menuToggle");
  var menu = document.getElementById("mobileMenu");

  function isMenuOpen() { return menu.classList.contains("open"); }
  function setMenu(open) {
    menu.classList.toggle("open", open);
    menuButton.classList.toggle("active", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }
  function closeMenu() { if (isMenuOpen()) setMenu(false); }

  if (menuButton && menu) {
    menuButton.addEventListener("click", function () { setMenu(!isMenuOpen()); });
    menu.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", closeMenu); });
    document.addEventListener("click", function (e) {
      if (isMenuOpen() && !menu.contains(e.target) && !menuButton.contains(e.target)) closeMenu();
    });
    window.addEventListener("resize", function () { if (window.innerWidth > NAV_BREAKPOINT) closeMenu(); }, { passive: true });
    // keyboard focus leaving the open menu closes it, so the menu never hides the focused control
    document.addEventListener("focusin", function (e) {
      if (isMenuOpen() && !menu.contains(e.target) && !menuButton.contains(e.target)) closeMenu();
    });
  }

  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------
     Logo ripple follows the pointer
     ------------------------------------------------------------------ */
  document.querySelectorAll(".brand-logo,.footer-logo").forEach(function (logo) {
    var last = 0;
    logo.addEventListener("pointermove", function (e) {
      var rect = logo.getBoundingClientRect();
      logo.style.setProperty("--ripple-x", (e.clientX - rect.left) + "px");
      logo.style.setProperty("--ripple-y", (e.clientY - rect.top) + "px");
      if (reducedMotion() || motionPaused) return;
      var now = Date.now();
      if (now - last < 650) return;
      last = now;
      logo.classList.remove("rippling");
      void logo.offsetWidth;
      logo.classList.add("rippling");
    });
    logo.addEventListener("animationend", function (e) {
      if (e.animationName === "ripple") logo.classList.remove("rippling");
    });
  });

  /* ------------------------------------------------------------------
     Toast (non-blocking, announced politely to screen readers)
     ------------------------------------------------------------------ */
  var toastBox = document.getElementById("toastBox");
  var toastMsg = document.getElementById("toast");
  var toastClose = document.getElementById("toastClose");
  var toastTimer = 0, toastShowTimer = 0;

  function hideToast() {
    if (!toastBox) return;
    clearTimeout(toastTimer);
    toastBox.classList.remove("show");
    if (toastClose) toastClose.hidden = true;
    toastTimer = setTimeout(function () { toastMsg.textContent = ""; }, 400);
  }
  function scheduleHide(ms) {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms);
  }
  function showToast(message, tone) {
    if (!toastBox || !toastMsg) return;
    clearTimeout(toastTimer);
    clearTimeout(toastShowTimer);
    toastBox.setAttribute("data-tone", tone || "info");
    toastMsg.textContent = "";
    // a short delay lets assistive tech register the change even for a repeated message
    toastShowTimer = setTimeout(function () {
      toastMsg.textContent = message;
      toastBox.classList.add("show");
      if (toastClose) toastClose.hidden = false;
      scheduleHide(7000);
    }, 60);
  }
  if (toastBox) {
    if (toastClose) toastClose.addEventListener("click", hideToast);
    toastBox.addEventListener("pointerenter", function () { clearTimeout(toastTimer); });
    toastBox.addEventListener("pointerleave", function () { if (toastBox.classList.contains("show")) scheduleHide(3500); });
    toastBox.addEventListener("focusin", function () { clearTimeout(toastTimer); });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (menu && isMenuOpen()) {
      var focusWasInMenu = menu.contains(document.activeElement);
      closeMenu();
      if (focusWasInMenu && menuButton) menuButton.focus();
    }
    if (toastBox && toastBox.classList.contains("show")) hideToast();
  });

  /* ------------------------------------------------------------------
     Payments — never collect card details on this static website
     ------------------------------------------------------------------ */
  var contact = document.getElementById("contact");
  var contactTitle = document.getElementById("contact-title");
  var serviceSelect = document.getElementById("service");
  // pre-select the matching service in the contact form when checkout isn't set up yet
  var PAYMENT_SERVICE = {
    websiteMonthly: "Website Creation", websiteYearly: "Website Creation", websiteSignup: "Website Creation",
    socialMonthly: "Social Media", socialSetup: "Social Media",
    adsMonthly: "Advertising",
    bundleMonthly: "Full WAVE Package", bundleYearly: "Full WAVE Package",
    logo: "Logo / Rebranding"
  };

  document.querySelectorAll(".pay").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.dataset.payment;
      var url = CONFIG.payments[key];
      if (!url) {
        showToast("Online checkout is being set up. Please contact us to arrange payment for this service.");
        if (serviceSelect && PAYMENT_SERVICE[key]) serviceSelect.value = PAYMENT_SERVICE[key];
        if (contact) contact.scrollIntoView({ behavior: scrollBehavior() });
        // move keyboard / screen-reader focus along with the page (the heading, so no on-screen keyboard pops up)
        if (contactTitle) { try { contactTitle.focus({ preventScroll: true }); } catch (err) { contactTitle.focus(); } }
        return;
      }
      var safe = safeHttpsUrl(url);
      if (!safe) {
        showToast("The checkout link needs to be a valid HTTPS URL.", "error");
        return;
      }
      window.open(safe, "_blank", "noopener,noreferrer");
    });
  });

  /* ------------------------------------------------------------------
     Booking (Google Calendar appointment schedule / Calendly)
     ------------------------------------------------------------------ */
  var booking = document.getElementById("scheduleLink");
  var form = document.getElementById("contactForm");
  if (booking) {
    var bookingHref = CONFIG.bookingUrl ? safeHttpsUrl(CONFIG.bookingUrl) : null;
    if (bookingHref) {
      // real link for middle-click / "open in new tab"
      booking.href = bookingHref;
      booking.target = "_blank";
      booking.rel = "noopener noreferrer";
    }
    booking.addEventListener("click", function (e) {
      if (!CONFIG.bookingUrl) {
        e.preventDefault();
        showToast("Online scheduling is being set up. Please send us a message below.");
        if (form && window.innerWidth <= NAV_BREAKPOINT) form.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        return;
      }
      e.preventDefault();
      var href = safeHttpsUrl(CONFIG.bookingUrl);
      if (!href) {
        showToast("Booking link is invalid. Please contact us using the form.", "error");
        return;
      }
      window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  /* ------------------------------------------------------------------
     Contact form (Formspree)
     ------------------------------------------------------------------ */
  var formMessage = document.getElementById("formMessage");
  var submit = document.getElementById("submitBtn");
  var submitLabel = submit ? submit.querySelector(".btn-label") : null;

  function setMessage(text, state) {
    if (!formMessage) return;
    formMessage.textContent = text;
    if (state && text) formMessage.setAttribute("data-state", state);
    else formMessage.removeAttribute("data-state");
  }
  // The button is never `disabled` while sending: that would drop keyboard focus to <body>.
  var sending = false;
  function setSending(on) {
    sending = on;
    if (!submit) return;
    submit.setAttribute("aria-disabled", String(on));
    submit.classList.toggle("is-sending", on);
    submit.setAttribute("aria-busy", String(on));
    if (submitLabel) submitLabel.textContent = on ? "Sending…" : "Send Inquiry";
  }

  if (form) {
    var fields = form.querySelectorAll("input,select,textarea");
    var markField = function (field) {
      field.classList.add("touched");
      // validity.valid (not checkValidity) so no extra "invalid" events are fired
      if (field.willValidate) field.setAttribute("aria-invalid", String(!field.validity.valid));
    };
    fields.forEach(function (field) {
      field.addEventListener("blur", function () { if (field.value !== "" || field.classList.contains("touched")) markField(field); });
      field.addEventListener("input", function () { if (field.classList.contains("touched")) markField(field); });
      // fired by the browser's own validation (reportValidity / native submit)
      field.addEventListener("invalid", function () { markField(field); });
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (sending) return;
      if (!form.reportValidity()) return;
      if (!CONFIG.formspreeEndpoint) {
        setMessage("The contact form is not connected yet. Please configure the Formspree endpoint before accepting inquiries.", "info");
        return;
      }
      var endpoint = safeHttpsUrl(CONFIG.formspreeEndpoint);
      if (!endpoint) {
        setMessage("Message could not be delivered. Please try again later.", "error");
        return;
      }
      setSending(true);
      setMessage("");
      try {
        var response = await fetch(endpoint, {
          method: "POST",
          headers: { "Accept": "application/json" },
          body: new FormData(form)
        });
        if (!response.ok) throw new Error("Delivery failed");
        setMessage("Thank you! Your inquiry was sent successfully.", "success");
        form.reset();
        fields.forEach(function (field) { field.classList.remove("touched"); field.removeAttribute("aria-invalid"); });
      } catch (err) {
        setMessage("Message could not be delivered. Please try again later.", "error");
      } finally {
        setSending(false);
      }
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveal — content stays visible if this never runs
     ------------------------------------------------------------------ */
  if (!reducedMotion() && document.querySelectorAll) {
    var pending = [];
    var revealFrame = 0;
    var reveal = function (el) {
      el.classList.add("is-visible");
      // hand the element back to its own hover/transition styles afterwards
      setTimeout(function () {
        el.classList.remove("reveal", "is-visible");
        el.style.removeProperty("--rd");
      }, 1100);
    };
    // Reveal everything whose top has reached the lower part of the viewport, including
    // anything scrolled past quickly (e.g. a jump to #contact), so nothing stays hidden.
    var checkReveals = function () {
      revealFrame = 0;
      var limit = (window.innerHeight || document.documentElement.clientHeight) * 0.9;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < limit) { if (revealIO) revealIO.unobserve(el); reveal(el); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener("scroll", queueReveal);
        window.removeEventListener("resize", queueReveal);
      }
    };
    var queueReveal = function () { if (!revealFrame) revealFrame = requestAnimationFrame(checkReveals); };
    // primary trigger: IntersectionObserver; the scroll check above is the safety net
    var revealIO = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealIO.unobserve(entry.target);
        var i = pending.indexOf(entry.target);
        if (i > -1) { pending.splice(i, 1); reveal(entry.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 }) : null;

    var viewH = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      // anything already on screen stays as-is (no flash)
      if (el.getBoundingClientRect().top < viewH * 0.9) return;
      var siblings = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.hasAttribute("data-reveal"); }) : [];
      var index = siblings.indexOf(el);
      el.style.setProperty("--rd", (Math.max(0, index) % 4) * 0.08 + "s");
      el.classList.add("reveal");
      pending.push(el);
      if (revealIO) revealIO.observe(el);
    });
    if (pending.length) {
      window.addEventListener("scroll", queueReveal, { passive: true });
      window.addEventListener("resize", queueReveal, { passive: true });
    }
  }

  /* ------------------------------------------------------------------
     Ambient animations (wave dividers, featured glow) only run on screen
     ------------------------------------------------------------------ */
  if ("IntersectionObserver" in window) {
    var ambientIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle("in-view", entry.isIntersecting); });
    }, { rootMargin: "80px 0px" });
    document.querySelectorAll(".wave-divider,.price-card.featured").forEach(function (el) { ambientIO.observe(el); });
  }

  /* ------------------------------------------------------------------
     Active nav link for the section in view
     ------------------------------------------------------------------ */
  if ("IntersectionObserver" in window && menu) {
    var navLinks = Array.prototype.filter.call(menu.querySelectorAll('a[href^="#"]'), function (a) { return !a.classList.contains("nav-cta"); });
    var setActive = function (id) {
      navLinks.forEach(function (a) {
        if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };
    var sectionIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: "-42% 0px -56% 0px", threshold: 0 });
    document.querySelectorAll("main section[id]").forEach(function (section) { sectionIO.observe(section); });
  }
})();
