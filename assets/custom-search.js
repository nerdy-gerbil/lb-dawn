var isMobile = navigator.userAgent.match(
    /(iPhone|iPod|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini)/i
);
if (!isMobile) {
    document.querySelector(".header__search details").open = true;
    document.addEventListener("keydown", function () {
        switch (event.code) {
            case "Escape":
                event.preventDefault();
                event.keyCode = 0;
                break;
            default:
                break;
        }
    });
    document.addEventListener("keyup", function () {
        switch (event.code) {
            case "Escape":
                document.querySelector(".header__search details").open = true;
                break;
            default:
                break;
        }
    });
}
