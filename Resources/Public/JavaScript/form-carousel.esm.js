export class FormCarousel {
  static #instances = new WeakMap();

  static initAll(root = document, options = {}) {
    root
      .querySelectorAll('.form-carousel[data-rendering="carousel"][data-ce-uid]')
      .forEach(w => {
        if (!FormCarousel.#instances.has(w)) {
          FormCarousel.#instances.set(w, new FormCarousel(w, options));
        }
      });
    return FormCarousel;
  }

  constructor(wrapper, options = {}) {
    this.wrapper = wrapper;
    this.options = { fetchInit: {}, ...options };
    this.isSubmitting = false;
    this.isNavigating = false;
    this.indicators = this.wrapper.dataset.indicators || 'progress';

    this.onClick = this.onClick.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    this.wrapper.addEventListener('click', this.onClick, { passive: false });
    this.wrapper.addEventListener('submit', this.onSubmit, { capture: true });

    // Ensure consistent structure on initial render
    this.ensureCarouselStructure();     // wraps initial <form>
    this.ensureExternalControls();
    this.createIndicators();            // creates indicators

    const initialForm = this.wrapper.querySelector('form');
    if (initialForm) {
      this.updateExternalControls(initialForm);
    }
    else {
      this.wrapper.setAttribute('data-state', 'finished');
      this.wrapper.setAttribute('data-finished', 'true');
    }
  }

  /*
   * Helpers
   */
  dispatch(name, detail = {}, opts = {}) {
    const ev = new CustomEvent(`formcarousel:${name}`, {
      detail,
      bubbles: true,
      cancelable: !!opts.cancelable
    });
    this.wrapper.dispatchEvent(ev);
    return ev;
  }

  isStepSubmitter(el) {
    const name = el?.getAttribute?.('name') || '';
    return name.includes('__currentPage') || !!el?.dataset?.step;
  }

  lockUi() {
    // prevent any further interactions while navigating
    this.wrapper.classList.add('pe-none'); // Bootstrap: pointer-events: none
  }
  unlockUi() {
    this.wrapper.classList.remove('pe-none');
  }

  getActiveForm() {
    return this.wrapper.querySelector(':scope > .carousel-inner .carousel-item.active form')
      || this.wrapper.querySelector(':scope > form')
      || null;
  }

  hasServerErrors(formEl) {
    return !!formEl.querySelector(
      '.has-error, .form-control.error, .error.form-text[role="alert"], [aria-invalid="true"]'
    );
  }

  focusFirstProblem(formEl) {
    const first =
      formEl.querySelector(
        '.has-error .form-control, .form-control.error, [aria-invalid="true"], :invalid'
      ) || formEl.querySelector('input,select,textarea,button');
    first?.focus?.();
    first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  // Get total steps from wrapper dataset (N), or null
  getTotalStepsFromWrapper() {
    const n = parseInt(this.wrapper.dataset.steps || '', 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  // Find a step button with an exact numeric value (== targetIndex)
  getButtonByExactIndex(form, targetIndex) {
    if (!Number.isInteger(targetIndex)) return null;
    return this.getStepButtons(form).find(b => this.parseBtnVal(b) === targetIndex) || null;
  }

  // Always decode current step from the form's __state (ignores dataset)
  decodeStepIndexFromForm(form) {
    const stateInput = form?.querySelector('input[name$="[__state]"]');
    if (!stateInput?.value) return null;
    try {
      const raw = stateInput.value.replace(/[0-9a-f]{40}$/i, ''); // strip HMAC
      const bin = atob(raw);
      const m = /lastDisplayedPageIndex";i:(\d+)/.exec(bin);
      return m ? parseInt(m[1], 10) : null;
    } catch { return null; }
  }

  getCurrentStepIndex(form) {
    const ds = parseInt(this.wrapper.dataset.stepIndex || '', 10);
    if (Number.isInteger(ds)) return ds;   // fast path
    return this.decodeStepIndexFromForm(form); // fallback from form
  }

  getStepType(submitter, form) {
    if (submitter?.hasAttribute('formnovalidate')) return 'prev';

    const target  = parseInt(submitter?.value, 10);
    if (Number.isNaN(target)) return 'next';

    const current = this.getCurrentStepIndex(form) ?? 0;
    if (target < current) return 'prev';

    const total = this.getTotalStepsFromWrapper(); // N
    if (total != null && target === total) return 'submit'; // EXT:form-Variante

    return 'next';
  }

  // Parse numeric value from a step button
  parseBtnVal(btn) {
    const v = parseInt(btn?.value, 10);
    return Number.isFinite(v) ? v : null;
  }

  // Return all step submitters inside the form
  getStepButtons(form) {
    return [...form.querySelectorAll('button[name*="__currentPage"]')];
  }

  findPrevButton(form) {
    const curr = this.getCurrentStepIndex(form) ?? 0;
    const btns = this.getStepButtons(form);

    // Candidates classified as 'prev' (via getStepType: formnovalidate OR target < current)
    const prevs = btns.filter(b => this.getStepType(b, form) === 'prev');
    if (!prevs.length) return null;

    // 1) Prefer the one with the largest value < current (deterministic)
    const valued = prevs
      .map(b => [b, this.parseBtnVal(b)])
      .filter(([, v]) => v !== null && v < curr)
      .sort((a, b) => b[1] - a[1]);
    if (valued.length) return valued[0][0];

    // 2) Fallback: any with explicit formnovalidate (EXT:form prev marker)
    const byAttr = prevs.find(b => b.hasAttribute('formnovalidate'));
    if (byAttr) return byAttr;

    // 3) Last resort: first prev candidate
    return prevs[0];
  }

  findNextButton(form) {
    const curr = this.getCurrentStepIndex(form) ?? 0;
    const nexts = this.getStepButtons(form)
      .filter(b => this.getStepType(b, form) === 'next'); // 'submit' ist hier bereits raus

    // nimm den mit dem kleinsten value > current
    return nexts
      .map(b => [b, this.parseBtnVal(b)])
      .filter(([, v]) => v !== null && v > curr)
      .sort((a, b) => a[1] - b[1])[0]?.[0] || null;
  }

  beginTransition({ direction }) {
    // direction: 'next' | 'prev'
    this.wrapper.classList.add('fc-transitioning', direction === 'prev' ? 'fc-dir-prev' : 'fc-dir-next');
  }
  endTransition() {
    this.wrapper.classList.remove('fc-transitioning', 'fc-dir-prev', 'fc-dir-next');
  }

  updateStepIndexAttr(form) {
    const idx = this.decodeStepIndexFromForm(form);  // <-- decode from form, not getCurrentStepIndex()
    if (Number.isInteger(idx)) {
      const prev = this.wrapper.dataset.stepIndex ? parseInt(this.wrapper.dataset.stepIndex, 10) : null;
      this.wrapper.dataset.stepIndex = String(idx);
      if (prev !== idx) {
        this.dispatch('stepIndexChange', { previous: prev, current: idx });
      }
      this.updateIndicators(idx); // or updateIndicatorsUnified(idx) if you use that
    } else {
      this.wrapper.removeAttribute('data-step-index');
    }
  }

  /**
   * Create (or reuse) indicator containers.
   * - For "dots": use a Bootstrap-compliant `.carousel-indicators` with <button> children.
   * - For "progress": use a separate `.fc-progress` container (not `.carousel-indicators`).
   * - For "none": nothing is created.
   */
  createIndicators() {
    if (this.wrapper.dataset.state === 'finished') return null;

    if (this.indicators === 'none') {
      // ensure any previous indicators are removed
      this.wrapper.querySelector(':scope > .carousel-indicators')?.remove();
      this.wrapper.querySelector(':scope > .fc-progress')?.remove();
      return null;
    }

    if (this.indicators === 'dots') {
      // ensure .carousel-indicators exists (Bootstrap structure)
      let dotsBox = this.wrapper.querySelector(':scope > .carousel-indicators');
      if (!dotsBox) {
        dotsBox = document.createElement('div');
        dotsBox.className = 'carousel-indicators';
        this.wrapper.insertBefore(dotsBox, this.wrapper.firstChild);
      }
      // remove any progress remnants
      this.wrapper.querySelector(':scope > .fc-progress')?.remove();
      return dotsBox;
    }

    if (this.indicators === 'progress') {
      // ensure .fc-progress exists (keep separate from .carousel-indicators)
      let progBox = this.wrapper.querySelector(':scope > .fc-progress');
      if (!progBox) {
        progBox = document.createElement('div');
        progBox.className = 'fc-progress d-flex flex-column align-items-center gap-1 mt-2';
        const label = document.createElement('div');
        label.className = 'fc-step-label small text-muted';
        const prog = document.createElement('div');
        prog.className = 'progress w-100';
        prog.innerHTML = '<div class="progress-bar" role="progressbar" style="width:0%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>';
        progBox.append(label, prog);

        const inner = this.wrapper.querySelector(':scope > .carousel-inner');
        // place progress right after slides (outside indicators)
        (inner ?? this.wrapper).insertAdjacentElement('afterend', progBox);
      }
      // remove any dots remnants
      this.wrapper.querySelector(':scope > .carousel-indicators')?.remove();
      return progBox;
    }

    return null;
  }

  /**
   * Update indicator state based on the current step index.
   * - Dots: create correct number of <button> and toggle `.active` + `aria-current`.
   * - Progress: update label and bar (0% at step index 0).
   */
  updateIndicators(currentIndex) {
    if (this.indicators === 'none') return;

    const total = parseInt(this.wrapper.dataset.steps || '', 10);
    const hasTotal = Number.isInteger(total) && total > 0;
    const safeIndex = Number.isInteger(currentIndex) ? currentIndex : 0;

    if (this.indicators === 'dots') {
      const box = this.createIndicators(); // ensures .carousel-indicators
      if (!box) return;

      const needed = hasTotal ? total : 1;
      const existing = box.querySelectorAll('button');

      // rebuild buttons only if count mismatches
      if (existing.length !== needed) {
        box.innerHTML = '';
        for (let i = 0; i < needed; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          // Indicators are not interactive in this integration
          btn.setAttribute('aria-label', `Slide ${i + 1}`);
          btn.setAttribute('tabindex', '-1');
          btn.setAttribute('aria-disabled', 'true');
          btn.addEventListener('click', (e) => e.preventDefault());
          box.appendChild(btn);
        }
      }

      // toggle active state
      box.querySelectorAll('button').forEach((btn, i) => {
        const isActive = i === safeIndex;
        btn.classList.toggle('active', isActive);
        if (isActive) {
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.removeAttribute('aria-current');
        }
      });

      // nothing else to do in dots mode
      this.dispatch('indicatorsUpdate', { index: safeIndex, total: this.getTotalStepsFromWrapper() });
      return;
    }

    if (this.indicators === 'progress') {
      const box = this.createIndicators(); // ensures .fc-progress
      if (!box) return;

      const label = box.querySelector('.fc-step-label');
      if (label) {
        label.textContent = hasTotal
          ? `Step ${safeIndex + 1} / ${total}`
          : `Step ${safeIndex + 1}`;
      }

      const bar = box.querySelector('.progress-bar');
      if (bar) {
        if (hasTotal && total > 0) {
          // show completion excluding current (0% at index 0)
          const pct = Math.round((Math.max(safeIndex, 0) / total) * 100);
          bar.classList.remove('progress-bar-striped', 'progress-bar-animated');
          bar.style.width = `${pct}%`;
          bar.setAttribute('aria-valuenow', String(pct));
        } else {
          // indeterminate feel
          bar.classList.add('progress-bar-striped', 'progress-bar-animated');
          bar.style.width = '100%';
          bar.removeAttribute('aria-valuenow');
        }
      }

      this.dispatch('indicatorsUpdate', { index: safeIndex, total: this.getTotalStepsFromWrapper() });
    }
  }

  // Ensure external controls exist as direct children of the wrapper (outside slides)
  ensureExternalControls() {
    let prev = this.wrapper.querySelector(':scope > .fc-control-prev');
    let next = this.wrapper.querySelector(':scope > .fc-control-next');

    if (!prev) {
      prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'fc-control-prev carousel-control-prev';
      prev.innerHTML = '<span class="carousel-control-prev-icon" aria-hidden="true"></span><span class="visually-hidden">Previous</span>';
      this.wrapper.insertBefore(prev, this.wrapper.firstChild);
    }
    if (!next) {
      next = document.createElement('button');
      next.type = 'button';
      next.className = 'fc-control-next carousel-control-next';
      next.innerHTML = '<span class="carousel-control-next-icon" aria-hidden="true"></span><span class="visually-hidden">Next</span>';
      this.wrapper.appendChild(next);
    }

    // click handlers (proxy to real buttons)
    if (!prev.dataset.fcWired) {
      prev.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isSubmitting || this.isNavigating) return;
        const form = this.wrapper.querySelector('form');
        const sub = form ? this.getOriginalPrev(form) : null;
        if (form && sub) this.submitStep(form, sub).catch(console.error);
      });
      prev.dataset.fcWired = '1';
    }
    if (!next.dataset.fcWired) {
      next.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isSubmitting || this.isNavigating) return;
        const form = this.wrapper.querySelector('form');
        const sub = form ? this.getOriginalNext(form) : null;
        if (form && sub) this.submitStep(form, sub).catch(console.error);
      });
      next.dataset.fcWired = '1';
    }
  }

  /*
   * Events
   */
  onClick(e) {
    const submitter = e.target.closest('button,[type="submit"],[data-step]');
    if (!submitter || !this.wrapper.contains(submitter)) return;
    if (!this.isStepSubmitter(submitter)) return;
    const form = this.getActiveForm();
    if (!form) return;
    e.preventDefault();
    this.submitStep(form, submitter).catch(err =>
      console.error('FC: submitStep error (click)', err)
    );
  }

  onSubmit(e) {
    if (!this.wrapper.contains(e.target)) return;
    const form = e.target;
    const submitter =
      e.submitter ||
      form.querySelector('button[type="submit"][name*="__currentPage"]') ||
      form.querySelector('[data-step]');
    if (!submitter || !this.isStepSubmitter(submitter)) return;
    e.preventDefault();
    this.submitStep(form, submitter).catch(err =>
      console.error('FC: submitStep error (submit)', err)
    );
  }

  getActiveItem() {
    // active slide, sonst erste, sonst zur Not der Wrapper
    return (
      this.wrapper.querySelector(':scope > .carousel-inner .carousel-item.active') ||
      this.wrapper.querySelector(':scope > .carousel-inner .carousel-item') ||
      this.wrapper
    );
  }

  // Prev = button with value === (currentIndex - 1)
  // Fallbacks only if you really want them (kept minimal here)
  getOriginalPrev(form) {
    const curr = this.decodeStepIndexFromForm(form);
    if (!Number.isInteger(curr) || curr <= 0) return null;

    // exact match
    const exact = this.getButtonByExactIndex(form, curr - 1);
    if (exact) return exact;

    // optional fallback (uncommon): explicit prev marker
    return this.getStepButtons(form).find(b => b.hasAttribute('formnovalidate')) || null;
  }

  // Next = button with value === (currentIndex + 1)
  // Do NOT treat submit as next (EXT:form sometimes uses value === total for submit)
  getOriginalNext(form) {
    const curr  = this.decodeStepIndexFromForm(form);
    if (!Number.isInteger(curr)) return null;

    const total = this.getTotalStepsFromWrapper(); // N
    const target = curr + 1;

    // if total known and target equals N => that's submit, not next
    if (total != null && target >= total) return null;

    // exact match
    return this.getButtonByExactIndex(form, target);
  }

  /**
   * Create/remove external proxy controls depending on availability.
   * - Create PREV only if an original 'prev' exists.
   * - Create NEXT only if an original 'next' (not 'submit') exists.
   * - Hide in-slide navigation to avoid animating those buttons.
   */
  updateExternalControls(form) {
    const origPrev = this.getOriginalPrev(form);
    const origNext = this.getOriginalNext(form);

    // ---- PREV ----
    let prev = this.wrapper.querySelector(':scope > .fc-control-prev');
    if (origPrev) {
      if (!prev) {
        prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'fc-control-prev carousel-control-prev';
        prev.innerHTML = '<span class="carousel-control-prev-icon" aria-hidden="true"></span><span class="visually-hidden">Previous</span>';
        this.wrapper.insertBefore(prev, this.wrapper.firstChild);
        prev.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.isSubmitting || this.isNavigating) return;
          const form = this.wrapper.querySelector('form');
          const sub = form ? this.getOriginalPrev(form) : null;
          if (form && sub) this.submitStep(form, sub).catch(console.error);
        });
      }
      prev.classList.remove('d-none');
    } else if (prev) {
      prev.remove(); // remove control if no prev
    }

    // ---- NEXT (exclude submit) ----
    let next = this.wrapper.querySelector(':scope > .fc-control-next');
    if (origNext) {
      if (!next) {
        next = document.createElement('button');
        next.type = 'button';
        next.className = 'fc-control-next carousel-control-next';
        next.innerHTML = '<span class="carousel-control-next-icon" aria-hidden="true"></span><span class="visually-hidden">Next</span>';
        this.wrapper.appendChild(next);
        next.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.isSubmitting || this.isNavigating) return;
          const form = this.wrapper.querySelector('form');
          const sub = form ? this.getOriginalNext(form) : null;
          if (form && sub) this.submitStep(form, sub).catch(console.error);
        });
      }
      next.classList.remove('d-none');
    } else if (next) {
      next.remove(); // remove control if no next (or only submit exists)
    }
  }

  // Core
  async submitStep(form, submitter) {
    const ceUid = this.wrapper.dataset.ceUid;
    this.ensureCarouselStructure();

    // Preflight: only for forward (next/submit)
    const stepType = this.getStepType(submitter, form);
    if (stepType !== 'prev' && !form.checkValidity()) {
      this.dispatch('validationFailed', { stepType, form, submitter });
      form.reportValidity?.();
      const firstInvalid = form.querySelector(':invalid, [aria-invalid="true"], .is-invalid');
      firstInvalid?.focus?.();
      firstInvalid?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Allow external hooks before submit (cancelable)
    const ev = this.dispatch('beforeSubmit', { stepType, form, submitter }, { cancelable: true });
    if (ev.defaultPrevented) return;

    // Build FormData before disabling
    let fd;
    try {
      fd = new FormData(form, submitter); // modern browsers
    } catch {
      fd = new FormData(form);
      const n = submitter?.getAttribute?.('name');
      if (n && !fd.has(n)) fd.set(n, submitter?.getAttribute?.('value') ?? '1');
    }
    if (![...fd.keys()].some(k => k.includes('__currentPage')) && submitter?.dataset?.step) {
      fd.set('tx_form_formframework[__currentPage]', submitter.dataset.step);
    }

    // Spinner on active slide
    // Debounce: skip if already running
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    // Spinner on active slide
    const inner = this.wrapper.querySelector('.carousel-inner');
    let currentItem = inner?.querySelector('.carousel-item.active') || this.wrapper;
    this.setLoading(true, currentItem);

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html' },
        ...this.options?.fetchInit,
      });

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      this.dispatch('afterResponse', { res, doc });

      // Find matching wrapper in response
      const freshWrapper =
        doc.querySelector(`.form-carousel[data-ce-uid="${ceUid}"]`) ||
        doc.querySelector(`[data-ce-uid="${ceUid}"]`) ||
        null;

      const nextForm = freshWrapper?.querySelector('form') || null;

      // Thank-you content inside same CE (no form): render inline
      if (freshWrapper && !nextForm) {
        this.setLoading(false, currentItem);
        this.wrapper.innerHTML = freshWrapper.innerHTML;
        this.wrapper.classList.remove('carousel', 'slide');
        this.wrapper.setAttribute('data-state', 'finished');
        this.wrapper.removeAttribute('data-step-index');
        const ind = this.wrapper.querySelector(':scope > .carousel-indicators');
        if (ind) ind.remove(); // sauber aus dem DOM
        this.unlockUi();
        this.dispatch('finished', { wrapper: this.wrapper });
        return;
      }

      // D) Redirect (res.redirected || res.url)
      if (!freshWrapper && (res.redirected || res.url)) {
        // keep overlay on, lock UI, and keep isSubmitting true until unload
        this.isNavigating = true;
        this.lockUi();
        this.setLoading(true, currentItem);
        this.dispatch('redirect', { url: res.url });
        window.location.href = res.url;
        return;
      }

      // Fallback navigate
      if (!nextForm) {
        this.isNavigating = true;
        this.lockUi();
        this.setLoading(true, currentItem);
        if (res.url) window.location.href = res.url;
        return;
      }

      // Server-side errors: replace form in current slide (no slide transition)
      if (this.hasServerErrors(nextForm)) {
        this.setLoading(false, currentItem);
        currentItem.querySelector('form')?.replaceWith(nextForm);
        // Add error-cleanup listeners once per field
        nextForm.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.dataset.fcCleanListener === '1') return;
          const cleaner = () => {
            el.classList.remove('error', 'is-invalid');
            el.removeAttribute('aria-invalid');
          };
          el.addEventListener('input', cleaner);
          el.addEventListener('change', cleaner);
          el.dataset.fcCleanListener = '1';
        });
        this.updateStepIndexAttr(nextForm);
        this.updateExternalControls(nextForm);
        this.focusFirstProblem(nextForm);
        this.dispatch('serverError', { form: nextForm });
        return;
      }

      // Success: slide after response
      this.setLoading(false, currentItem);
      const nextItem = document.createElement('div');
      nextItem.className = 'carousel-item';
      nextItem.appendChild(nextForm);
      const isPrev = (stepType === 'prev');
      const direction = isPrev ? 'prev' : 'next';
      // mark transition
      this.beginTransition({ direction });
      // Build next slide and insert
      inner.appendChild(nextItem);
      this.updateExternalControls(nextForm);

      // Update index and decorate controls BEFORE animation starts
      this.updateStepIndexAttr(nextForm);
      this.dispatch('beforeSlide', { direction });

      // Start transition classes...
      nextItem.classList.add(isPrev ? 'carousel-item-prev' : 'carousel-item-next');

      // reflow
      nextItem.offsetHeight;

      // add own transition marker
      currentItem.classList.add('fc-leave');
      nextItem.classList.add('fc-enter');

      if (isPrev) {
        currentItem.classList.add('carousel-item-end');
        nextItem.classList.add('carousel-item-end');
      } else {
        currentItem.classList.add('carousel-item-start');
        nextItem.classList.add('carousel-item-start');
      }

      await this.transitionEnd(nextItem);

      nextItem.classList.remove(
        'carousel-item-prev',
        'carousel-item-next',
        'carousel-item-start',
        'carousel-item-end',
        'fc-enter'
      );
      nextItem.classList.add('active');
      this.endTransition();
      currentItem.remove();
      this.updateStepIndexAttr(nextForm);

      this.dispatch('afterSlide', {
        direction: (stepType === 'prev') ? 'prev' : 'next',
        form: nextForm,
      });
      const invalid = nextItem.querySelector('.is-invalid,[aria-invalid="true"],.has-error input');
      (invalid ||
        nextItem.querySelector('input,select,textarea,button,legend,h1,h2,h3'))?.focus?.();
    } catch (err) {
      console.error('FC: submitStep error', err);
    } finally {
      if (!this.isNavigating) {
        this.isSubmitting = false;
        const activeItem = this.getActiveItem();
        if (activeItem) this.setLoading(false, activeItem);
        this.unlockUi();
      }
    }
  }

  ensureCarouselStructure() {
    // already prepared?
    if (this.wrapper.querySelector(':scope > .carousel-inner')) return;

    const form = this.wrapper.querySelector(':scope > form');
    if (!form) return; // nothing to wrap (e.g. final screen)

    const inner = document.createElement('div');
    inner.className = 'carousel-inner';

    const item = document.createElement('div');
    item.className = 'carousel-item active';

    item.appendChild(form);
    inner.appendChild(item);
    this.wrapper.appendChild(inner);

    // indicators belong after slides → will place/reposition if needed
    this.createIndicators();

    // make sure index is visible from the start
    this.updateStepIndexAttr(form);
  }

  /**
   * Wait until a CSS transition on the element has finished.
   * Falls back to computed duration/delay, default 800ms if nothing found.
   */
  transitionEnd(el) {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      el.addEventListener('transitionend', ev => {
        if (ev.target === el) finish();
      }, { once: true });

      // compute max transition duration + delay
      const cs = getComputedStyle(el);
      const toNum = s => {
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      };
      const dur = (cs.transitionDuration || '0s').split(',').map(toNum);
      const del = (cs.transitionDelay || '0s').split(',').map(toNum);
      const ms  = Math.max(0, ...dur.map((d, i) => ((d + (del[i] || 0)) * 1000)));
      setTimeout(finish, ms || 800);
    });
  }

  // Bootstrap-based overlay on the active slide
  setLoading(isLoading, targetEl) {
    const target =
      targetEl || this.wrapper.querySelector('.carousel-inner .carousel-item.active');
    if (!target) return;

    target.classList.add('position-relative');

    const form = target.querySelector('form');
    if (form) {
      form.querySelectorAll('input,select,textarea,button').forEach(el => {
        if (el.type !== 'hidden') el.disabled = !!isLoading;
      });
    }

    let overlay = target.querySelector(':scope > .fc-loading');
    if (isLoading) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = [
          'fc-loading',
          'position-absolute',
          'top-0',
          'start-0',
          'w-100',
          'h-100',
          'd-flex',
          'align-items-center',
          'justify-content-center',
          'bg-body',
          'bg-opacity-50'
        ].join(' ');
        overlay.innerHTML = `
          <div class="spinner-border" role="status" aria-live="polite">
            <span class="visually-hidden">Loading…</span>
          </div>`;
        target.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  }
}
