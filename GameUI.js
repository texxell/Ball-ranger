class GameUI {
    constructor(onJoystickMove, onWeaponTrigger) {
        this.onJoystickMove = onJoystickMove;
        this.onWeaponTrigger = onWeaponTrigger;
        
        document.addEventListener('touchmove', (e) => {
            if(e.touches.length > 1) e.preventDefault();
        }, { passive: false });

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.joystick = document.getElementById('joystick');
        this.dashBtn = document.getElementById('dash-btn');
        this.w1Btn = document.getElementById('weapon1-btn');
        this.w2Btn = document.getElementById('weapon2-btn');
        this.w3Btn = document.getElementById('weapon3-btn');

        const forceStyle = (el) => {
            if (!el) return;
            el.style.position = "fixed"; 
            el.style.zIndex = "99999";    
            el.style.webkitUserSelect = "none"; 
            el.style.userSelect = "none";
        };

        forceStyle(this.joystick);
        forceStyle(this.dashBtn);
        forceStyle(this.w1Btn);
        forceStyle(this.w2Btn);
        forceStyle(this.w3Btn);
    }

    bindButton(element, actionName) {
        if (!element) return;
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof this.onWeaponTrigger === 'function') {
                this.onWeaponTrigger(actionName);
            }
        };
        element.addEventListener('pointerdown', handler);
        element.addEventListener('touchstart', handler, { passive: false });
    }

    bindEvents() {
        // Bind all 4 discrete touch inputs
        this.bindButton(this.dashBtn, 'dash');
        this.bindButton(this.w1Btn, 'weapon1');
        this.bindButton(this.w2Btn, 'weapon2');
        this.bindButton(this.w3Btn, 'weapon3');

        // Fullscreen left side joystick controller touch capture
        let touchStartX = 0;
        let touchStartY = 0;

        window.addEventListener('touchstart', (e) => {
            if (e.touches[0].clientX > window.innerWidth * 0.5) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (touchStartX === 0 || touchStartY === 0) return;
            
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            if (len > 5) {
                const fx = (dx / len) * 3.5;
                const fy = (dy / len) * 3.5;
                if (typeof this.onJoystickMove === 'function') {
                    this.onJoystickMove(fx, fy);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            touchStartX = 0;
            touchStartY = 0;
        });
    }

    showCenterAlert(msg) {
        const alertOverlay = document.getElementById('center-alert');
        if (alertOverlay) {
            alertOverlay.innerText = msg;
            alertOverlay.style.opacity = "1";
            setTimeout(() => { alertOverlay.style.opacity = "0"; }, 1500);
        }
    }
}

window.GameUI = GameUI;
