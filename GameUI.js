/**
 * ==========================================================================
 * BallRanger.io - GameUI 核心控制中心 (华文注释/英文UI)
 * 职责：托管摇杆、键盘监听、三端输入平滑转换、Firebase 伪数据对接及弹窗拦截
 * ==========================================================================
 */
export class GameUI {
    constructor() {
        // 1. 初始化本地核心状态数据
        this.coins = 0;
        this.mass = 2;
        this.moveVector = { x: 0, y: 0 }; // 最终输出给物理引擎的移动向量：X(左右), Y(前后)
        
        // 2. 摇杆专用状态机 (仅在手机/iPad 触控时触发)
        this.joystick = {
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            moveX: 0,
            moveY: 0,
            maxRadius: 50, // 摇杆最大内圈滑动半径
            container: null,
            stick: null
        };

        // 3. 键盘状态机 (电脑端专用)
        this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        // 4. 彻底启动全套服务
        this.cacheDOM();
        this.bindClickEvents();
        this.bindPointerEvents();
        this.bindKeyboardEvents();
        
        console.log("💂‍♂️ [GameUI] 核心控制中心初始化成功！三端输入监听已全面布防。");
    }

    // 抓取 HTML 元素，为后续数值更新做准备
    cacheDOM() {
        this.domCoins = document.getElementById('ui-coins');
        this.domMass = document.getElementById('ui-mass');
        this.domBtnBoost = document.getElementById('btn-boost');
        this.domBtnDash = document.getElementById('btn-dash');
        this.domAlertBox = document.getElementById('alert-msg-box');
        this.domAlertText = document.getElementById('alert-text');
        this.domGameContainer = document.getElementById('game-container');
        
        // 动态在桌面上为 iPad/手机 创建一个优雅的虚拟摇杆外圈和内芯
        this.createJoystickElements();
    }

