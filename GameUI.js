/**
 * BallRanger.io - GameUI.js
 * 职责：虚拟摇杆的向量转化、Dash 技能防抖触发及极光玻璃态 UI 交互反馈
 */
class GameUI {
    constructor(onJoystickMove, onWeaponTrigger) {
        console.log("GameUI: Building immersive dashboard interfaces...");
        this.onJoystickMove = onJoystickMove;
        this.onWeaponTrigger = onWeaponTrigger;
        
        this.dashActive = false;
        this.dashCooldown = 1500; // Dash 技能 1.5秒 CD
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.joystick = document.getElementById('joystick');
        this.joystickStick = document.getElementById('joystick-stick');
        this.dashBtn = document.getElementById('dash-btn');
        this.alertOverlay = document.getElementById('center-alert');
    }

    bindEvents() {
        // ---- DASH 技能按键触发与视觉反馈 ----
        if (this.dashBtn) {
            const executeDash = (e) => {
                e.preventDefault();
                if (this.dashActive) return; // 冷却中拦截

                this.dashActive = true;
                this.dashBtn.classList.add('cooldown-active');
                this.dashBtn.style.transform = "scale(0.85)";
                this.dashBtn.style.opacity = "0.4";

                console.log("GameUI -> Dash vector intent broadcasted.");
                if (typeof this.onWeaponTrigger === 'function') {
                    this.onWeaponTrigger('dash');
                }

                // 恢复缩放
                setTimeout(() => {
                    this.dashBtn.style.transform = "scale(1)";
                }, 100);

                // 冷却时间截止恢复可用
                setTimeout(() => {
                    this.dashActive = false;
                    this.dashBtn.classList.remove('cooldown-active');
                    this.dashBtn.style.opacity = "1";
                }, this.dashCooldown);
            };

            this.dashBtn.addEventListener('touchstart', executeDash, { passive: false });
            this.dashBtn.addEventListener('click', executeDash);
        }

        // ---- 虚拟摇杆多点触控向量驱动 ----
        if (this.joystick) {
            let touchId = null;
            const rect = this.joystick.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const maxRadius = rect.width / 2;

            const onStart = (e) => {
                const touch = e.changedTouches ? e.changedTouches[0] : e;
                touchId = touch.identifier ?? 'mouse';
            };

            const onMove = (e) => {
                if (touchId === null) return;
                
                let activeTouch = null;
                if (e.touches) {
                    for (let i = 0; i < e.touches.length; i++) {
                        if (e.touches[i].identifier === touchId) {
                            activeTouch = e.touches[i];
                            break;
                        }
                    }
                } else {
                    activeTouch = e;
                }

                if (!activeTouch) return;
                e.preventDefault();

                // 严密计算偏移向量
                let deltaX = activeTouch.clientX - centerX;
                let deltaY = activeTouch.clientY - centerY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (distance > maxRadius) {
                    deltaX = (deltaX / distance) * maxRadius;
                    deltaY = (deltaY / distance) * maxRadius;
                }

                // 移动摇杆帽视觉反馈
                if (this.joystickStick) {
                    this.joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                }

                // 将归一化向量 [-1, 1] 回传给业务层
                const forceX = deltaX / maxRadius;
                const forceY = deltaY / maxRadius;
                if (typeof this.onJoystickMove === 'function') {
                    this.onJoystickMove(forceX, forceY);
                }
            };

            const onEnd = () => {
                touchId = null;
                if (this.joystickStick) {
                    this.joystickStick.style.transform = 'translate(0px, 0px)';
                }
                if (typeof this.onJoystickMove === 'function') {
                    this.onJoystickMove(0, 0);
                }
            };

            this.joystick.addEventListener('touchstart', onStart, { passive: false });
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onEnd);
            
            // 兼容桌面端鼠标测试
            this.joystick.addEventListener('mousedown', onStart);
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onEnd);
        }
    }

    /**
     * 屏幕中央滚动广播通知
     * @param {string} msg 
     */
    showCenterAlert(msg) {
        if (this.alertOverlay) {
            this.alertOverlay.innerText = msg;
            this.alertOverlay.style.opacity = "1";
            setTimeout(() => {
                this.alertOverlay.style.opacity = "0";
            }, 2000);
        } else {
            console.log(`[UI Alert Window]: ${msg}`);
        }
    }
}

// 挂载全局，彻底抹平模块沙箱阻断
window.GameUI = GameUI;
