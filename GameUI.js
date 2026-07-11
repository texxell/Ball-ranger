/**
 * 步骤二：暴力触控排查版 GameUI.js
 * 目标：强行把 UI 塞到最前面，戳破触控屏蔽。
 */
class GameUI {
    constructor(onJoystickMove, onWeaponTrigger) {
        console.log("GameUI: 触控层排查初始化...");
        this.onJoystickMove = onJoystickMove;
        this.onWeaponTrigger = onWeaponTrigger;
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.joystick = document.getElementById('joystick');
        this.dashBtn = document.getElementById('dash-btn');

        // 【暴力置顶机制】直接用 JS 给按钮加最高层级，防止被 3D 画面挡住
        if (this.joystick) {
            this.joystick.style.position = "absolute";
            this.joystick.style.zIndex = "9999";
            this.joystick.style.pointerEvents = "auto";
        }
        if (this.dashBtn) {
            this.dashBtn.style.position = "absolute";
            this.dashBtn.style.zIndex = "9999";
            this.dashBtn.style.pointerEvents = "auto";
        }
    }

    bindEvents() {
        // 1. 测试 Dash 暴力拦截
        if (this.dashBtn) {
            const triggerDash = (e) => {
                e.stopPropagation(); // 阻止事件传给 3D 画布
                console.log("👉 硬件层：Dash 按钮真的被点到了！");
                if (typeof this.onWeaponTrigger === 'function') {
                    this.onWeaponTrigger('dash');
                }
            };
            this.dashBtn.addEventListener('click', triggerDash);
            this.dashBtn.addEventListener('touchstart', triggerDash, { passive: true });
        }

        // 2. 测试摇杆键盘替代（为了排查你设备上手指拖不动的问题，特意加上键盘方向键测试！）
        window.addEventListener('keydown', (e) => {
            let fx = 0, fy = 0;
            if (e.key === 'ArrowUp' || e.key === 'w') fy = -1;
            if (e.key === 'ArrowDown' || e.key === 's') fy = 1;
            if (e.key === 'ArrowLeft' || e.key === 'a') fx = -1;
            if (e.key === 'ArrowRight' || e.key === 'd') fx = 1;

            if (fx !== 0 || fy !== 0) {
                console.log(`⌨️ 键盘映射输入: fx=${fx}, fy=${fy}`);
                if (typeof this.onJoystickMove === 'function') {
                    this.onJoystickMove(fx * 2, fy * 2);
                }
            }
        });

        // 3. 原生鼠标直接拖拽屏幕测试（如果按钮按不到，直接在屏幕上点住拖动也能让球动）
        let isDrawing = false;
        window.addEventListener('mousedown', () => { isDrawing = true; });
        window.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            // 根据鼠标在屏幕上的移动位置计算方向
            const fx = (e.clientX / window.innerWidth) - 0.5;
            const fy = (e.clientY / window.innerHeight) - 0.5;
            if (typeof this.onJoystickMove === 'function') {
                this.onJoystickMove(fx * 0.1, fy * 0.1);
            }
        });
        window.addEventListener('mouseup', () => { isDrawing = false; });
    }

    showCenterAlert(msg) {
        console.log(`[UI Alert]: ${msg}`);
        const alertOverlay = document.getElementById('center-alert');
        if (alertOverlay) {
            alertOverlay.innerText = msg;
            alertOverlay.style.opacity = "1";
            alertOverlay.style.zIndex = "9999";
            setTimeout(() => { alertOverlay.style.opacity = "0"; }, 1500);
        }
    }
}

window.GameUI = GameUI;
