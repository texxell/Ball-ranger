/**
 * ==========================================================================
 * BallRanger.io - GameUI 战术全屏盲操与大厅系统
 * 职责：掌控全屏盲操矢量、金币购买武器、看广告16→32倍化变大、Game Over清算弹窗
 * ==========================================================================
 */
export class GameUI {
    constructor() {
        this.coins = 0;         // 局内真实金币储备
        this.playerNumber = 2;   // 2048 初始号码（默认2，广告可强化至16、32）
        this.adClicks = 0;       // 广告点击计数器
        
        // 👑 核心升级：终极全屏盲操控制状态机
        this.moveVector = { x: 0, y: 0 }; 
        this.joystick = {
            active: false,
            pointerId: null,
            startX: 0, // 手指在全屏“任意地方”按下去的那一刻，就是临时圆心
            startY: 0,
            maxRadius: 60,
            container: null,
            stick: null
        };

        this.cacheDOM();
        this.initFullScreenTouch(); // 唤醒全屏盲操
        this.bindMenuAndWeapons();
    }

    cacheDOM() {
        this.domCoins = document.getElementById('ui-coins');
        this.domNumber = document.getElementById('ui-number');
        this.domStartMenu = document.getElementById('start-menu');
        this.domBtnStart = document.getElementById('btn-start-game');
        this.domBtnAd = document.getElementById('btn-watch-ad');
        this.domAdStatusText = document.getElementById('ad-status-text');
        this.domAlertBox = document.getElementById('alert-msg-box');
        this.domAlertText = document.getElementById('alert-text');

        this.createDynamicJoystick();
    }

    /**
     * 🔮 动态盲操皮肤（平时彻底隐藏，在屏幕任意地方按下时瞬间浮现）
     */
    createDynamicJoystick() {
        this.joystick.container = document.createElement('div');
        this.joystick.container.style.cssText = `
            position: absolute; width: 120px; height: 120px;
            background: rgba(255, 255, 255, 0.04);
            border: 2px solid rgba(0, 255, 204, 0.25);
            border-radius: 50%; display: none; z-index: 99;
            pointer-events: none; transform: translate(-50%, -50%);
            box-shadow: 0 0 15px rgba(0,255,204,0.1);
        `;
        this.joystick.stick = document.createElement('div');
        this.joystick.stick.style.cssText = `
            position: absolute; top: 37px; left: 37px; width: 46px; height: 46px;
            background: linear-gradient(135deg, #00FFCC 0%, #00A88F 100%);
            border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        `;
        this.joystick.container.appendChild(this.joystick.stick);
        document.getElementById('ui-layer').appendChild(this.joystick.container);
    }

    /**
     * 🕹️ 核心神技：全屏幕随处盲操划动（不限左右，全屏通吃）
     */
    initFullScreenTouch() {
        window.addEventListener('pointerdown', (e) => {
            // 避雷拦截：如果点到的是菜单、被锁的武器图标，不能触发摇杆
            if (e.target.closest('#start-menu') || e.target.closest('.weapon-btn')) return;
            if (this.joystick.active) return; // 拒绝多指干扰

            this.joystick.active = true;
            this.joystick.pointerId = e.pointerId;
            
            // 屏幕上的“任何位置”都是合法圆心！
            this.joystick.startX = e.clientX;
            this.joystick.startY = e.clientY;

            // 视觉跟随：将盲操中心圈移至手指点击处
            this.joystick.container.style.left = `${e.clientX}px`;
            this.joystick.container.style.top = `${e.clientY}px`;
            this.joystick.container.style.display = 'block';
            this.joystick.stick.style.transform = 'translate(0px, 0px)';
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;

            let dirX = e.clientX - this.joystick.startX;
            let dirY = e.clientY - this.joystick.startY;
            let distance = Math.sqrt(dirX * dirX + dirY * dirY);

            // 限制手柄内芯最大滑动半径
            if (distance > this.joystick.maxRadius) {
                dirX = (dirX / distance) * this.joystick.maxRadius;
                dirY = (dirY / distance) * this.joystick.maxRadius;
            }

            this.joystick.stick.style.transform = `translate(${dirX}px, ${dirY}px)`;

            // 物理传导向量
            this.moveVector.x = dirX / this.joystick.maxRadius;
            this.moveVector.y = dirY / this.joystick.maxRadius;
        });

        const endTouch = (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
            this.joystick.active = false;
            this.joystick.container.style.display = 'none';
            this.moveVector.x = 0;
            this.moveVector.y = 0;
        };

        window.addEventListener('pointerup', endTouch);
        window.addEventListener('pointercancel', endTouch);
    }

