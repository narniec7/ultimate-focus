// ========================================
// SUPERFOCUS — ACCORDION SIDEBAR + READING UX
// ========================================

(function() {
    'use strict';

    // ========================================
    // 1. READING PROGRESS BAR
    // ========================================
    function updateReadingProgress() {
        const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        const bar = document.querySelector('.reading-progress');
        if (bar) bar.style.width = scrolled + '%';
    }

    // ========================================
    // 2. MENU STATE PERSISTENCE
    // ========================================
    function saveMenuState() {
        try {
            var openGroups = [];
            document.querySelectorAll('.toc-group.open').forEach(function(group) {
                var link = group.querySelector('.toc-label');
                if (link && link.getAttribute('href')) {
                    openGroups.push(link.getAttribute('href'));
                }
            });
            localStorage.setItem('superfocus-menu-state', JSON.stringify(openGroups));
        } catch (e) {
            console.warn('Failed to save menu state:', e);
        }
    }

    function restoreMenuState() {
        try {
            var saved = localStorage.getItem('superfocus-menu-state');
            if (!saved) return;
            var openGroups = JSON.parse(saved);

            openGroups.forEach(function(href) {
                var link = document.querySelector('.toc-label[href="' + CSS.escape(href) + '"]');
                if (link) {
                    var group = link.closest('.toc-group');
                    if (group) {
                        group.classList.add('open');
                        var btn = group.querySelector('.toc-toggle-btn');
                        if (btn) btn.textContent = '−';
                    }
                }
            });
        } catch (e) {
            console.warn('Failed to restore menu state:', e);
        }
    }

    // ========================================
    // 3. SIMPLE ACCORDION TOC
    // ========================================
    function buildAccordionTOC() {
        var tocList = document.querySelector('.toc-list');
        if (!tocList) return;

        var items = Array.from(tocList.querySelectorAll('li'));
        var groups = [];
        var current = null;

        // Group sub-link items under their preceding top-level item
        items.forEach(function(li) {
            if (li.classList.contains('sub-link')) {
                if (current) current.subs.push(li);
            } else {
                current = { link: li.querySelector('.toc-link'), subs: [] };
                groups.push(current);
            }
        });

        tocList.innerHTML = '';

        groups.forEach(function(group) {
            var hasKids = group.subs.length > 0;
            var wrapper = document.createElement('li');
            wrapper.className = 'toc-group';

            if (hasKids) {
                // Entire row is clickable to toggle
                var row = document.createElement('div');
                row.className = 'toc-group-row';

                // Toggle function
                function toggleGroup(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Check current state BEFORE toggling
                    var wasOpen = wrapper.classList.contains('open');

                    // If closing, just close
                    if (wasOpen) {
                        wrapper.classList.remove('open');
                        btn.textContent = '+';
                        saveMenuState();
                        return;
                    }

                    // If opening, close ALL other groups first
                    document.querySelectorAll('.toc-group.open').forEach(function(g) {
                        if (g !== wrapper) {
                            g.classList.remove('open');
                            var b = g.querySelector('.toc-toggle-btn');
                            if (b) b.textContent = '+';
                        }
                    });

                    // Then open this one
                    wrapper.classList.add('open');
                    btn.textContent = '−';
                    saveMenuState();
                }

                var btn = document.createElement('span');
                btn.className = 'toc-toggle-btn';
                btn.textContent = '+';

                var label = group.link.cloneNode(true);
                label.className = 'toc-label toc-link';

                // Make ENTIRE row clickable
                row.addEventListener('click', toggleGroup);
                row.style.cursor = 'pointer';

                row.appendChild(btn);
                row.appendChild(label);

                wrapper.appendChild(row);

                // Sub-items
                var subList = document.createElement('ul');
                subList.className = 'toc-sub-list';
                group.subs.forEach(function(sub) {
                    var subLi = document.createElement('li');
                    subLi.className = 'toc-sub-item';
                    var subA = sub.querySelector('.toc-link');
                    if (subA) subLi.appendChild(subA.cloneNode(true));
                    subList.appendChild(subLi);
                });
                wrapper.appendChild(subList);
            } else {
                // No children — just a link
                var linkClone = group.link.cloneNode(true);
                linkClone.className = 'toc-link toc-plain';
                wrapper.appendChild(linkClone);
            }

            tocList.appendChild(wrapper);
        });
    }

    // ========================================
    // 4. SCROLL-BASED ACTIVE HIGHLIGHT
    // ========================================
    function highlightCurrent() {
        var headings = document.querySelectorAll('h1[id], h2[id], h3[id]');
        if (headings.length === 0) return;

        var scrollPos = window.pageYOffset + 150;
        var currentId = null;

        for (var i = headings.length - 1; i >= 0; i--) {
            if (headings[i].offsetTop <= scrollPos) {
                currentId = headings[i].getAttribute('id');
                break;
            }
        }
        if (!currentId) return;

        // Remove old active
        document.querySelectorAll('.toc-link.active').forEach(function(el) { el.classList.remove('active'); });

        // Highlight matching link
        var found = document.querySelector('.toc-link[href="#' + CSS.escape(currentId) + '"]');
        if (found) {
            found.classList.add('active');
            // Don't auto-open groups — let user control that manually
        }
    }



    // ========================================
    // 5. SMOOTH SCROLL FOR TOC LINKS
    // ========================================
    var isAutoScrolling = false;
    var scrollTimeout;
    var userScrollBlocked = false;

    // Block user scroll during programmatic scroll
    function blockUserScroll(e) {
        if (userScrollBlocked) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    // Block keyboard scroll (arrows, space, page up/down)
    function blockKeyboardScroll(e) {
        if (userScrollBlocked) {
            var keys = [32, 33, 34, 35, 36, 37, 38, 39, 40]; // space, page up/down, home, end, arrows
            if (keys.indexOf(e.keyCode) > -1) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    }

    document.addEventListener('click', function(e) {
        var link = e.target.closest('.toc-link');
        if (!link) return;

        // Don't handle clicks on .toc-label (group headers) — those toggle the group
        if (link.classList.contains('toc-label')) return;

        e.preventDefault();
        var id = link.getAttribute('href');

        // Fix: Use getElementById to avoid querySelector crash on IDs starting with numbers
        var targetId = id.startsWith('#') ? id.substring(1) : id;
        var target = document.getElementById(targetId);
        if (!target) return;

        // Block user scroll (mouse, touch, keyboard)
        userScrollBlocked = true;
        document.addEventListener('wheel', blockUserScroll, { passive: false });
        document.addEventListener('touchmove', blockUserScroll, { passive: false });
        document.addEventListener('keydown', blockKeyboardScroll, { passive: false });

        isAutoScrolling = true;
        clearTimeout(scrollTimeout);

        // Calculate target position with larger offset to avoid header overlap
        var targetTop = target.offsetTop - 120;

        // Use smooth scroll with short duration
        window.scrollTo({ top: targetTop, behavior: 'smooth' });

        // Unblock after scroll completes (500ms is enough for smooth scroll)
        scrollTimeout = setTimeout(function() {
            isAutoScrolling = false;
            userScrollBlocked = false;
            document.removeEventListener('wheel', blockUserScroll);
            document.removeEventListener('touchmove', blockUserScroll);
            document.removeEventListener('keydown', blockKeyboardScroll);
            highlightCurrent();
        }, 500);

        // Close mobile sidebar
        var sidebar = document.querySelector('.toc-sidebar');
        if (sidebar && window.innerWidth <= 1024) {
            sidebar.classList.remove('open');
            var toggle = document.querySelector('.toc-toggle-mobile');
            if (toggle) toggle.innerHTML = '☰';
        }
    });

    // ========================================
    // 6. MOBILE TOC TOGGLE (always created, CSS shows/hides)
    // ========================================
    function setupMobileToggle() {
        const sidebar = document.querySelector('.toc-sidebar');
        if (!sidebar) return;

        // Remove old toggle if any
        const oldToggle = document.querySelector('.toc-toggle-mobile');
        if (oldToggle) oldToggle.remove();

        const toggle = document.createElement('button');
        toggle.className = 'toc-toggle-mobile';
        toggle.innerHTML = '☰';
        toggle.setAttribute('aria-label', 'Открыть содержание');
        document.body.appendChild(toggle);

        toggle.addEventListener('click', function() {
            const isOpen = sidebar.classList.toggle('open');
            toggle.innerHTML = isOpen ? '✕' : '☰';
            toggle.setAttribute('aria-label', isOpen ? 'Закрыть содержание' : 'Открыть содержание');
        });

        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (!sidebar.classList.contains('open')) return;
            if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
                toggle.innerHTML = '☰';
                toggle.setAttribute('aria-label', 'Открыть содержание');
            }
        });

        // Close on Escape (only if sidebar is open)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                toggle.innerHTML = '☰';
                toggle.setAttribute('aria-label', 'Открыть содержание');
            }
        });
    }

    setupMobileToggle();

    // ========================================
    // 7. KEYBOARD NAVIGATION (Alt+↑↓ between h2 sections)
    // ========================================
    document.addEventListener('keydown', function(e) {
        if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            var headings = Array.from(document.querySelectorAll('h2[id]'));
            if (headings.length === 0) return;
            var scrollPos = window.pageYOffset + 150;
            var idx = -1;
            for (var i = 0; i < headings.length; i++) {
                if (headings[i].offsetTop > scrollPos) { idx = i; break; }
            }
            if (idx === -1) idx = headings.length - 1;
            if (e.key === 'ArrowUp') idx = Math.max(0, idx - 1);
            else idx = Math.min(headings.length - 1, idx);
            window.scrollTo({ top: headings[idx].offsetTop - 120, behavior: 'smooth' });
        }
    });

    // ========================================
    // 8. SCROLL TO TOP BUTTON
    // ========================================
    const scrollTopBtn = document.getElementById('scrollTopBtn');

    function toggleScrollTopButton() {
        if (!scrollTopBtn) return;
        var shouldShow = window.pageYOffset > 500;
        var isVisible = scrollTopBtn.classList.contains('visible');
        if (shouldShow && !isVisible) {
            scrollTopBtn.classList.add('visible');
        } else if (!shouldShow && isVisible) {
            scrollTopBtn.classList.remove('visible');
        }
    }

    window.addEventListener('scroll', toggleScrollTopButton);

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ========================================
    // 9. FADE IN SECTIONS ON SCROLL
    // ========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const fadeInObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('h2[id]').forEach(heading => {
        heading.classList.add('fade-in-section');
        fadeInObserver.observe(heading);
    });

    // ========================================
    // 10. UPDATE READING INFO (Chapter & Progress)
    // ========================================
    function updateReadingInfo() {
        const headings = document.querySelectorAll('h2[id]');
        const scrollPos = window.pageYOffset + 150;
        let currentChapter = 1;

        headings.forEach((heading, index) => {
            if (heading.offsetTop <= scrollPos) {
                currentChapter = index + 1;
            }
        });

        const currentChapterEl = document.querySelector('.current-chapter');
        if (currentChapterEl && headings.length > 0) {
            currentChapterEl.textContent = `Глава ${currentChapter}/${headings.length}`;
        }

        // Update progress percentage in TOC
        const scrollTop = window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

        const progressPercent = document.querySelector('.progress-percent');
        if (progressPercent) {
            progressPercent.textContent = `${scrollPercent}%`;
        }
    }

    // Combined scroll handler
    var combinedScrollTicking = false;
    window.addEventListener('scroll', function() {
        if (!combinedScrollTicking) {
            requestAnimationFrame(function() {
                updateReadingProgress();
                if (!isAutoScrolling) {
                    highlightCurrent();
                }
                updateReadingInfo();
                toggleScrollTopButton();
                combinedScrollTicking = false;
            });
            combinedScrollTicking = true;
        }
    });

    // ========================================
    // 11. INITIALIZE
    // ========================================
    window.addEventListener('load', function() {
        buildAccordionTOC();
        restoreMenuState(); // Restore menu state after building TOC
        updateReadingProgress();
        highlightCurrent();
        updateReadingInfo();
        toggleScrollTopButton();

        // Scroll TOC sidebar to active item on load
        var activeLink = document.querySelector('.toc-link.active');
        var sidebar = document.querySelector('.toc-sidebar');
        if (activeLink && sidebar) {
            // Scroll to the active link so it is vertically centered in the sidebar
            sidebar.scrollTop = activeLink.offsetTop - (sidebar.offsetHeight / 2) + 50;
        }
    });

    // ========================================
    // 12. CONSOLE INFO
    // ========================================
    console.log('%cСуперФокус — Система Концентрации', 'font-size: 18px; font-weight: bold; color: #e8e8e8;');
    console.log('%cУлучшенный дизайн · Плавные переходы · Интерактивная навигация', 'font-size: 11px; color: #888;');
    console.log('%cНавигация: Alt+↓↑ между разделами', 'font-size: 11px; color: #666;');

    // ========================================
    // 13. GRAIN CANVAS NOISE EFFECT
    // ========================================
    const canvas = document.getElementById('grain-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let animId;
        const noiseSize = 512;
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = noiseSize;
        patternCanvas.height = noiseSize;
        const pCtx = patternCanvas.getContext('2d');
        const img = pCtx.createImageData(noiseSize, noiseSize);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const v = ((Math.random() + Math.random()) * 0.5 * 255) | 0;
            d[i] = d[i+1] = d[i+2] = v; 
            d[i+3] = 255;
        }
        pCtx.putImageData(img, 0, 0);
        let pattern;

        function resizeCanvas() {
            // No DPR scaling to keep grain dots slightly soft/organic
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            pattern = ctx.createPattern(patternCanvas, 'repeat');
        }
        
        function renderGrain() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = pattern;
            
            const offsetX = (Math.random() * noiseSize) | 0;
            const offsetY = (Math.random() * noiseSize) | 0;
            
            ctx.translate(offsetX, offsetY);
            ctx.fillRect(-offsetX, -offsetY, canvas.width + offsetX, canvas.height + offsetY);
            ctx.translate(-offsetX, -offsetY);
        }

        let last = 0;
        function tick(now) {
            animId = requestAnimationFrame(tick);
            if (now - last < 42) return;
            last = now;
            renderGrain();
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) cancelAnimationFrame(animId);
            else animId = requestAnimationFrame(tick);
        });
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        animId = requestAnimationFrame(tick);
    }

    // ========================================
    // 14. THEME TOGGLE
    // ========================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        // Check local storage for preference
        const savedTheme = localStorage.getItem('superfocus-theme');
        if (savedTheme === 'light') {
            document.documentElement.classList.add('theme-light');
            themeToggleBtn.innerHTML = '🌙';
        }

        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('theme-light');
            themeToggleBtn.innerHTML = isLight ? '🌙' : '☀️';
            localStorage.setItem('superfocus-theme', isLight ? 'light' : 'dark');
        });
    }

    // ========================================
    // 15. RESPONSIVE TABLES (Mobile)
    // ========================================
    function makeTablesResponsive() {
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            // Get headers
            const headers = [];
            const headerCells = table.querySelectorAll('thead th, thead td');
            headerCells.forEach(header => {
                headers.push(header.textContent.trim());
            });

            // Add data-label to each cell
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                cells.forEach((cell, index) => {
                    if (headers[index]) {
                        cell.setAttribute('data-label', headers[index]);
                    }
                });
            });
        });
    }

    // Run on load
    makeTablesResponsive();

})();
