/**
 * ==========================================================================
 * BallRanger.io - GameUI 战术全屏盲操版 (华文注释/英文UI)
 * 职责：左半屏任意划动控制、右半屏点击武器、电脑键盘WASD兼容，三端完美自适应
 * ==========================================================================
 */
export class GameUI {
    constructor() {
        this.coins = 0;
        this.mass = 2;
        this.moveVector = { x: 0, y: 0 }; 

        // 👑 升级：动态盲操摇杆状态机
        this.joystick = {
            active: false,
            pointerId: null,
            startX: 0,  // 手指按下去的那一刻，就是临时圆心
            startY: 0,
            maxRadius: 60, // 滑动判定半径
            container: null,
            stick: null
        };

        this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        this.cacheDOM();
        this.bindClickEvents();
        this.initFullScreenTouch(); // 激活全屏随处触控
        this.bindKeyboardEvents();
        
        console.log("💂‍♂️ [GameUI] 全屏盲操系统部署完毕！左半屏任意划动，右半屏精确射击。");
    }

    cacheDOM() {
        this.domCoins = document.getElementById('ui-coins');
        this.domMass = document.getElementById('ui-mass');
        this.domBtnBoost = document.getElementById('btn-boost');
        this.domBtnDash = document.getElementById('btn-dash');
        this.domAlertBox = document.getElementById('alert-msg-box');
        this.domAlertText = document.getElementById('alert-text');
        
        // 动态创建盲操视觉皮肤（默认彻底隐藏，手指按下去才显形）
        this.createDynamicJoystick();
    }

    createDynamicJoystick() {
        this.joystick.container = document.createElement('div');
        this.joystick.container.style.cssText = `
            position: absolute; width: 120px; height: 120px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.15);
            border-radius: 50%; display: none; z-index: 100;
            pointer-events: none; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
            transform: translate(-50%, -50%); /* 确保圆心对齐手指点 */
        `;
        
        this.joystick.stick = document.createElement('div');
        this.joystick.stick.style.cssText = `
            position: absolute; top: 35px; left: 35px;
            width: 46px; height: 46px;
            background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.5) 100%);
            border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        `;
        
        this.joystick.container.appendChild(this.joystick.stick);
        document.getElementById('ui-layer').appendChild(this.joystick.container);
    }

    bindClickEvents() {
        this.domBtnBoost.addEventListener('click', () => {
            if (this.mass < 20) {
                this.mass++;
                this.domMass.innerText = this.mass;
            } else {
                this.showAlert("MASS REACHED MAXIMUM LIMIT (20)!");
            }
        });

        this.domBtnDash.addEventListener('click', () => {
            console.log("⚡ [Dash] 触发冲刺！");
        });

        const weapons = ['btn-weapon-shield', 'btn-weapon-lightning', 'btn-weapon-vacuum'];
        weapons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.showAlert("WEAPON NOT PURCHASED! PLEASE BUY IT IN THE ARMORY.");
                });
            }
        });
    }

    showAlert(text) {
        this.domAlertText.innerText = text;
        this.domAlertBox.classList.remove('hidden');
        if (this.alertTimer) clearTimeout(this.alertTimer);
        this.alertTimer = setTimeout(() => {
            this.domAlertBox.classList.add('hidden');
        }, 2000);
    }

    // ==========================================================================
    // 🕹️ 核心神技：全屏划动操控 (左半屏开摇杆，右半屏点技能)
    // ==========================================================================
    initFullScreenTouch() {
        const uiLayer = document.getElementById('ui-layer');

        // 全局监听整个屏幕的按下事件
        window.addEventListener('pointerdown', (e) => {
            // 避雷：如果点到的是右侧按钮或顶部UI，别让摇杆插手
            if (e.target.closest('.action-controls-zone') || e.target.closest('.top-bar')) return;

            const halfWidth = window.innerWidth / 2;

            // ⚡ 战术切割：只有当手指按在屏幕“左半边”时，才激活随处划动控制
            if (e.clientX < halfWidth) {
                if (this.joystick.active) return; // 已经有左手手指了，拒绝第二根

                this.joystick.active = true;
                this.joystick.pointerId = e.pointerId;
                
                // 将临时圆心锁定在玩家手指刚刚按下去的坐标
                this.joystick.startX = e.clientX;
                this.joystick.startY = e.clientY;

                // 视觉显形：把半透明圆圈摇杆瞬间瞬移到手指点的位置
                this.joystick.container.style.left = `${e.clientX}px`;
                this.joystick.container.style.top = `${e.clientY}px`;
                this.joystick.container.style.display = 'block';
                this.joystick.stick.style.transform = 'translate(0px, 0px)';
            }
        });

        // 手指在屏幕上滑行
        window.addEventListener('pointermove', (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;

            // 计算手指距离最开始按下去的那个点的位移
            let dirX = e.clientX - this.joystick.startX;
            let dirY = e.clientY - this.joystick.startY;
            let distance = Math.sqrt(dirX * dirX + dirY * dirY);

            // 限制中心内芯最大位移
            if (distance > this.joystick.maxRadius) {
                dirX = (dirX / distance) * this.joystick.maxRadius;
                dirY = (dirY / distance) * this.joystick.maxRadius;
            }

            // 更新内芯视觉
            this.joystick.stick.style.transform = `translate(${dirX}px, ${dirY}px)`;

            // 🔥 核心物理向量输出：传给球
            this.moveVector.x = dirX / this.joystick.maxRadius;
            this.moveVector.y = dirY / this.joystick.maxRadius;
        });

        // 手指抬起，解除锁定
        const endTouch = (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;

            this.joystick.active = false;
            this.joystick.pointerId = null;
            
            // 隐形：摇杆在不摸的时候彻底消失，不挡视野
            this.joystick.container.style.display = 'none';
            
            // 物理输出归零
            this.moveVector.x = 0;
            this.moveVector.y = 0;
        };

        window.addEventListener('pointerup', endTouch);
        window.addEventListener('pointercancel', endTouch);
    }

    // ==========================================================================
    // ⌨️ 电脑端自适应
    // ==========================================================================
    bindKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key in this.keys) {
                this.keys[e.key] = true;
                this.updateKeyboardVector();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key in this.keys) {
                this.keys[e.key] = false;
                this.updateKeyboardVector();
            }
        });
    }

    updateKeyboardVector() {
        if (this.joystick.active) return;
        let x = 0, y = 0;
        if (this.keys.w || this.keys.ArrowUp) y -= 1;
        if (this.keys.s || this.keys.ArrowDown) y += 1;
        if (this.keys.a || this.keys.ArrowLeft) x -= 1;
        if (this.keys.d || this.keys.ArrowRight) x += 1;
        this.moveVector.x = x;
        this.moveVector.y = y;
    }

    getInputVector() { return this.moveVector; }
}

window.myGameUI = new GameUI();
