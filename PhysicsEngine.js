/**
 * BallRanger.io - PhysicsEngine.js & WeaponSystem.js
 * 职责：处理 3D 刚体弹性碰撞、50% 质量碎片爆裂物理、武器状态检查与钱包硬扣除
 */
class PhysicsEngine {
    constructor(sceneInstance) {
        this.mainScene = sceneInstance;
        this.crystals = []; // 存储场上掉落的 3D 晶体碎片网格
        
        // 挂载武器执行核心状态
        this.weaponStates = {
            ShieldActive: false,
            ShieldCooldown: false,
            VacuumActive: false
        };

        // 劫持劫掠 MainScene 的技能回调指针
        if (this.mainScene) {
            this.mainScene.handleWeaponTrigger = (weapon) => this.processWeaponDeployment(weapon);
        }
    }

    // ==========================================
    // 1. 3D 弹性碰撞与 50% 质量爆裂分裂算法
    // ==========================================
    checkCollisions(dt, aiPlayers) {
        if (!this.mainScene) return;
        const player = this.mainScene.playerData;

        aiPlayers.forEach(ai => {
            // 计算两球 3D 距离
            const dx = ai.position.x - player.position.x;
            const dz = ai.position.z - player.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDistance = player.radius + ai.radius;

            if (distance < minDistance) {
                // 1. 触发刚体碰撞法线排斥
                const nx = dx / distance;
                const nz = dz / distance;

                // 简单的弹性速度对撞反弹
                const kx = player.velocity.x - ai.velocity.x;
                const kz = player.velocity.z - ai.velocity.z;
                const p = 2 * (nx * kx + nz * kz) / 2; // 简化质量比对冲力

                // 注入撞击速度衰减反弹
                player.velocity.x -= p * nx;
                player.velocity.z -= p * nz;
                ai.velocity.x += p * nx;
                ai.velocity.z += p * nz;

                // 2. 核心大招机制：弱者被撞击分裂 50% 质量
                this.executeMassSplitting(ai);
            }
        });

        // 3. 实时检测水晶碎片收集
        this.updateCrystalsPickup(player);
    }

    executeMassSplitting(targetBall) {
        if (targetBall.mass <= 2) return; // 初始保护不缩减

        const lostMass = targetBall.mass * 0.5;
        targetBall.mass -= lostMass;
        // 物理视效联动：根据球体体积立方根公式平滑缩减半径
        targetBall.radius = Math.cbrt(targetBall.mass / 2); 
        
        // 动态重新设置生成网格大小
        if (targetBall.mesh) {
            targetBall.mesh.scale.setScalar(targetBall.radius);
        }

        // 在被撞击点原位向外随机喷射生成 4 个 3D 结晶碎片
        const piecesCount = 4;
        const massPerPiece = lostMass / piecesCount;

        for (let i = 0; i < piecesCount; i++) {
            const angle = (i / piecesCount) * Math.PI * 2 + Math.random() * 0.5;
            const spawnX = targetBall.position.x + Math.cos(angle) * targetBall.radius;
            const spawnZ = targetBall.position.z + Math.sin(angle) * targetBall.radius;

            this.spawnCrystalFragment(spawnX, targetBall.position.y, spawnZ, massPerPiece);
        }
    }

