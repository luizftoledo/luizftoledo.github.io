// ============================================================================
// BASE JAVASCRIPT FOR INVESTIGATIVE PORTFOLIO SCROLLYTELLING PAGES
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize language toggle
  initLanguageToggle();
  
  // Initialize disclaimer bar
  initDisclaimerBar();
  
  // Initialize progress bar
  initProgressBar();
  
  // Initialize fade-in animations
  initFadeInAnimations();
  
  // Initialize stat counters
  initStatCounters();
});

// ============================================================================
// LANGUAGE TOGGLE FUNCTIONALITY
// ============================================================================

function initLanguageToggle() {
  const btnEn = document.getElementById('btnEn');
  const btnPt = document.getElementById('btnPt');
  
  if (!btnEn || !btnPt) return;
  
  // Get stored language preference or default to English
  const currentLang = localStorage.getItem('portfolio-lang') || 'en';
  setLanguage(currentLang);
  
  btnEn.addEventListener('click', function() {
    setLanguage('en');
  });
  
  btnPt.addEventListener('click', function() {
    setLanguage('pt');
  });
}

function setLanguage(lang) {
  const body = document.body;
  
  // Update body class and data-lang attribute
  if (lang === 'pt') {
    body.classList.remove('lang-en');
    body.classList.add('lang-pt');
    body.setAttribute('data-lang', 'pt');
  } else {
    body.classList.remove('lang-pt');
    body.classList.add('lang-en');
    body.setAttribute('data-lang', 'en');
  }
  
  // Update button states
  const btnEn = document.getElementById('btnEn');
  const btnPt = document.getElementById('btnPt');
  
  if (btnEn) {
    btnEn.classList.toggle('active', lang === 'en');
  }
  if (btnPt) {
    btnPt.classList.toggle('active', lang === 'pt');
  }
  
  // Save preference
  localStorage.setItem('portfolio-lang', lang);
}

// ============================================================================
// DISCLAIMER BAR FUNCTIONALITY
// ============================================================================

function initDisclaimerBar() {
  const disclaimerBar = document.getElementById('disclaimerBar');
  const disclaimerClose = document.getElementById('disclaimerClose');
  
  if (!disclaimerBar || !disclaimerClose) return;
  
  // Check if user has previously closed the disclaimer
  const disclaimerClosed = sessionStorage.getItem('disclaimer-closed');
  
  if (disclaimerClosed) {
    disclaimerBar.classList.add('hidden');
  }
  
  disclaimerClose.addEventListener('click', function() {
    disclaimerBar.classList.add('hidden');
    sessionStorage.setItem('disclaimer-closed', 'true');
  });
}

// ============================================================================
// PROGRESS BAR FUNCTIONALITY
// ============================================================================

function initProgressBar() {
  const progressBar = document.getElementById('progressBar');
  
  if (!progressBar) return;
  
  window.addEventListener('scroll', function() {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  });
}

// ============================================================================
// FADE-IN ANIMATIONS ON SCROLL
// ============================================================================

function initFadeInAnimations() {
  const elements = document.querySelectorAll('.fade-in, .text-section, .pullquote, .stats-section, .series-grid');
  
  if (!elements.length) return;
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });
  
  elements.forEach(function(element) {
    observer.observe(element);
  });
}

// ============================================================================
// STAT COUNTER ANIMATION
// ============================================================================

function initStatCounters() {
  const statCards = document.querySelectorAll('.stat-card[data-count]');
  
  if (!statCards.length) return;
  
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        animateCounter(entry.target);
        entry.target.dataset.counted = 'true';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.5
  });
  
  statCards.forEach(function(card) {
    observer.observe(card);
  });
}

function animateCounter(element) {
  const targetValue = element.getAttribute('data-count');
  const numberElement = element.querySelector('.stat-number');
  
  if (!numberElement) return;
  
  // Extract numeric value and suffix
  const match = String(targetValue).match(/^(\d+)(.*)/);
  const target = parseInt(match ? match[1] : 0);
  const suffix = match ? match[2] : '';
  
  let current = 0;
  const increment = Math.ceil(target / 30); // Animate over ~30 frames
  const interval = 50; // 50ms per frame
  
  const timer = setInterval(function() {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    numberElement.textContent = current + suffix;
  }, interval);
}

// ============================================================================
// UTILITY: Smooth scroll for anchor links
// ============================================================================

document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href !== '#') {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});