    /**
     * 📺 广告双倍升级机制与武器购买控制
     */
    bindMenuAndWeapons() {
        // 1. 广告强化开局机制 (第一次16，第二次32，准备上市接入)
        this.domBtnAd.addEventListener('click', () => {
            this.adClicks++;
            if (this.adClicks === 1) {
                this.playerNumber = 16;
                this.domAdStatusText.innerText = "NEXT: N32";
                this.domAdStatusText.style.background = "#00FFCC";
                this.domAdStatusText.style.color = "#000";
                this.domNumber.innerText = this.playerNumber;
                this.showAlert("AD WATCHED! INITIAL NUMBER UPGRADED TO 16!");
            } else if (this.adClicks === 2) {
                this.playerNumber = 32;
                this.domAdStatusText.innerText = "MAX POWER";
                this.domBtnAd.disabled = true;
                this.domBtnAd.style.opacity = "0.5";
                this.domNumber.innerText = this.playerNumber;
                this.showAlert("AD WATCHED! INITIAL NUMBER CHARGED TO 32!");
            }
            // 联动更新3D世界中Player球的数值和尺寸
            if (window.myMainScene) {
                window.myMainScene.syncPlayerSizeByNumber();
            }
        });

        // 2. 点击【START GAME】
        this.domBtnStart.addEventListener('click', () => {
            this.domStartMenu.style.display = 'none'; // 玻璃面板隐形
            if (window.myMainScene) {
                window.myMainScene.spawnPlayer(); // 白金战球重九天落入碗底
            }
        });

        // 3. 武器价格硬核格杀 (50 / 100 / 200)
        const weaponIds = ['wpn-shield', 'wpn-lightning', 'wpn-vacuum'];
        weaponIds.forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('click', () => {
                if (el.classList.contains('unlocked')) {
                    this.showAlert(`WEAPON ALREADY ACTIVE!`);
                    return;
                }
                const price = parseInt(el.getAttribute('data-price'));
                
                // 金币检验安全审查
                if (this.coins >= price) {
                    this.coins -= price;
                    this.domCoins.innerText = this.coins;
                    el.classList.remove('locked');
                    el.classList.add('unlocked');
                    this.showAlert(`SUCCESSFULLY UNLOCKED ${id.replace('wpn-','').toUpperCase()}!`);
                } else {
                    this.showAlert(`GOLD INSUFFICIENT! NEED $${price} TO UNLOCK THIS WEAPON.`);
                }
            });
        });
    }

    /**
     * 💰 吃金币结算入口 (一个金币5块钱)
     */
    addCoin() {
        this.coins += 5;
        this.domCoins.innerText = this.coins;
    }

    /**
     * 🔢 2048 号码升级核心入口
     */
    upgradeNumber() {
        this.playerNumber *= 2;
        this.domNumber.innerText = this.playerNumber;
    }

    showAlert(text) {
        this.domAlertText.innerText = text;
        this.domAlertBox.classList.remove('hidden');
        if (this.alertTimer) clearTimeout(this.alertTimer);
        this.alertTimer = setTimeout(() => this.domAlertBox.classList.add('hidden'), 2500);
    }

    getInputVector() { return this.moveVector; }
}

// 挂载全局全局UI管理器
window.myGameUI = new GameUI();
