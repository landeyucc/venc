document.addEventListener('DOMContentLoaded', function() {
    const currentYear = new Date().getFullYear();
    const footerText = `© ${currentYear} Github@<a href="https://github.com/landeyucc" target="_blank" title="GitHub">landeyucc</a>. Powered by <a href="https://coldsea.vip/" target="_blank" title="Coldsea">Coldsea Team</a> `;
    const footerElements = document.querySelectorAll('.footer p');
    
    footerElements.forEach(function(footer) {
        footer.innerHTML = footerText;
    });
});