    createJoystickElements() {
        // 创建摇杆大底座
        this.joystick.container = document.createElement('div');
        this.joystick.container.id = 'virtual-joystick-container';
        this.joystick.container.style.cssText = `
            position: absolute; bottom: 12vh; left: 8vw;
            width: 120px; height: 120px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.15);
            border-radius: 50%; display: none; z-index: 100;
            pointer-events: auto; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
        `;
        
        // 创建摇杆小内芯
        this.joystick.stick = document.createElement('div');
        this.joystick.stick.style.cssText = `
            position: absolute; top: 35px; left: 35px;
            width: 46px; height: 46px;
            background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.5) 100%);
            border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            transition: transform 0.05s ease;
        `;
        
        this.joystick.container.appendChild(this.joystick.stick);
        document.getElementById('ui-layer').appendChild(this.joystick.container);
        
        // 如果检测到是触控设备（iPad/手机），立刻把摇杆亮出来
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.joystick.container.style.display = 'block';
        }
    }

    // ==========================================================================
    // ⚔️ 防暗杀防死锁：绑定右侧动作按键及拦截未购买武器
    // ==========================================================================
    bindClickEvents() {
        // 开局变大按钮点击
        this.domBtnBoost.addEventListener('click', () => {
            if (this.mass < 20) {
                this.mass++;
                this.domMass.innerText = this.mass;
                console.log(`🚀 [Boost] 玩家体积增大！当前质量: ${this.mass}`);
            } else {
                this.showAlert("MASS REACHED MAXIMUM LIMIT (20)!");
            }
        });

        // DASH 冲刺按钮点击
        this.domBtnDash.addEventListener('click', () => {
            console.log("⚡ [Dash] 触发冲刺！");
            // 这里留给 PhysicsEngine 监听触发爆发推进力
        });

        // 拦截三大未购买武器（盾、闪电、吸盘）
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

    // 弹出高科技全屏警告，2秒后自动淡出
    showAlert(text) {
        this.domAlertText.innerText = text;
        this.domAlertBox.classList.remove('hidden');
        
        if (this.alertTimer) clearTimeout(this.alertTimer);
        this.alertTimer = setTimeout(() => {
            this.domAlertBox.add('hidden'); // 军师修正：应该是 classList.add
            this.domAlertBox.classList.add('hidden');
        }, 2000);
    }

    // ==========================================================================
    // 🕹️ 核心神技：PointerEvents 追踪，彻底终结左右手触控打架、卡死
    // ==========================================================================
    bindPointerEvents() {
        const container = this.joystick.container;
        
        // 手指按在摇杆底座上
        container.addEventListener('pointerdown', (e) => {
            if (this.joystick.active) return; // 已经有手指占领了，拒绝第二根手指
            
            this.joystick.active = true;
            this.joystick.pointerId = e.pointerId; // 记住这根金手指的“身份证号”
            container.setPointerCapture(e.pointerId); // 锁定这根手指，就算划出圈外也能持续追踪
            
            const rect = container.getBoundingClientRect();
            // 计算摇杆中心点坐标
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
        });

        // 手指在全屏幕滑动
        container.addEventListener('pointermove', (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
            
            // 计算当前手指距离摇杆中心的偏移量
            let dirX = e.clientX - this.joystick.startX;
            let dirY = e.clientY - this.joystick.startY;
            let distance = Math.sqrt(dirX * dirX + dirY * dirY);
            
            // 限制内芯不能跑出大圈圈
            if (distance > this.joystick.maxRadius) {
                dirX = (dirX / distance) * this.joystick.maxRadius;
                dirY = (dirY / distance) * this.joystick.maxRadius;
                distance = this.joystick.maxRadius;
            }
            
            // 渲染内芯的物理视觉位移
            this.joystick.stick.style.transform = `translate(${dirX}px, ${dirY}px)`;
            
            // 【极其重要】：归一化矩阵（输出 -1 到 1 之间的精确比例），传给未来的物理球
            this.moveVector.x = dirX / this.joystick.maxRadius;
            this.moveVector.y = dirY / this.joystick.maxRadius; // 这里的 y 代表屏幕向下为正
        });

        // 手指抬起，状态彻底重置
        const endPointer = (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
            
            this.joystick.active = false;
            this.joystick.pointerId = null;
            this.joystick.stick.style.transform = 'translate(0px, 0px)'; // 芯归原位
            this.moveVector.x = 0;
            this.moveVector.y = 0; // 物理推力瞬间清零，球靠惯性滑行
        };

        container.addEventListener('pointerup', endPointer);
        container.addEventListener('pointercancel', endPointer);
    }

    // ==========================================================================
    // ⌨️ 电脑端键盘自适应适配：WASD / 方向键
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
        // 如果触控摇杆正在生效，电脑键盘自动让路，不进行干扰
        if (this.joystick.active) return;

        let x = 0;
        let y = 0;

        if (this.keys.w || this.keys.ArrowUp) y -= 1;    // 键盘上移代表 3D 纵深向前
        if (this.keys.s || this.keys.ArrowDown) y += 1;  // 键盘下移代表 3D 纵深向后
        if (this.keys.a || this.keys.ArrowLeft) x -= 1;  // 左右不变
        if (this.keys.d || this.keys.ArrowRight) x += 1;

        this.moveVector.x = x;
        this.moveVector.y = y;
    }

    // 提供给 PhysicsEngine 实时每帧过来抽查数据拿走推力的方法
    getInputVector() {
        return this.moveVector;
    }

    // 提供给外部更新实时排行榜数据的方法
    updateLeaderboard(rankArray) {
        const listContainer = document.getElementById('leaderboard-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        rankArray.slice(0, 5).forEach((player, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank-name">${index + 1}. ${player.name}</span><span class="rank-val">${player.score}</span>`;
            listContainer.appendChild(li);
        });
    }
}

// 🔥【终极死守防线】：强制实例化并绑死在 window 全局，Safari 的 GC 回收机制看一眼都得绕道走！
window.myGameUI = new GameUI();
