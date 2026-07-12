/**
 * ==========================================================================
 * GameUI.js - 全屏盲操、武器管理与实时排行榜渲染核心
 * 备注：管理金币流水、看广告倍化、全屏幕盲操、同步刷新动态排位战力榜
 * ==========================================================================
 */
export class GameUI {
    constructor() {
        this.coins = 0;          
        this.playerNumber = 2;    
        this.adClicks = 0;        
        
        this.moveVector = { x: 0, y: 0 }; 
        this.joystick = {
            active: false,
            pointerId: null,
            startX: 0,            
            startY: 0,
            maxRadius: 60,
            container: null,
            stick: null
        };

        this.cacheDOM();
        this.initFullScreenTouch(); 
        this.bindEvents();
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
        this.domLeaderboard = document.getElementById('ui-leaderboard');

        // 动态生成屏幕随处可显的触控视觉手柄
        this.joystick.container = document.createElement('div');
        this.joystick.container.style.cssText = `
            position: absolute; width: 120px; height: 120px;
            background: rgba(255, 255, 255, 0.03); border: 2px solid rgba(0, 255, 204, 0.3);
            border-radius: 50%; display: none; z-index: 99; pointer-events: none; transform: translate(-50%, -50%);
        `;
        this.joystick.stick = document.createElement('div');
        this.joystick.stick.style.cssText = `
            position: absolute; top: 37px; left: 37px; width: 46px; height: 46px;
            background: linear-gradient(135deg, #00FFCC 0%, #00A88F 100%); border-radius: 50%;
        `;
        this.joystick.container.appendChild(this.joystick.stick);
        document.getElementById('ui-layer').appendChild(this.joystick.container);
    }

    initFullScreenTouch() {
        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest('#start-menu') || e.target.closest('.weapon-btn')) return;
            if (this.joystick.active) return;

            this.joystick.active = true;
            this.joystick.pointerId = e.pointerId;
            this.joystick.startX = e.clientX;
            this.joystick.startY = e.clientY;

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

            if (distance > this.joystick.maxRadius) {
                dirX = (dirX / distance) * this.joystick.maxRadius;
                dirY = (dirY / distance) * this.joystick.maxRadius;
            }

            this.joystick.stick.style.transform = `translate(${dirX}px, ${dirY}px)`;
            this.moveVector.x = dirX / this.joystick.maxRadius;
            this.moveVector.y = dirY / this.joystick.maxRadius;
        });

        const resetJoystick = (e) => {
            if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
            this.joystick.active = false;
            this.joystick.container.style.display = 'none';
            this.moveVector.x = 0;
            this.moveVector.y = 0;
        };

        window.addEventListener('pointerup', resetJoystick);
        window.addEventListener('pointercancel', resetJoystick);
    }

    bindEvents() {
        this.domBtnAd.addEventListener('click', () => {
            this.adClicks++;
            if (this.adClicks === 1) {
                this.playerNumber = 16;
                this.domAdStatusText.innerText = "NEXT: N32";
                this.domNumber.innerText = this.playerNumber;
                this.showAlert("AD VALUE LOCKED! STARTING SIZE: 16");
            } else if (this.adClicks === 2) {
                this.playerNumber = 32;
                this.domAdStatusText.innerText = "MAX SIZE";
                this.domBtnAd.disabled = true;
                this.domBtnAd.style.opacity = "0.5";
                this.domNumber.innerText = this.playerNumber;
                this.showAlert("AD VALUE LOCKED! STARTING SIZE: 32");
            }
            if (window.myMainScene) window.myMainScene.syncPlayerRadius();
        });

        this.domBtnStart.addEventListener('click', () => {
            this.domStartMenu.style.display = 'none';
            if (window.myMainScene) window.myMainScene.activateArena();
        });

        const weapons = ['wpn-shield', 'wpn-lightning', 'wpn-vacuum'];
        weapons.forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('click', () => {
                if (el.classList.contains('unlocked')) return;
                const cost = parseInt(el.getAttribute('data-price'));
                
                if (this.coins >= cost) {
                    this.coins -= cost;
                    this.domCoins.innerText = this.coins;
                    el.classList.remove('locked');
                    el.classList.add('unlocked');
                    this.showAlert(`UNLOCKED! WEAPON IS ACTIVE!`);
                } else {
                    this.showAlert(`LOCK ACTIVATED! NEED $${cost} COINS TO UNLOCK.`);
                }
            });
        });
    }

    /**
     * 🏆 接收全引擎实体数据，动态冲榜排序并实时刷新 DOM
     */
    updateLeaderboard(entities) {
        // 按 2048 数值从大到小强力排序
        entities.sort((a, b) => b.number - a.number);

        let html = '';
        entities.forEach((ent, index) => {
            const isMe = ent.isPlayer ? 'player' : '';
            html += `
                <div class="leaderboard-item ${isMe}">
                    <span>#${index + 1} ${ent.name}</span>
                    <span>N${ent.number}</span>
                </div>
            `;
        });
        this.domLeaderboard.innerHTML = html;
    }

    addCoin() {
        this.coins += 5; 
        this.domCoins.innerText = this.coins;
    }

    triggerMerge() {
        this.playerNumber *= 2; 
        this.domNumber.innerText = this.playerNumber;
    }

    showAlert(msg) {
        this.domAlertText.innerText = msg;
        this.domAlertBox.classList.remove('hidden');
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.domAlertBox.classList.add('hidden'), 2000);
    }

    getInputVector() { return this.moveVector; }
}

window.myGameUI = new GameUI();
