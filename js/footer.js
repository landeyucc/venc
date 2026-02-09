document.addEventListener('DOMContentLoaded', function() {
    const currentYear = new Date().getFullYear();
    const footerText = `© ${currentYear} <a href="https://github.com/landeyucc" target="_blank">@landeyucc</a>&nbsp;All rights reserved. <span style="display: inline-block; width: 0; height: 0; overflow: hidden;">&nbsp;</span><br class="footer-br" style="display: none;" /><span style="display: none;">&nbsp;</span>Powered by <a href="https://coldsea.vip/" target="_blank" style="text-decoration: none;"><span style="font-family: 'Frizon', sans-serif;">Coldsea</span></a>&nbsp;Team.`;
    const footerElements = document.querySelectorAll('.footer p');
    
    footerElements.forEach(function(footer) {
        footer.innerHTML = footerText;
    });

    function handleBrDisplay() {
        const brElements = document.querySelectorAll('.footer-br');
        if (window.innerWidth < 768) {
            brElements.forEach(br => {
                br.style.display = 'inline';
            });
        } else {
            brElements.forEach(br => {
                br.style.display = 'none';
            });
        }
    }

    handleBrDisplay();
    window.addEventListener('resize', handleBrDisplay);
});