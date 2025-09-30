# TYPO3 Extension: form_carousel

`form_carousel` extends the TYPO3 system extension **form** with a modern, animated, step-by-step rendering.
Instead of full page reloads, each form step is loaded asynchronously (AJAX) and displayed with **Bootstrap carousel slide animations**.

---

## Features

- 🚀 **AJAX-based step navigation** — no full reload between steps
- 🎞 **Bootstrap slide animations** (forward/back)
- ⏳ **Loading overlay** with Bootstrap spinner
- ✅ **Validation**
  - HTML5 client-side check prevents unnecessary requests
  - Server-side errors are displayed inline inside the active step
- 🔄 **Progress indicators**
  - `dots` (Bootstrap-style, non-interactive, developer-styled)
  - `progress` (progress bar)
  - `none` (no indicator)
- ♿ **Accessible controls**: Prev/Next buttons are automatically decorated as Bootstrap `carousel-control-prev`/`carousel-control-next`
- 🔌 **Developer events** for hooks and extensions
- 🔀 **Redirect finisher support** — handled as real browser redirects
- 🧩 **Multiple forms per page** — each carousel instance works independently

---

## Installation

### Composer
```bash
composer require belsignum/form-carousel
```

---

## Usage

1. **Enable in content element**
   In `tt_content` of the form plugin you’ll find a field
   **“Render EXT:form as carousel (AJAX slide)”**.
   If enabled, the form is wrapped with
   `<div class="form-carousel" …>…</div>`.

2. **TypoScript**
   The extension ships with TypoScript that is auto-loaded.
   It adds the wrapper to `tt_content.form_formframework`.

3. **JavaScript**
   Import and initialize the module in your build (e.g. Vite):

   ```js
   import { FormCarousel } from 'vendor/belsignum/form-carousel/Resources/Public/JavaScript/form-carousel.esm.js';

   window.addEventListener('DOMContentLoaded', () => {
     FormCarousel.initAll(document);
   });
   ```

4. **Indicators**
   Configure per wrapper via `data-indicators`:
   - `dots` → Bootstrap-like dots (display-only)
   - `progress` → progress bar
   - `none` → disabled

---

## Proxy navigation (outside slides)

Prev/Next are rendered **outside** of the animated slides as **proxy controls**.
This prevents the navigation UI from being animated together with the slide and keeps controls fixed in place.

- Proxies live as direct children of the `.form-carousel` wrapper:
  `.fc-control-prev` and `.fc-control-next` (both use Bootstrap `carousel-control-*` classes).
- Proxies **trigger the original** Prev/Next submitters inside the current form step.
- If a step has **no** Prev or **no** Next (or only a Submit), the corresponding proxy is **not** rendered.
- During requests or transitions the whole wrapper is temporarily locked via `pe-none` (see `lockUi()` / `unlockUi()` in the code).

**Note on in-slide buttons**
You can safely hide the original in-slide Prev/Next (but not the Submit) via CSS so they do not show up inside the slide:

```scss
.form-carousel {
  .btn-group:is(.next:not(.submit), .previous) {
    display: none;
  }
}
```

This keeps the original buttons in the DOM for EXT:form logic, while the proxies provide the UX.

---

## Events

Each `FormCarousel` instance dispatches **CustomEvents** on the document with the prefix `formcarousel:`.
Listen with `document.addEventListener(eventName, handler)`.

**List of events:**

- **`formcarousel:beforeSubmit`** — right before an AJAX request is sent.
  `detail: { stepType, form, submitter }` (cancelable)

- **`formcarousel:validationFailed`** — HTML5 validation blocked submission.
  `detail: { stepType, form, submitter }`

- **`formcarousel:beforeSlide`** — when a slide transition is about to start.
  `detail: { direction }`

- **`formcarousel:afterSlide`** — when a slide transition is finished.
  `detail: { direction, form }`

- **`formcarousel:stepIndexChange`** — when the `data-step-index` changes.
  `detail: { previous, current }`

- **`formcarousel:decorateControls`** — after Prev/Next/Submit buttons are decorated.
  `detail: { form }`

- **`formcarousel:indicatorsUpdate`** — whenever indicators (dots/progress) are updated.
  `detail: { index, total }`

- **`formcarousel:serverError`** — server response contains validation errors.
  `detail: { form }`

**Example usage:**

```js
document.addEventListener('formcarousel:afterSlide', e => {
    console.log('Slide finished', e.detail);
});

document.addEventListener('formcarousel:stepIndexChange', e => {
    console.log('Step changed:', e.detail.current);
});
```

---

## Styling Indicators

The extension does not provide full design for dots. Developers are expected to style them.
Example SCSS:

```scss
.form-carousel .carousel-indicators {
  button {
    background: none;
    border: none;
    padding: 0;
    color: var(--bs-primary);
    pointer-events: none;
    &.active {
      color: var(--bs-primary);
    }
    &:after {
      content: "•";
      font-size: calc(var(--bs-font-size-base) * 1.875);
      font-weight: 900;
    }
  }
}
```

---

## Requirements

- TYPO3 v12+
- EXT:form enabled
- Bootstrap 5 (CSS for carousel + spinner)

---

## Notes

- Bootstrap carousel **JavaScript is not instantiated**.
  Instead, this extension directly toggles Bootstrap’s **CSS classes** to achieve sliding animations.
- Indicators are **display-only** and intentionally not interactive.

---

## License

MIT License
© 2025 [belsignum UG](https://belsignum.com)
