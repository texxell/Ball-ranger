/**
 * ==========================================================================
 * BallRanger.io - 局内 UI 与多点触控防死锁引擎 (iPad Safari 专用高级版)
 * ==========================================================================
 */

export class GameUI {
    constructor() {
        // --- 1. 初始化所有 HTML DOM 节点的接头 ---
        this.startMenu = document.getElementById('start-menu-overlay');
        this.ingameUI = document.getElementById('ingame-ui-layer');
        this.adLoader = document.getElementById('ad-loader-screen');
        this.alertBanner = document.getElementById('center-alert-banner');
        
        // 按钮类接头
        this.btnStart = document.getElementById('btn-start-game');
        this.btnAdX5 = document.getElementById('btn-ad-x5');
        this.btnAdX2 = document.getElementById('btn-ad-x2');
        this.btnDash = document.getElementById('action-dash');
        
        // 文本数值类接头
        this.previewSizeNum = document.getElementById('preview-size-num');
        this.hudCoinAmount = document.getElementById('hud-coin-amount');
        
        // --- 2. 核心状态账本 (State Management) ---
        this.currentSizeMultiplier = 1; // 初始大厅球体体积倍数
        this.isX5Watched = false;       // 标记是否看过了 x5 广告
        this.isX2Watched = false;       // 标记是否看过了 x2 广告
        this.walletGold = parseInt(localStorage.getItem('br_wallet_gold')) || 0; // 从本地常驻内存读取金币
        this.isShieldUnlocked = localStorage.getItem('br_unlocked_shield') === 'true';
        
        // --- 3. iPad 独立多点触控身份证账本 (Pointer IDs) ---
        this.joystickPointerId = null;  // 专门锁死左手模拟摇杆的手指身份证
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.moveX = 0;                 // 最终传给 3D 引擎的虚拟水平力 (X轴)
        this.moveZ = 0;                 // 最终传给 3D 引擎的虚拟纵深力 (Z轴，严防颠倒加到Y轴上)

        // --- 4. 注册外部 3D 物理引擎的传音筒 (Callbacks) ---
        this.onJoystickMoveCallback = null;
        this.onDashTriggerCallback = null;
        this.onWeaponTriggerCallback = null;
        this.onGameStartLaunchCallback = null;

        // 刷新初始金币UI显示
        this.hudCoinAmount.innerText = this.walletGold + "G";

        this.initDOMEvents();
        this.initTouchEngine();
    }

