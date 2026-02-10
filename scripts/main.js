/**
 * main.js
 * Main JavaScript file for luizftoledo.github.io
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Reading progress bar
  const progressBar = document.getElementById('progressBar');
  const updateProgress = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const p = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = p + '%';
  };
  window.addEventListener('scroll', updateProgress);
  window.addEventListener('load', updateProgress);

  // Back to top button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-to-top';
  backBtn.innerHTML = '↑';
  backBtn.title = 'Back to top';
  backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(backBtn);
  const toggleBackBtn = () => {
    if (window.scrollY > 400) backBtn.classList.add('show'); else backBtn.classList.remove('show');
  };
  window.addEventListener('scroll', toggleBackBtn);
  window.addEventListener('load', toggleBackBtn);

  // Anchor links copy for section titles
  document.querySelectorAll('.section h2').forEach(h => {
    const id = h.parentElement?.id || h.textContent?.toLowerCase().replace(/\s+/g, '-');
    if (!h.parentElement?.id && id) h.parentElement?.setAttribute('id', id);
    h.style.cursor = 'pointer';
    h.addEventListener('click', () => {
      const url = location.origin + location.pathname + '#' + (h.parentElement?.id || id || '');
      navigator.clipboard.writeText(url).then(() => {
        // Optional: User feedback could be improved here
        const originalTitle = h.title;
        h.title = 'Link copied';
        setTimeout(() => (h.title = originalTitle), 1200);
      });
    });
  });

  // Hero Video Carousel Logic
  const track = document.querySelector('.carousel-track');
  if (track) {
    const slides = Array.from(track.children);
    const nextButton = document.querySelector('.carousel-button--right');
    const prevButton = document.querySelector('.carousel-button--left');
    const dotsNav = document.querySelector('.carousel-nav');
    const dots = Array.from(dotsNav.children);

    const slideWidth = slides[0].getBoundingClientRect().width;

    // Arrange the slides next to one another
    const setSlidePosition = (slide, index) => {
      slide.style.left = slideWidth * index + 'px';
    };
    slides.forEach(setSlidePosition);

    const moveToSlide = (track, currentSlide, targetSlide) => {
      track.style.transform = 'translateX(-' + targetSlide.style.left + ')';
      currentSlide.classList.remove('current-slide');
      targetSlide.classList.add('current-slide');

      // Manage video playback
      manageVideoPlayback(currentSlide, targetSlide);
    }

    const updateDots = (currentDot, targetDot) => {
      currentDot.classList.remove('current-slide');
      targetDot.classList.add('current-slide');
    }

    const hideShowArrows = (slides, prevButton, nextButton, targetIndex) => {
      if (targetIndex === 0) {
        prevButton.classList.add('is-hidden');
        nextButton.classList.remove('is-hidden');
      } else if (targetIndex === slides.length - 1) {
        prevButton.classList.remove('is-hidden');
        nextButton.classList.add('is-hidden');
      } else {
        prevButton.classList.remove('is-hidden');
        nextButton.classList.remove('is-hidden');
      }
    }

    // Function to control YouTube videos via postMessage
    const manageVideoPlayback = (fromSlide, toSlide) => {
      // Pause the video we are leaving
      const fromIframe = fromSlide.querySelector('iframe');
      if (fromIframe) {
        fromIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      }

      // Play the video we are entering
      const toIframe = toSlide.querySelector('iframe');
      if (toIframe) {
        toIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
    }

    if (prevButton) {
      prevButton.addEventListener('click', e => {
        const currentSlide = track.querySelector('.current-slide');
        const prevSlide = currentSlide.previousElementSibling;
        const currentDot = dotsNav.querySelector('.current-slide');
        const prevDot = currentDot.previousElementSibling;
        const prevIndex = slides.findIndex(slide => slide === prevSlide);

        moveToSlide(track, currentSlide, prevSlide);
        updateDots(currentDot, prevDot);
        hideShowArrows(slides, prevButton, nextButton, prevIndex);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', e => {
        const currentSlide = track.querySelector('.current-slide');
        const nextSlide = currentSlide.nextElementSibling;
        const currentDot = dotsNav.querySelector('.current-slide');
        const nextDot = currentDot.nextElementSibling;
        const nextIndex = slides.findIndex(slide => slide === nextSlide);

        moveToSlide(track, currentSlide, nextSlide);
        updateDots(currentDot, nextDot);
        hideShowArrows(slides, prevButton, nextButton, nextIndex);
      });
    }

    if (dotsNav) {
      dotsNav.addEventListener('click', e => {
        const targetDot = e.target.closest('button');

        if (!targetDot) return;

        const currentSlide = track.querySelector('.current-slide');
        const currentDot = dotsNav.querySelector('.current-slide');
        const targetIndex = dots.findIndex(dot => dot === targetDot);
        const targetSlide = slides[targetIndex];

        moveToSlide(track, currentSlide, targetSlide);
        updateDots(currentDot, targetDot);
        hideShowArrows(slides, prevButton, nextButton, targetIndex);
      });
    }

    // Recalculate slide positions on resize
    window.addEventListener('resize', () => {
      const newSlideWidth = slides[0].getBoundingClientRect().width;
      slides.forEach((slide, index) => {
        slide.style.left = newSlideWidth * index + 'px';
      });
      const currentSlide = track.querySelector('.current-slide');
      // Re-center current slide
      const targetIndex = slides.findIndex(slide => slide === currentSlide);
      track.style.transform = 'translateX(-' + (newSlideWidth * targetIndex) + 'px)';
    });
  }

  // Reels Carousel Logic
  const reelsContainer = document.querySelector('.reels-carousel');
  const reelsLeftBtn = document.querySelector('.reels-btn-left');
  const reelsRightBtn = document.querySelector('.reels-btn-right');

  if (reelsContainer && reelsLeftBtn && reelsRightBtn) {
    reelsLeftBtn.addEventListener('click', () => {
      reelsContainer.scrollBy({ left: -320, behavior: 'smooth' });
    });
    reelsRightBtn.addEventListener('click', () => {
      reelsContainer.scrollBy({ left: 320, behavior: 'smooth' });
    });
  }

  // Scroll Reveal with IntersectionObserver
  const revealElements = document.querySelectorAll('[data-reveal]');
  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add staggered delay for sibling elements (e.g. cards in a grid)
          const parent = entry.target.parentElement;
          const siblings = parent ? Array.from(parent.querySelectorAll(':scope > [data-reveal]')) : [];
          const index = siblings.indexOf(entry.target);
          const delay = siblings.length > 1 ? index * 80 : 0;

          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);

          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  }
});