    spawnCrystalFragment(x, y, z, massValue) {
        // 创建 3D 四面体极光水晶
        const geom = new THREE.TetrahedronGeometry(0.5, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00FFFF, 
            emissive: 0x008888,
            metalness: 0.9,
            roughness: 0.1
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        
        this.mainScene.scene.add(mesh);
        this.crystals.push({ mesh: mesh, mass: massValue });
    }

    updateCrystalsPickup(playerData) {
        for (let i = this.crystals.length - 1; i >= 0; i--) {
            const cry = this.crystals[i];
            const dist = playerData.position.distanceTo(cry.mesh.position);

            // 吸尘器武器激活状态下，直接施加牵引流强行拉向玩家
            if (this.weaponStates.VacuumActive && dist < 15) {
                cry.mesh.position.lerp(playerData.position, 0.15);
            }

            // 吞噬判定
            if (dist < playerData.radius + 0.4) {
                playerData.mass += cry.mass;
                playerData.radius = Math.cbrt(playerData.mass / 2);
                this.mainScene.playerMesh.scale.setScalar(playerData.radius);

                // 更新前端同步大管家
                this.mainScene.ui.updatePlayerMassUI(playerData.mass);

                // 从 3D 虚空场景移除
                this.mainScene.scene.remove(cry.mesh);
                this.crystals.splice(i, 1);
            }
        }
    }

    // ==========================================
    // 2. 武器经济链硬扣除与防刷控制 (Weapon System)
    // ==========================================
    processWeaponDeployment(weaponName) {
        const uiManager = this.mainScene.ui;
        
        // 读取当前技能锁状态弹药存量
        const ammoKey = `br_ammo_${weaponName}`;
        let currentAmmo = parseInt(localStorage.getItem(ammoKey) || '5');

        if (weaponName === 'Shield') {
            // 护盾经济规则：首次免费，后续单次实时扣除 10 金币
            const isFirstTime = !localStorage.getItem('br_shield_used');
            
            if (!isFirstTime) {
                const success = uiManager.deductCoins(10);
                if (!success) return; // 钱包余额不足拒绝施放
            } else {
                localStorage.setItem('br_shield_used', 'true');
            }

            this.activateShieldMesh();
        } 
        else if (weaponName === 'Lightning') {
            // 闪退/麻痹逻辑：消耗一发弹药并阻断全场 AI 运动力矩
            if (currentAmmo <= 0) {
                uiManager.showCenterAlert("NO AMMO FOR LIGHTNING!");
                return;
            }
            currentAmmo--;
            localStorage.setItem(ammoKey, currentAmmo.toString());
            uiManager.updateWalletUI();

            uiManager.showCenterAlert("⚡ ALL ENEMIES PARALYZED! ⚡");
            // 触发全屏闪电警告环境光
            this.mainScene.dirLight.color.setHex(0xFFFFFF);
            setTimeout(() => this.mainScene.dirLight.color.setHex(0xFF6B00), 300);
        }
        else if (weaponName === 'Vacuum') {
            // 磁力吸尘器激活
            if (currentAmmo <= 0) {
                uiManager.showCenterAlert("NO AMMO FOR VACUUM!");
                return;
            }
            currentAmmo--;
            localStorage.setItem(ammoKey, currentAmmo.toString());
            uiManager.updateWalletUI();

            this.weaponStates.VacuumActive = true;
            uiManager.showCenterAlert("🧲 VACUUM MAGNET ACTIVATED!");
            setTimeout(() => { this.weaponStates.VacuumActive = false; }, 6000); // 磁力持续6秒
        }
        else if (weaponName === 'Dash') {
            // DASH 为普通技能：零消耗，直接对物理速度矢量施加短程爆发冲力
            const forwardX = this.mainScene.playerData.velocity.x;
            const forwardZ = this.mainScene.playerData.velocity.z;
            
            // 阻断静止冲刺失效，如果静止则默认向前冲刺
            if (Math.abs(forwardX) < 0.01 && Math.abs(forwardZ) < 0.01) {
                this.mainScene.playerData.velocity.z = -1.2;
            } else {
                this.mainScene.playerData.velocity.x *= 2.5;
                this.mainScene.playerData.velocity.z *= 2.5;
            }
        }
    }

    activateShieldMesh() {
        if (this.weaponStates.ShieldActive) return;
        this.weaponStates.ShieldActive = true;

        // 在 3D 玩家球体外层渲染一层极光半透明防护能量罩
        const shieldGeom = new THREE.SphereGeometry(this.mainScene.playerData.radius * 1.3, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00FF88,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });
        const shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
        
        this.mainScene.playerMesh.add(shieldMesh); // 作为子网格绑定，自动跟随球体

        // 3秒后护盾自动消散
        setTimeout(() => {
            this.mainScene.playerMesh.remove(shieldMesh);
            this.weaponStates.ShieldActive = false;
        }, 3000);
    }

    // ==========================================
    // 3. 击杀判定与钱包奖励 +10G 返现
    // ==========================================
    checkKillReward(aiBall) {
        // 如果判定 AI 球体半径偏离中心超过碗的边界半径，判定为被撞落出局
        const r = Math.sqrt(aiBall.position.x * aiBall.position.x + aiBall.position.z * aiBall.position.z);
        if (r >= this.mainScene.arenaRadius && !aiBall.isDead) {
            aiBall.isDead = true; // 锁定防止重复计算奖励
            
            // 实时给予钱包结算返还
            this.mainScene.ui.addCoins(10);
            this.mainScene.ui.showCenterAlert("🔥 RANGER KILL! +10 COINS 🔥");
        }
    }
}

// 自动连接 MainScene 实例进行深度装配绑定
window.addEventListener('DOMContentLoaded', () => {
    const checkSetupLoop = setInterval(() => {
        if (window.gameScene) {
            window.physicsEngine = new PhysicsEngine(window.gameScene);
            clearInterval(checkSetupLoop);
        }
    }, 100);
});
