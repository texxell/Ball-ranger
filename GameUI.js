/**
 * 步骤三：iPad 电容屏专用暴力触控版 GameUI.js
 * 目标：强行阻断 iPad 网页滚动拦截，百分之百捕获手指触控
 */
class GameUI {
    constructor(onJoystickMove, onWeaponTrigger) {
        console.log("GameUI: iPad Touch Engine active.");
        this.onJoystickMove = onJoystickMove;
        this.onWeaponTrigger = onWeaponTrigger;
        
        // 强行阻止整个 iPad 网页的默认双击放大和滑动橡皮鞭效应
        document.addEventListener('touchmove', (e) => {
            if(e.touches.length > 1) e.preventDefault();
        }, { passive: false });

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.joystick = document.getElementById('joystick');
        this.dashBtn = document.getElementById('dash-btn');

        // 【iPad 强行置顶与穿透】
        const forceStyle = (el) => {
            if (!el) return;
            el.style.position = "fixed"; 
            el.style.zIndex = "99999";    // 提到外太空层级
            el.style.webkitUserSelect = "none"; // 禁止 iPad 长按弹出复制
            el.style.userSelect = "none";
        };

        forceStyle(this.joystick);
        forceStyle(this.dashBtn);
    }

    bindEvents() {
        // 1. iPad 专属 Pointer 事件响应 Dash（比 touch 更灵敏，无延迟）
        if (this.dashBtn) {
            const doDash = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("iPad 硬件捕获：Dash 按下了！");
                if (typeof this.onWeaponTrigger === 'function') {
                    this.onWeaponTrigger('dash');
                }
            };
            this.dashBtn.addEventListener('pointerdown', doDash);
            this.dashBtn.addEventListener('touchstart', doDash, { passive: false });
        }

        // 2. iPad 全屏任意位置“双击”或“双指按住拖动”作为备用移动方案
        let touchStartX = 0;
        let touchStartY = 0;

        window.addEventListener('touchstart', (e) => {
            // 如果点在右下角 Dash 附近不触发移动
            if (e.touches[0].clientX > window.innerWidth * 0.7 && e.touches[0].clientY > window.innerHeight * 0.7) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (touchStartX === 0 || touchStartY === 0) return;
            
            // 计算手指在 iPad 屏幕上滑动的相对距离
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            
            // 归一化方向
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 5) {
                const fx = (dx / len) * 2;
                const fy = (dy / len) * 2;
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
            alertOverlay.style.position = "fixed";
            alertOverlay.style.zIndex = "99999";
            alertOverlay.style.top = "20%";
            alertOverlay.style.left = "50%";
            alertOverlay.style.transform = "translate(-50%, -50%)";
            alertOverlay.style.color = "#ff3344";
            alertOverlay.style.fontSize = "24px";
            alertOverlay.style.background = "rgba(0,0,0,0.8)";
            alertOverlay.style.padding = "10px 20px";
            alertOverlay.style.borderRadius = "10px";
            setTimeout(() => { alertOverlay.style.opacity = "0"; }, 1500);
        }
    }
}

window.GameUI = GameUI;
