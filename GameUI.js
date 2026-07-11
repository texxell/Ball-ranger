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

    bindEvents() bindEvents() {
        // 1. 硬件层强制绑定：不管你是点、摸、还是戳，只要碰到这个按钮就死死拦截并触发 Dash
        if (this.dashBtn) {
            const doDash = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("💥 iPad 核心层收到 Dash 触控！");
                if (typeof this.onWeaponTrigger === 'function') {
                    this.onWeaponTrigger('dash');
                }
            };
            // 穷尽所有 iPad 能识别的触控事件
            this.dashBtn.addEventListener('pointerdown', doDash);
            this.dashBtn.addEventListener('touchstart', doDash, { passive: false });
            this.dashBtn.addEventListener('click', doDash);
        }

        // 2. 【iPad 终极保底】：全屏右半边“快速双击”直接触发 Dash！
        let lastTapTime = 0;
        window.addEventListener('touchend', (e) => {
            const now = Date.now();
            const tapX = e.changedTouches[0].clientX;
            
            // 如果用户是在屏幕的右半边（按钮常用区域）快速双击
            if (tapX > window.innerWidth * 0.5) {
                if (now - lastTapTime < 250) { // 两次点击小于 250 毫秒算双击
                    console.log("⚡ 触发 iPad 屏幕右侧双击保底 Dash！");
                    if (typeof this.onWeaponTrigger === 'function') {
                        this.onWeaponTrigger('dash');
                    }
                }
                lastTapTime = now;
            }
        }, { passive: true });

        // 3. iPad 左半边屏幕原生拖动控制红球方向（继续保留）
        let touchStartX = 0;
        let touchStartY = 0;
        window.addEventListener('touchstart', (e) => {
            if (e.touches[0].clientX > window.innerWidth * 0.6) return; // 右侧留给 Dash
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (touchStartX === 0 || touchStartY === 0) return;
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 5) {
                // 加大操控灵敏度，让 iPad 搓起来更爽
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
