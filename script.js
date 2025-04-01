// Scroll Progress Indicator with faster animation
const scrollProgress = document.createElement('div');
scrollProgress.className = 'scroll-progress';
document.body.appendChild(scrollProgress);

let lastScrollTop = 0;
let ticking = false;

window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.scrollY / windowHeight) * 100;
            const scrollDirection = window.scrollY > lastScrollTop ? 'down' : 'up';
            
            scrollProgress.style.transform = `scaleX(${scrolled / 100})`;
            lastScrollTop = window.scrollY;
            
            // Faster direction-based animations
            document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right, .scale-in').forEach(el => {
                if (el.getBoundingClientRect().top < window.innerHeight * 0.8) {
                    el.classList.add('visible');
                    if (scrollDirection === 'up') {
                        el.style.animationDelay = '0s';
                    }
                }
            });
            
            ticking = false;
        });
        ticking = true;
    }
});

// Faster Scroll Reveal Animation
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            const delay = entry.target.dataset.delay || 0;
            
            requestAnimationFrame(() => {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, delay);
            });
        } else {
            entry.target.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            entry.target.style.opacity = '0';
            entry.target.style.transform = 'translateY(20px)';
        }
    });
}, observerOptions);

// Add animation classes with faster staggered delays
document.addEventListener('DOMContentLoaded', () => {
    // Sections with faster fade-in
    document.querySelectorAll('section').forEach((section, index) => {
        section.classList.add('fade-in');
        section.dataset.delay = index * 80; // Reduced from 150
        observer.observe(section);
    });

    // Feature cards with faster alternating slide-in
    document.querySelectorAll('.feature-card').forEach((card, index) => {
        card.classList.add(index % 2 === 0 ? 'slide-in-left' : 'slide-in-right');
        card.dataset.delay = index * 100; // Reduced from 200
        observer.observe(card);
    });

    // Pricing cards with faster scale-in
    document.querySelectorAll('.pricing-card').forEach((card, index) => {
        card.classList.add('scale-in');
        card.dataset.delay = index * 120; // Reduced from 250
        observer.observe(card);
    });

    // Testimonials with faster fade-in
    document.querySelectorAll('.testimonial-card').forEach((card, index) => {
        card.classList.add('fade-in');
        card.dataset.delay = index * 100; // Reduced from 200
        observer.observe(card);
    });

    // Team members with faster alternating slide-in
    document.querySelectorAll('.team-member').forEach((member, index) => {
        member.classList.add(index % 2 === 0 ? 'slide-in-left' : 'slide-in-right');
        member.dataset.delay = index * 120; // Reduced from 250
        observer.observe(member);
    });

    // Value cards with faster scale-in
    document.querySelectorAll('.value-card').forEach((card, index) => {
        card.classList.add('scale-in');
        card.dataset.delay = index * 100; // Reduced from 200
        observer.observe(card);
    });

    // Faster parallax effect
    const hero = document.querySelector('.hero');
    if (hero) {
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    hero.style.backgroundPositionY = scrolled * 0.3 + 'px'; // Reduced from 0.5
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // Faster floating animation for feature icons
    document.querySelectorAll('.feature-card i').forEach(icon => {
        icon.style.animation = 'float 2s ease-in-out infinite'; // Reduced from 3s
    });
});

// Faster smooth scroll with easing
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            // Faster smooth scroll
            const startPosition = window.pageYOffset;
            const distance = offsetPosition - startPosition;
            const duration = 600; // Reduced from 1000
            let start = null;

            function animation(currentTime) {
                if (start === null) start = currentTime;
                const timeElapsed = currentTime - start;
                const run = ease(timeElapsed, startPosition, distance, duration);
                window.scrollTo(0, run);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            }

            function ease(t, b, c, d) {
                t /= d / 2;
                if (t < 1) return c / 2 * t * t + b;
                t--;
                return -c / 2 * (t * (t - 2) - 1) + b;
            }

            requestAnimationFrame(animation);
        }
    });
});

// Faster hover effects
document.querySelectorAll('.cta-primary, .cta-secondary, .pricing-btn, .support-btn').forEach(button => {
    button.addEventListener('mouseenter', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.style.setProperty('--x', `${x}px`);
        this.style.setProperty('--y', `${y}px`);
    });
});

// Faster scroll-based animations for team member images
document.querySelectorAll('.member-image img').forEach(img => {
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const speed = 0.3; // Reduced from 0.5
                img.style.transform = `translateY(${scrolled * speed}px)`;
                ticking = false;
            });
            ticking = true;
        }
    });
});

// Faster floating animation
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
        100% { transform: translateY(0px); }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function() {
    // Get existing menu toggle button and menu
    const menuToggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('nav ul');

    // Handle menu toggle
    menuToggle.addEventListener('click', function() {
        menu.classList.toggle('active');
        menuToggle.classList.toggle('active');
        
        // Update aria-expanded attribute for accessibility
        const isExpanded = menu.classList.contains('active');
        menuToggle.setAttribute('aria-expanded', isExpanded);
        
        // Animate icon
        menuToggle.innerHTML = isExpanded 
            ? '<i class="fas fa-times"></i>' 
            : '<i class="fas fa-bars"></i>';
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        const nav = document.querySelector('nav');
        if (!nav.contains(event.target) && menu.classList.contains('active')) {
            menu.classList.remove('active');
            menuToggle.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });

    // Close menu when clicking on a link
    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            menuToggle.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });

    // Close menu on window resize if switching to desktop view
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && menu.classList.contains('active')) {
            menu.classList.remove('active');
            menuToggle.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });

    // Add scroll animation to elements
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .value-card, .team-member').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}); 