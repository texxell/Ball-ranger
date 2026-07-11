/**
 * 步骤一：锁死保命版 MainScene.js
 * 目标：稳住大碗、红球不准死、不准飞。
 */
class MainScene {
    constructor() {
        console.log("MainScene: 启动保命模式！");
        
        this.arenaRadius = 30;     
        this.minArenaRadius = 6;    
        this.shrinkSpeed = 0; // 【修改点1】暂时锁死缩圈，大碗不准变小！ 
        this.gameActive = true;     
        this.score = 0;             

        this.initThree();
        this.buildEnvironment();
        this.initEntities(); 

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
        this.scene.background = new THREE.Color(0x0a0c10); // 深色背景恢复
        this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 38, 32);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    }

    initEntities() {
        this.enemies = [];

        // 玩家安全出生
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

        // 3个AI球先放在最外围，避免一出生就撞炸
        const aiConfigs = [
            { color: 0xffaa00, pos: new THREE.Vector3(-15, 0, -15) },
            { color: 0x0099ff, pos: new THREE.Vector3(15, 0, -15) },
            { color: 0xcc33ff, pos: new THREE.Vector3(0, 0, 18) }
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
        return new THREE.Mesh(geo, mat);
    }

    handleJoystickInput(forceX, forceY) {
        if (!this.player) return;
        this.player.velocity.x += forceX * 0.5;
        this.player.velocity.z += forceY * 0.5;
        console.log("主场景收到摇杆信号！"); // 用于排查断层
    }

    handleWeaponAction(action) {
        if (action !== 'dash' || !this.player) return;
        this.player.velocity.x = (this.player.velocity.x || 0) + 10;
        console.log("主场景收到 Dash 信号！"); // 用于排查断层
        if (this.ui) this.ui.showCenterAlert("测试Dash！");
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // 【修改点2】强行把时间步长按死，绝不允许开局卡顿导致速度爆炸
        const dt = 0.016; 

        if (this.gameActive) {
            
            if (this.physics) {
                const allActiveEntities = [...this.enemies];
                
                this.physics.updatePhysics(this.player, allActiveEntities, this.arenaRadius, dt);

                // 【修改点3】防黑屏死机：如果算出NaN，强行复活在中间
                if (isNaN(this.player.position.x)) {
                    this.player.position.set(0,0,0);
                    this.player.velocity.set(0,0,0);
                }

                this.player.mesh.position.copy(this.player.position);

                this.enemies.forEach((aiBot) => {
                    this.physics.updatePhysics(aiBot, [this.player], this.arenaRadius, dt);
                    if (isNaN(aiBot.position.x)) {
                        aiBot.position.set(0,0,0);
                        aiBot.velocity.set(0,0,0);
                    }
                    aiBot.mesh.position.copy(aiBot.position);
                });
            }

            // 【修改点4】防死机制：只要掉下去，立马瞬移回中心，不再游戏结束
            if (this.player && this.player.position.y < -5) {
                this.player.position.set(0, 5, 0);
                this.player.velocity.set(0, 0, 0);
                console.log("触发防跌落保护，回城！");
            }

            if (this.player) {
                this.camera.position.set(this.player.position.x, 38, this.player.position.z + 32);
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
