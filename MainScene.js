/**
 * BallRanger.io - MainScene.js
 * 职责：掌控 Three.js 极光玻璃态渲染、3D 吸积盘力场逻辑、多人 AI 战局、Dash 动态冲击力、以及缩放结算动画。
 */
class MainScene {
    constructor() {
        console.log("MainScene: High-performance 3D visual engine standby.");
        
        // 1. 核心玩法状态定义
        this.arenaRadius = 30;     // 竞技场初始动态半径
        this.minArenaRadius = 5;    // 动态缩小极限
        this.shrinkSpeed = 0.15;    // 每秒场馆自然缩减速度
        this.gameActive = true;     // 战局进行状态
        this.score = 0;             // 玩家当前击杀得分

        // 2. 初始化核心 3D 环境
        this.initThree();
        this.buildEnvironment();

        // 3. 实例化游戏实体角色 (满配：玩家 + 3名智能 AI 协同演练)
        this.initEntities();

        // 4. 驱动外部 UI 控制层（传入操控回调）
        if (typeof window.GameUI === 'function') {
            this.ui = new window.GameUI(
                (fx, fy) => this.handleJoystickInput(fx, fy),
                (action) => this.handleWeaponAction(action)
            );
        } else {
            console.error("Critical: GameUI source class not found!");
        }

        // 5. 驱动外部物理模拟层
        if (typeof window.PhysicsEngine === 'function') {
            this.physics = new window.PhysicsEngine();
        } else {
            console.error("Critical: PhysicsEngine source class not found!");
        }

        // 6. 激活高频游戏主循环
        this.clock = new THREE.Clock();
        this.animate();
        
        // 监听视口缩放
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    // 基础渲染管线架设
    initThree() {
        const container = document.getElementById('canvas-container') || document.body;
        
        this.scene = new THREE.Scene();
        // 极光深邃暗色背景
        this.scene.background = new THREE.Color(0x0a0c10);
        this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 32, 28);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        container.appendChild(this.renderer.domElement);

        // 环境光源与高光阴影灯打光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
    }

