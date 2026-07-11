/**
 * ==========================================================================
 * BallRanger.io - 本地军火商店与 localStorage 数据持久化引擎 (防断电丢档版)
 * ==========================================================================
 */

export class GameShop {
    constructor() {
        // --- 1. 绑定商店 DOM 节点接头 ---
        this.btnBuyShield = document.getElementById('btn-buy-shield');
        this.btnCheatGold = document.getElementById('btn-cheat-gold');
        
        // --- 2. 武器定价单 ---
        this.shieldPrice = 500; 

        this.initShopLogic();
    }

    /**
     * 初始化商店的核心购买逻辑与反丢档记账
     */
    initShopLogic() {
        // 实时检查一次神盾的销售状态，如果早就买过了，直接把大厅按钮写死
        this.checkShieldStatus();

        // A. 【解锁神盾 500G】按钮事件
        this.btnBuyShield.addEventListener('click', () => {
            // 1. 先去第二层 UI 账本里实时盘点当前的钱包余额
            let currentGold = window.gameUI.walletGold;
            let isAlreadyUnlocked = localStorage.getItem('br_unlocked_shield') === 'true';

            if (isAlreadyUnlocked) {
                window.gameUI.triggerCenterAlert("SHIELD IS ALREADY UNLOCKED!");
                return;
            }

            // 2. 铁血拦截：如果钱不够，死活不卖！
            if (currentGold < this.shieldPrice) {
                window.gameUI.triggerCenterAlert(`NOT ENOUGH GOLD! NEED ${this.shieldPrice}G!`);
                return;
            }

            // 3. 账目扣款，扣完立刻同步给大厅 UI
            currentGold -= this.shieldPrice;
            window.gameUI.walletGold = currentGold;
            window.gameUI.isShieldUnlocked = true; // 局内反作弊防火墙瞬间放行！
            
            // 4. 🔥 核心：永久刻进 iPad 硬件，防止 Safari 暗杀进程
            localStorage.setItem('br_wallet_gold', currentGold);
            localStorage.setItem('br_unlocked_shield', 'true');

            // 5. 刷新界面
            window.gameUI.hudCoinAmount.innerText = currentGold + "G";
            this.checkShieldStatus();
            window.gameUI.triggerCenterAlert("SHIELD UNLOCKED PERMANENTLY!");
        });

        // B. 【充钱测试 +1000G】外挂调试按钮逻辑
        this.btnCheatGold.addEventListener('click', () => {
            let currentGold = window.gameUI.walletGold;
            currentGold += 1000;
            
            // 瞬间记账并写入硬件
            window.gameUI.walletGold = currentGold;
            localStorage.setItem('br_wallet_gold', currentGold);
            
            // 刷新大厅顶部的金币数字
            window.gameUI.hudCoinAmount.innerText = currentGold + "G";
            window.gameUI.triggerCenterAlert("TESTING GOLD +1000G ADDED!");
        });
    }

    /**
     * 判定神盾是否处于已拥有状态，并改变大厅按钮质感
     */
    checkShieldStatus() {
        const isShieldUnlocked = localStorage.getItem('br_unlocked_shield') === 'true';
        if (isShieldUnlocked && this.btnBuyShield) {
            this.btnBuyShield.classList.add('disabled');
            this.btnBuyShield.innerText = "🛡️ OWNED";
            this.btnBuyShield.setAttribute('disabled', 'true');
        }
    }
}

// ==========================================================================
// 🚨 钉死常驻全局，严防垃圾回收
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    window.gameShop = new GameShop();
});
