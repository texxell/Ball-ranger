/**
 * BallRanger.io - GameUI.js
 * 职责：处理 Firebase 数据流、iPad/手机指针虚拟摇杆、武器商店锁定警告及 UI 渲染
 */

export class GameUI {
    constructor(onJoystickMove, onSkillTrigger) {
        // 外部传入的回调函数，用于将 UI 输入桥接到 3D 引擎和物理引擎
        this.onJoystickMove = onJoystickMove; 
        this.onSkillTrigger = onSkillTrigger;

        this.db = null;
        this.currentRoom = "room_alpha";
        this.playerId = "player_" + Math.random().toString(36).substr(2, 9);
        this.highScoreRecord = 0;

        // 绑定 DOM 元素
        this.coinCountEl = document.getElementById('coin-count');
        this.playerMassEl = document.getElementById('player-mass');
        this.leaderboardEl = document.getElementById('leaderboard');
        this.leaderboardListEl = document.getElementById('leaderboard-list');
        this.notificationBanner = document.getElementById('notification-banner');
        this.centerAlert = document.getElementById('center-alert');

        this.initFirebase();
        this.initJoystick();
        this.initSkillButtons();
        this.initResponsiveLeaderboard();
        this.loadWallet();
    }

    // ==========================================
    // 1. Firebase 初始化与实时排行榜数据流
    // ==========================================
    initFirebase() {
        // 此处配置与安全 https cdn 呼应，若未配置凭证则自动降级为本地离线模式模拟高分
        const firebaseConfig = {
            databaseURL: "https://ballranger-io-default-rtdb.firebaseio.com" 
        };

        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.database();
            
            // 监听实时高分纪录，准备触发 neon 特效
            this.db.ref(`${this.currentRoom}/global_high`).on('value', (snapshot) => {
                const val = snapshot.val();
                if (val) this.highScoreRecord = val.score;
            });

            // 监听 Top 5 当前房间玩家排行
            this.db.ref(`${this.currentRoom}/players`)
                .orderByChild('mass')
                .limitToLast(5)
                .on('value', (snapshot) => {
                    this.renderLeaderboard(snapshot);
                });
        } catch (e) {
            console.warn("Firebase 未配置或网络受限，切换为离线自适应模式。");
            this.setupOfflineMockLeaderboard();
        }
    }

    // 更新远端玩家自己的分数 mass 状态
    updateNetworkScore(mass) {
        if (!this.db) return;
        this.db.ref(`${this.currentRoom}/players/${this.playerId}`).set({
            name: "Ranger_" + this.playerId.substr(7, 3),
            mass: mass,
            lastSeen: Date.now()
        });

        // 检查是否打破房间全服最高纪录
        if (mass > this.highScoreRecord && this.highScoreRecord > 0) {
            this.db.ref(`${this.currentRoom}/global_high`).set({ score: mass, holder: this.playerId });
            this.triggerHighScoreBanner();
        }
    }

    renderLeaderboard(snapshot) {
        let players = [];
        snapshot.forEach((child) => {
            players.push(child.val());
        });
        players.reverse(); // 从大到小排列

        this.leaderboardListEl.innerHTML = players.map((p, idx) => 
            `<li>${idx + 1}. ${p.name}: <span style="color:#FF6B00; font-weight:bold;">${p.mass}</span></li>`
        ).join('');
    }

    setupOfflineMockLeaderboard() {
        // 离线状态下的影子数据，确保游戏界面不卡死在 Loading...
        const mockData = [
            { name: "Alpha_Bot", mass: 45 },
            { name: "Ranger_You", mass: 2 },
            { name: "Vader_Ball", mass: 12 },
            { name: "Neon_Drive", mass: 8 }
        ];
        this.leaderboardListEl.innerHTML = mockData
            .sort((a,b) => b.mass - a.mass)
            .map((p, idx) => `<li>${idx + 1}. ${p.name}: ${p.mass}</li>`).join('');
    }

    triggerHighScoreBanner() {
        this.notificationBanner.innerText = "🔥 NEW HIGH SCORE RECORD! 🔥";
        this.notificationBanner.classList.remove('hidden');
        setTimeout(() => this.notificationBanner.classList.add('hidden'), 4000);
    }

    // ==========================================
    // 2. iPad / 手机高抗触控死锁虚拟摇杆 (PointerEvents)
    // ==========================================
    initJoystick() {
        const base = document.getElementById('joystick-base');
        const handle = document.getElementById('joystick-handle');
        if (!base || !handle) return;

        let active = false;
        let startX = 0, startY = 0;
        const maxRadius = 35; // 限制摇杆手柄移动的像素半径

        // 严格使用 pointer events，iPad Safari 完美兼容，绝不污染全局 touchstart
        base.addEventListener('pointerdown', (e) => {
            active = true;
            startX = e.clientX;
            startY = e.clientY;
            base.setPointerCapture(e.pointerId); // 锁死指针追踪
        });

        base.addEventListener('pointermove', (e) => {
            if (!active) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let angle = Math.atan2(dy, dx);
            let moveX = dx;
            let moveY = dy;

            if (distance > maxRadius) {
                moveX = Math.cos(angle) * maxRadius;
                moveY = Math.sin(angle) * maxRadius;
            }

            // CSS 硬件加速渲染手柄偏离
            handle.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

            // 归一化输入值 (-1 到 1)，方便 3D 场景直接注入力向量
            const forceX = moveX / maxRadius;
            const forceY = moveY / maxRadius;
            if (this.onJoystickMove) this.onJoystickMove(forceX, forceY);
        });

        const stopJoystick = (e) => {
            if (!active) return;
            active = false;
            handle.style.transform = 'translate(-50%, -50%)'; // 回弹中心
            if (this.onJoystickMove) this.onJoystickMove(0, 0); // 停止施加推力
        };

        base.addEventListener('pointerup', stopJoystick);
        base.addEventListener('pointercancel', stopJoystick);
    }

    // ==========================================
    // 3. 武器/技能锁系统与弹窗反作弊
    // ==========================================
    initSkillButtons() {
        const buttons = document.querySelectorAll('.skill-btn, #btn-dash');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // 如果是普通冲刺按键，直接触发
                if (btn.id === 'btn-dash') {
                    if (this.onSkillTrigger) this.onSkillTrigger('Dash');
                    return;
                }

                // 获取当前武器属性
                const weaponName = btn.getAttribute('data-weapon');
                
                // 反作弊检查：如果 DOM 包含 locked，直接拦截并报警告
                if (btn.classList.contains('locked')) {
                    this.showCenterAlert(`UNLOCK ${weaponName.toUpperCase()} IN SHOP FIRST!`);
                    return;
                }

                // 已解锁状态，执行物理/扣款逻辑
                if (this.onSkillTrigger) this.onSkillTrigger(weaponName);
            });
        });
    }

    showCenterAlert(text) {
        this.centerAlert.innerText = text;
        this.centerAlert.classList.remove('hidden');
        
        // 自动淡出清除
        if (this.alertTimeout) clearTimeout(this.alertTimeout);
        this.alertTimeout = setTimeout(() => {
            this.centerAlert.classList.add('hidden');
        }, 2000);
    }

    // ==========================================
    // 4. 本地经济钱包管理与界面渲染
    // ==========================================
    loadWallet() {
        this.coins = parseInt(localStorage.getItem('br_coins') || '100'); // 默认初始 100G 用于测试解锁
        this.unlockedWeapons = JSON.parse(localStorage.getItem('br_unlocked') || '[]');
        
        this.updateWalletUI();
    }

    addCoins(amount) {
        this.coins += amount;
        localStorage.setItem('br_coins', this.coins.toString());
        this.updateWalletUI();
    }

    deductCoins(amount) {
        if (this.coins >= amount) {
            this.coins -= amount;
            localStorage.setItem('br_coins', this.coins.toString());
            this.updateWalletUI();
            return true;
        }
        this.showCenterAlert("NOT ENOUGH COINS!");
        return false;
    }

    updateWalletUI() {
        this.coinCountEl.innerText = this.coins;
        
        // 更新界面的武器弹药数和解锁图标状态
        const weaponTypes = ['Shield', 'Lightning', 'Vacuum'];
        weaponTypes.forEach(type => {
            const btn = document.querySelector(`[data-weapon="${type}"]`);
            if (!btn) return;

            const isUnlocked = this.unlockedWeapons.includes(type);
            const ammoCount = localStorage.getItem(`br_ammo_${type}`) || '5'; // 默认5发预存弹药

            if (isUnlocked) {
                btn.classList.remove('locked');
                btn.querySelector('.ammo').innerText = `x${ammoCount}`;
            } else {
                btn.classList.add('locked');
                btn.querySelector('.ammo').innerText = `🔒 x${ammoCount}`;
            }
        });
    }

    updatePlayerMassUI(mass) {
        this.playerMassEl.innerText = Math.floor(mass);
        this.updateNetworkScore(Math.floor(mass));
    }

    // ==========================================
    // 5. 手机端小屏幕下排行榜点击折叠/展开适配
    // ==========================================
    initResponsiveLeaderboard() {
        const toggle = document.getElementById('leaderboard-toggle');
        toggle.addEventListener('click', () => {
            // 在手机端视口下切换折叠样式
            if (window.innerWidth <= 767) {
                this.leaderboardEl.classList.toggle('collapsed-mobile');
            }
        });
    }
}