    // 建造核心青色竞技场大碗与磁场视觉
    buildEnvironment() {
        // 创建碗状凹陷几何体
        const geometry = new THREE.CylinderGeometry(this.arenaRadius, this.arenaRadius * 0.4, 8, 64, 4, true);
        
        // 极光青色赛博发光材质
        this.arenaMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            roughness: 0.1,
            metalness: 0.8,
            side: THREE.DoubleSide,
            wireframe: false,
            flatShading: true
        });

        this.arenaMesh = new THREE.Mesh(geometry, this.arenaMaterial);
        this.arenaMesh.position.y = 3;
        this.arenaMesh.receiveShadow = true;
        this.scene.add(this.arenaMesh);

        // 竞技场底层深渊黑洞
        const holeGeo = new THREE.CircleGeometry(this.arenaRadius * 0.39, 32);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.DoubleSide });
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.rotation.x = Math.PI / 2;
        hole.position.y = -1.01;
        this.scene.add(hole);
    }

    // 初始化实体：玩家 + 多人竞技智能 AI
    initEntities() {
        this.enemies = [];

        // 1. 玩家红球
        this.player = {
            mesh: this.createSphereMesh(0xff3344, 1.2),
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            radius: 1.2,
            mass: 1.5,
            isAI: false,
            id: 'player_ranger'
        };
        this.scene.add(this.player.mesh);

        // 2. 多人竞技 AI 阵营 (赋予各异的特色颜色与初始站位)
        const aiConfigs = [
            { color: 0xffaa00, pos: new THREE.Vector3(-10, 0, -10) },
            { color: 0x0099ff, pos: new THREE.Vector3(10, 0, -10) },
            { color: 0xcc33ff, pos: new THREE.Vector3(0, 0, 12) }
        ];

        aiConfigs.forEach((cfg, index) => {
            const aiBot = {
                mesh: this.createSphereMesh(cfg.color, 1.2),
                position: cfg.pos,
                velocity: new THREE.Vector3(0, 0, 0),
                radius: 1.2,
                mass: 1.5,
                isAI: true,
                id: `ai_ranger_${index}`,
                aiTimer: 0 // 智能决策路径时钟
            };
            this.scene.add(aiBot.mesh);
            this.enemies.push(aiBot);
        });
    }

    // 辅助生成带高光质感的发光物理球体
    createSphereMesh(color, radius) {
        const geo = new THREE.SphereGeometry(radius, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.2,
            metalness: 0.5,
            emissive: color,
            emissiveIntensity: 0.15
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    // 摇杆控制向量转化（将摇杆偏移无缝折算为玩家速度加成）
    handleJoystickInput(forceX, forceY) {
        if (!this.gameActive || !this.player) return;
        
        // 设定基础巡航速度系数
        const speedFactor = 0.35;
        this.player.velocity.x += forceX * speedFactor;
        this.player.velocity.z += forceY * speedFactor;
    }

    // Dash 技能强击冲冲冲响应！
    handleWeaponAction(action) {
        if (!this.gameActive || action !== 'dash' || !this.player) return;

        console.log("MainScene: Executing super velocity Dash impulse!");
        
        // 寻找当前的运动朝向向量
        let dashDirection = new THREE.Vector3(this.player.velocity.x, 0, this.player.velocity.z).normalize();
        
        // 如果球体目前完全静止，默认向前喷射
        if (dashDirection.lengthSq() === 0) {
            dashDirection.set(0, 0, -1);
        }

        // 瞬间爆发一个巨大的瞬间动能速度冲量
        const dashImpulse = 18.0;
        this.player.velocity.x += dashDirection.x * dashImpulse;
        this.player.velocity.z += dashDirection.z * dashImpulse;

        // 屏幕特效反馈
        if (this.ui) this.ui.showCenterAlert("💥 超速 Dash 冲刺爆发！");
    }

    // 智能战局 AI 本能决策系统
    driveAISteering(aiBot, dt) {
        aiBot.aiTimer += dt;
        if (aiBot.aiTimer > 0.5) { // 每 0.5 秒重新评估并纠正一次运动轨迹
            aiBot.aiTimer = 0;
            
            // 锁定并追踪最近的目标（可能是玩家，也可能是其他AI）
            let nearestTarget = this.player;
            let minDist = aiBot.position.distanceTo(this.player.position);

            this.enemies.forEach(other => {
                if (other.id !== aiBot.id) {
                    const d = aiBot.position.distanceTo(other.position);
                    if (d < minDist) {
                        minDist = d;
                        nearestTarget = other;
                    }
                }
            });

            // 朝向目标发起冲击驱动力矩
            const steerDir = new THREE.Vector3().subVectors(nearestTarget.position, aiBot.position).normalize();
            aiBot.velocity.x += steerDir.x * 0.32;
            aiBot.velocity.z += steerDir.z * 0.32;

            // 概率触发 AI 独特的自适应 Dash 冲刺
            if (Math.random() > 0.85 && minDist < 8) {
                aiBot.velocity.x += steerDir.x * 8;
                aiBot.velocity.z += steerDir.z * 8;
            }
        }
    }

    // 核心大循环：帧率自适应、生死检测、竞技场安全边界动态缩小
    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = Math.min(this.clock.getDelta(), 0.1); // 防止后台切窗时时钟巨变导致模型飞出宇宙

        if (this.gameActive) {
            // 1. 动态缩减竞技场的物理安全范围（Idea：末日风暴缩圈机制）
            if (this.arenaRadius > this.minArenaRadius) {
                this.arenaRadius -= this.shrinkSpeed * dt;
                // 同步改造 3D 模型的缩放尺寸
                const scaleRatio = this.arenaRadius / 30;
                this.arenaMesh.scale.set(scaleRatio, 1, scaleRatio);
            }

            // 2. 依次提交玩家物理碰撞矩阵
            if (this.physics) {
                // 汇总当前所有战场里的存活实体
                const allActiveEntities = [...this.enemies];
                
                // 计算玩家物理
                this.physics.updatePhysics(this.player, allActiveEntities, this.arenaRadius, dt);
                this.player.mesh.position.copy(this.player.position);

                // 计算每个 AI 模块的物理和战术纠偏
                this.enemies.forEach((aiBot, index) => {
                    this.driveAISteering(aiBot, dt);
                    
                    // 组装除自己以外的其他实体池作为碰撞目标
                    const otherPool = [this.player, ...this.enemies.filter(e => e.id !== aiBot.id)];
                    this.physics.updatePhysics(aiBot, otherPool, this.arenaRadius, dt);
                    aiBot.mesh.position.copy(aiBot.position);

                    // 3. 检测 AI 是否由于被撞击而彻底跌落碗底虚空 (淘汰机制)
                    if (aiBot.position.y < -15) {
                        console.log(`${aiBot.id} was eliminated!`);
                        this.scene.remove(aiBot.mesh);
                        this.enemies.splice(index, 1);
                        this.score += 100; // 玩家斩获积分奖励
                        if (this.ui) this.ui.showCenterAlert(`⚔️ 成功淘汰对手！得分 +100`);
                    }
                });
            }

            // 4. 检测玩家本人的生命阈值
            if (this.player && this.player.position.y < -15) {
                this.gameActive = false;
                if (this.ui) this.ui.showCenterAlert(`💀 坠入深渊！游戏结束。最终得分: ${this.score}`);
            }

            // 5. 胜负检测：如果场上只剩下玩家自己
            if (this.enemies.length === 0 && this.gameActive) {
                this.gameActive = false;
                if (this.ui) this.ui.showCenterAlert(`🏆 绝地吃鸡！你是唯一的王！得分: ${this.score}`);
            }

            // 相机柔和弹性平滑跟随 (缓动跟尾玩家球体)
            if (this.player) {
                const targetCamPos = new THREE.Vector3(this.player.position.x, this.player.position.y + 32, this.player.position.z + 28);
                this.camera.position.lerp(targetCamPos, 0.05);
                this.camera.lookAt(this.player.position);
            }
        }

        // 画面正式提交渲染器渲染
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 自动在全局加载完成后启动
window.addEventListener('DOMContentLoaded', () => {
    window.gameScene = new MainScene();
});