    /**
     * 绑定大厅与武器升级按钮的点击事件
     */
    initDOMEvents() {
        // A. 看广告倍增 x5 按钮逻辑
        this.btnAdX5.addEventListener('click', () => {
            if (this.isX5Watched) return;
            this.playMockAd(() => {
                this.currentSizeMultiplier = 5;
                this.isX5Watched = true;
                this.previewSizeNum.innerText = "10 (x5 Boosted)";
                this.btnAdX5.classList.add('disabled');
                this.btnAdX5.innerText = "📺 X5 CLAIMED";
                // 激活 x2 按钮的大门
                this.btnAdX2.classList.remove('disabled');
                this.btnAdX2.removeAttribute('disabled');
                this.triggerCenterAlert("SIZE BOOSTED TO 5X!");
            });
        });

        // B. 看广告倍增 x2 按钮逻辑
        this.btnAdX2.addEventListener('click', () => {
            if (!this.isX5Watched || this.isX2Watched) return;
            this.playMockAd(() => {
                this.currentSizeMultiplier = 10; // 5 * 2 = 10倍体积！
                this.isX2Watched = true;
                this.previewSizeNum.innerText = "20 (MAX 10x Boosted!)";
                this.btnAdX2.classList.add('disabled');
                this.btnAdX2.innerText = "📺 MAXED OUT";
                this.triggerCenterAlert("SIZE MAXED OUT TO 10X!");
            });
        });

        // C. 点击 START GAME 正式发射进场
        this.btnStart.addEventListener('click', () => {
            this.startMenu.classList.add('hidden-ui');       // 隐藏大厅
            this.ingameUI.classList.remove('hidden-ui');     // 唤醒局内 UI 
            
            this.triggerCenterAlert("MATCH STARTED! FIGHT!");

            // 广播给 3D 引擎：玩家带着最终翻倍倍数入场，准备生成真正的 3D 刚体
            if (this.onGameStartLaunchCallback) {
                this.onGameStartLaunchCallback(this.currentSizeMultiplier);
            }
        });

        // D. 局内 DASH 冲刺按钮
        this.btnDash.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件往下渗透污染 3D 视口
            if (this.onDashTriggerCallback) this.onDashTriggerCallback();
        });

        // E. 局内 3 个高阶武器反作弊拦截点击
        const skills = ['shield', 'lightning', 'vacuum'];
        skills.forEach(skill => {
            const btn = document.getElementById(`skill-${skill}`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 如果在本地商店里没解锁，死死拦住，弹出警告！
                    if (skill === 'shield' && !this.isShieldUnlocked) {
                        this.triggerCenterAlert("UNLOCK SHIELD IN SHOP FIRST!");
                        return;
                    }
                    // 已解锁状态，放行通知物理与武器文件
                    if (this.onWeaponTriggerCallback) this.onWeaponTriggerCallback(skill);
                });
            }
        });
    }

    /**
     * 🏹 iPad 多点触控身份证防火墙引擎 (PointerEvent Architecture)
     * 彻底抛弃 touches[0]，左半屏任意搓产生隐藏虚拟摇杆，右半屏点按不受干扰
     */
    initTouchEngine() {
        // 监听整张网页的指针按下事件
        document.addEventListener('pointerdown', (e) => {
            // 如果是在开局大厅，或者点到了右下角动作条，不产生摇杆逻辑
            if (!this.startMenu.classList.contains('hidden-ui')) return;
            if (e.clientY > window.innerHeight * 0.75 && e.clientX > window.innerWidth * 0.4) return;

            // 锁定左半屏作为摇杆感应区，且当前没有活动的摇杆手指
            if (e.clientX < window.innerWidth * 0.6 && this.joystickPointerId === null) {
                this.joystickPointerId = e.pointerId; // 抓取当前这根手指的独立身份证号！
                this.touchStartX = e.clientX;
                this.touchStartY = e.clientY;
            }
        });

        // 监听指针移动
        document.addEventListener('pointermove', (e) => {
            // 只有对上身份证号的那根手指移动，才计算搓球力矩
            if (this.joystickPointerId === e.pointerId) {
                const deltaX = e.clientX - this.touchStartX;
                const deltaY = e.clientY - this.touchStartY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
                const maxRadius = 60; // 摇杆最大内圈半径

                // 限制推力系数在 -1.0 到 1.0 之间
                const ratio = Math.min(distance, maxRadius) / maxRadius;
                this.moveX = (deltaX / distance) * ratio;
                this.moveZ = (deltaY / distance) * ratio; // ⚠️ 注意：屏幕的 Y 轴对应 3D 世界的 Z 轴（前后纵深）！

                // 实时传音给 3D 物理循环，推球前行
                if (this.onJoystickMoveCallback) {
                    this.onJoystickMoveCallback(this.moveX, this.moveZ);
                }
            }
        });

        // 监听指针抬起或因意外断开 (比如手掌边缘刮到 iPad 屏幕)
        const endTouch = (e) => {
            if (this.joystickPointerId === e.pointerId) {
                this.joystickPointerId = null; // 释放身份证号
                this.moveX = 0;
                this.moveZ = 0;
                if (this.onJoystickMoveCallback) this.onJoystickMoveCallback(0, 0); // 球由于没有推力，靠惯性滑行
            }
        };

        document.addEventListener('pointerup', endTouch);
        document.addEventListener('pointercancel', endTouch); // 专门应对 iPad 特有的多指误触取消
    }

    /**
     * 📺 1.5秒全屏磨砂广告加载空壳 (未来直接接入商业广告 SDK 替换此处即可)
     */
    playMockAd(onVideoFinished) {
        this.adLoader.classList.remove('hidden-ui');
        setTimeout(() => {
            this.adLoader.classList.add('hidden-ui');
            onVideoFinished();
        }, 1500); // 1.5 秒后模拟看完广告，无缝回调
    }

    /**
     * 📢 浮动中央全英文高阶警告弹窗
     */
    triggerCenterAlert(message) {
        this.alertBanner.innerText = message;
        this.alertBanner.classList.remove('alert-banner-hidden');
        
        // 清除上一次的定时器，防止快速连续点击时弹窗闪烁
        clearTimeout(this.alertTimeout);
        this.alertTimeout = setTimeout(() => {
            this.alertBanner.classList.add('alert-banner-hidden');
        }, 2000); // 2秒后自动优雅淡出
    }
}

// ==========================================================================
// 🚨 绝对核心防暗杀线：强行钉死在 window 全局作用域，彻底绝后患
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    window.gameUI = new GameUI(); // 常驻内存，Safari 的垃圾回收看到它有主，绝对不敢清理它！
});
