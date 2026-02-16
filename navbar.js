/* --- START OF FILE navbar.js --- */
document.addEventListener("DOMContentLoaded", function() {
    
    // 1. Define the HTML as a string (Works locally without a server)
    const navbarHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-24 items-center">
            <!-- Logo -->
            <div class="flex items-center">
                <a href="index.html" class="text-3xl font-extrabold text-brand-primary tracking-tight hover:opacity-80 transition group">
                    Dibs<span class="text-brand-accent group-hover:text-brand-accentDark transition-colors">ABA</span>
                </a>
            </div>
            
            <!-- Desktop Menu -->
            <div class="hidden md:flex items-center space-x-8">
                <a href="consulting.html" class="nav-link text-stone-600 hover:text-brand-accent font-medium text-sm transition tracking-wide">Agencies</a>
                <a href="denials.html" class="nav-link text-stone-600 hover:text-brand-accent font-medium text-sm transition tracking-wide">Denials</a>
                <a href="family.html" class="nav-link text-stone-600 hover:text-brand-accent font-medium text-sm transition tracking-wide">Families</a>
                <a href="software.html" class="nav-link text-stone-600 hover:text-brand-accent font-medium text-sm transition tracking-wide">Software</a>
                
                <a href="index.html#contact" class="ml-4 bg-brand-accent text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-accentDark transition shadow-lg shadow-brand-accent/30 transform hover:-translate-y-0.5">Contact Us</a>
            </div>

            <!-- Mobile Menu Button -->
            <div class="md:hidden flex items-center">
                <button id="mobile-menu-btn" class="text-stone-600 hover:text-brand-accent p-4 focus:outline-none transition-colors duration-200" aria-label="Open Menu">
                    <i class="fa-solid fa-bars text-2xl"></i>
                </button>
            </div>
        </div>

        <!-- Mobile Menu -->
        <div id="mobile-menu" class="hidden md:hidden absolute top-24 left-0 w-full bg-brand-sand border-b border-stone-300 shadow-xl py-6 px-6 flex flex-col space-y-4 z-50">
            <a href="index.html" class="mobile-link text-stone-700 hover:text-brand-accent font-bold block py-2 border-b border-stone-200/60 transition-colors">Home</a>
            <a href="software.html" class="mobile-link text-stone-700 hover:text-brand-accent font-bold block py-2 border-b border-stone-200/60 transition-colors">Software</a> <!-- NEW LINK -->
            <a href="consulting.html" class="mobile-link text-stone-700 hover:text-brand-accent font-bold block py-2 border-b border-stone-200/60 transition-colors">Agencies</a>
            <a href="denials.html" class="mobile-link text-stone-700 hover:text-brand-accent font-bold block py-2 border-b border-stone-200/60 transition-colors">Denials</a>
            <a href="family.html" class="mobile-link text-stone-700 hover:text-brand-accent font-bold block py-2 border-b border-stone-200/60 transition-colors">Families</a>
            <a href="index.html#contact" class="text-brand-accent font-bold block py-2 mt-2">Contact Us <i class="fa-solid fa-arrow-right ml-2 text-sm"></i></a>
        </div>
    </div>
    `;

    // 2. Inject the HTML
    const placeholder = document.getElementById('navbar-placeholder');
    if(placeholder) placeholder.innerHTML = navbarHTML;

    // 3. Initialize Mobile Menu Logic
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if(menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // 4. Highlight the Active Link
    const currentPath = window.location.pathname;
    const filename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || "index.html";

    const setActive = (selector) => {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
            if(link.getAttribute('href') === filename) {
                link.classList.remove('text-stone-600', 'text-stone-700');
                link.classList.add('text-brand-accent', 'font-bold'); 
            }
        });
    };

    setActive('.nav-link');    
    setActive('.mobile-link'); 
});