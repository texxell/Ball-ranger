/**
 * BallRanger.io - MainScene.js (终结修正版)
 * 职责：加入严密的最高限速（Speed Cap）、安全出生缓冲，彻底解决开局飞出宇宙的Bug。
 */
class MainScene {
    constructor() {
        console.log("MainScene: Core initialization with anti-rocket speed limits.");
        
        this.arenaRadius = 30;     
        this.minArenaRadius = 6;    
        this.shrinkSpeed = 0.2;    
        this.gameActive = true;     
        this.score = 0;             

        this.initThree();
        this.buildEnvironment();
        this.initEntities(); // 散开安全出生点

        if (typeof window.GameUI === 'function') {
            this.ui = new window.GameUI(
                (fx, fy) => this.handleJoystickInput(fx, fy),
                (action) => this.handleWeaponAction(action)
            );
        }

        if (typeof window.PhysicsEngine === 'function') {
            this.physics = new window.PhysicsEngine();
        }

        this.clock = new THREE.Clock();
        this.animate();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initThree() {
        const container = document.getElementById('canvas-container') || document.body;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0c10);
        this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        // 拉高相机，确保能看清全局
        this.camera.position.set(0, 38, 32);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, 20);
        this.scene.add(dirLight);
    }

    buildEnvironment() {
        const geometry = new THREE.CylinderGeometry(this.arenaRadius, this.arenaRadius * 0.4, 8, 64, 4, true);
        this.arenaMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            roughness: 0.2,
            metalness: 0.7,
            side: THREE.DoubleSide,
            flatShading: true
        });
        this.arenaMesh = new THREE.Mesh(geometry, this.arenaMaterial);
        this.arenaMesh.position.y = 3;
        this.scene.add(this.arenaMesh);

        // 深渊底
        const holeGeo = new THREE.CircleGeometry(this.arenaRadius * 0.39, 32);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.DoubleSide });
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.rotation.x = Math.PI / 2;
        hole.position.y = -1.01;
        this.scene.add(hole);
    }

    initEntities() {
        this.enemies = [];

        // 1. 玩家放在中心安全区，速度清零
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

        // 2. AI 必须要散开出生，不能挤在中间，防止开局由于刚体严重重叠产生瞬间爆炸巨大的排斥力！
        const aiConfigs = [
            { color: 0xffaa00, pos: new THREE.Vector3(-14, 0, -14) },
            { color: 0x0099ff, pos: new THREE.Vector3(14, 0, -14) },
            { color: 0xcc33ff, pos: new THREE.Vector3(0, 0, 16) }
        ];

        aiConfigs.forEach((cfg, index) => {
            const aiBot = {
                mesh: this.createSphereMesh(cfg.color, 1.2),
                position: cfg.pos.clone(),
                velocity: new THREE.Vector3(0, 0, 0),
                radius: 1.2,
                mass: 1.5,
                isAI: true,
                id: `ai_ranger_${index}`,
                aiTimer: 0
            };
            this.scene.add(aiBot.mesh);
            this.enemies.push(aiBot);
        });
    }

    createSphereMesh(color, radius) {
        const geo = new THREE.SphereGeometry(radius, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.2,
            metalness: 0.4,
        });
        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    }

    // 摇杆操纵向量转化 (平滑控速)
    handleJoystickInput(forceX, forceY) {
        if (!this.gameActive || !this.player) return;
        
        // 赋予适当的推动力，而不是无限制叠加
        const accel = 0.5;
        this.player.velocity.x += forceX * accel;
        this.player.velocity.z += forceY * accel;
    }

    // Dash 强击
    handleWeaponAction(action) {
        if (!this.gameActive || action !== 'dash' || !this.player) return;

        // 获取朝向
        let dashDir = new THREE.Vector3(this.player.velocity.x, 0, this.player.velocity.z).normalize();
        if (dashDir.lengthSq() === 0) {
            dashDir.set(0, 0, -1);
        }

        // 瞬间给予冲刺爆发速
        const dashSpeed = 15.0;
        this.player.velocity.x = dashDir.x * dashSpeed;
        this.player.velocity.z = dashDir.z * dashSpeed;

        if (this.ui) this.ui.showCenterAlert("💥 Dash 冲刺！");
    }

    driveAISteering(aiBot, dt) {
        aiBot.aiTimer += dt;
        if (aiBot.aiTimer > 0.6) { 
            aiBot.aiTimer = 0;
            
            // 追踪最近的目标
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

            const steerDir = new THREE.Vector3().subVectors(nearestTarget.position, aiBot.position).normalize();
            aiBot.velocity.x += steerDir.x * 0.4;
            aiBot.velocity.z += steerDir.z * 0.4;

            // 极低概率触发 AI 冲刺
            if (Math.random() > 0.92 && minDist < 6) {
                aiBot.velocity.x += steerDir.x * 6;
                aiBot.velocity.z += steerDir.z * 6;
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // 严密限制最高帧间隔时间步长，防止由于浏览器卡顿导致累积巨额速度
        const dt = Math.min(this.clock.getDelta(), 0.03); 

        if (this.gameActive) {
            // 1. 赛场缩圈
            if (this.arenaRadius > this.minArenaRadius) {
                this.arenaRadius -= this.shrinkSpeed * dt;
                const scaleRatio = this.arenaRadius / 30;
                this.arenaMesh.scale.set(scaleRatio, 1, scaleRatio);
            }

            // 【核心防飞机制】：加设最高限速铁律限制 (Speed Cap)
            const MAX_SPEED = 12;
            const capSpeed = (entity) => {
                let speed = Math.sqrt(entity.velocity.x * entity.velocity.x + entity.velocity.z * entity.velocity.z);
                if (speed > MAX_SPEED) {
                    entity.velocity.x = (entity.velocity.x / speed) * MAX_SPEED;
                    entity.velocity.z = (entity.velocity.z / speed) * MAX_SPEED;
                }
            };

            if (this.physics) {
                const allActiveEntities = [...this.enemies];
                
                // 计算玩家物理 + 强行限速
                capSpeed(this.player);
                this.physics.updatePhysics(this.player, allActiveEntities, this.arenaRadius, dt);
                this.player.mesh.position.copy(this.player.position);

                // 计算 AI 物理 + 强行限速
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const aiBot = this.enemies[i];
                    this.driveAISteering(aiBot, dt);
                    
                    const otherPool = [this.player, ...this.enemies.filter(e => e.id !== aiBot.id)];
                    capSpeed(aiBot);
                    this.physics.updatePhysics(aiBot, otherPool, this.arenaRadius, dt);
                    aiBot.mesh.position.copy(aiBot.position);

                    // 跌落淘汰检测
                    if (aiBot.position.y < -12) {
                        this.scene.remove(aiBot.mesh);
                        this.enemies.splice(i, 1);
                        this.score += 100;
                        if (this.ui) this.ui.showCenterAlert(`⚔️ 成功淘汰对手！得分 +100`);
                    }
                }
            }

            // 玩家死亡检测
            if (this.player && this.player.position.y < -12) {
                this.gameActive = false;
                if (this.ui) this.ui.showCenterAlert(`💀 坠入深渊！游戏结束。`);
            }

            // 获胜检测
            if (this.enemies.length === 0 && this.gameActive) {
                this.gameActive = false;
                if (this.ui) this.ui.showCenterAlert(`🏆 绝地吃鸡！游戏胜利！`);
            }

            // 相机柔和弹性平滑跟随
            if (this.player && this.player.position.y >= -12) {
                const targetCamPos = new THREE.Vector3(this.player.position.x, this.player.position.y + 38, this.player.position.z + 32);
                this.camera.position.lerp(targetCamPos, 0.08);
                this.camera.lookAt(this.player.position);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameScene = new MainScene();
});
