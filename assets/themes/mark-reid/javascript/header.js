window.addEventListener('load', function() {
    var menu = document.querySelector('#header ul.nav');
    var page = document.querySelector('#page');
    var menu_button = document.querySelector('#menu-button');
    menu_button.addEventListener('click', function() {
        menu.classList.toggle('show')
    })
    page.addEventListener('click', function() {
        menu.classList.remove('show')
    })
})
