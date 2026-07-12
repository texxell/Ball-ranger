/**
 * ==========================================================================
 * BallRanger.io - MainScene (3D 完美大操场 + 疯狂 AI 撞击版)
 * 职责：100%保留最完美的拼色巨型大盘子、巨大体积球、相机追踪、3个暗红 AI 追撞、跌落边缘 Game Over
 * ==========================================================================
 */

class MainScene {
    constructor() {
        this.container = document.getElementById('game-container');
        this.isGameOver = false;

        // 1. 物理世界核心参数（epicball 原始巨型尺寸，绝无删减！）
        this.arenaRadius = 150; // 超级大操场半径 150 米
        this.player = {
            mesh: null,
            radius: 2,         // 4米直径的白金巨球
            x: 0, z: 0,        // 水平坐标
            vx: 0, vz: 0,      // 水平速度
            y: 10, vy: 0,      // 初始悬空高度与重力速度
            speed: 45,         // 狂暴推力
            friction: 0.98     // 丝滑沙地惯性
        };

        // 🤖 敌方 AI 巨球阵列 (暗红电镀材质)
        this.enemies = [
            { id: 1, mesh: null, radius: 2.2, x: -40, z: -40, vx: 0, vz: 0, y: 5, vy: 0, speed: 25 },
            { id: 2, mesh: null, radius: 1.8, x: 40, z: -50, vx: 0, vz: 0, y: 5, vy: 0, speed: 30 },
            { id: 3, mesh: null, radius: 2.5, x: 0, z: -60, vx: 0, vz: 0, y: 5, vy: 0, speed: 20 }
        ];

        this.initThree();
        this.createEpicArena();
        this.createPlayerBall();
        this.createEnemyBalls(); // 唤醒 AI 敌军
        this.createGameOverUI();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        console.log("🏟️ [MainScene] 3D 巨型拼色操场与 AI 军队全部武装完毕！");
    }

    initThree() {
        // 创建 3D 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#0A0A0F'); // 极度深邃的星空太空底色
        this.scene.fog = new THREE.FogExp2('#0A0A0F', 0.003); // 远端迷雾

        // 创建透视相机
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

        // 创建 WebGL 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // 注入高空战术双光源
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffe0b2, 1.2); // 微微带有一点暖沙色的阳光
        dirLight.position.set(80, 150, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
    }

    /**
     * 🧱 核心美学：中央泥土褐、中间科技青草、外围黄褐色沙路的大盘子操场
     */
    createEpicArena() {
        const geometry = new THREE.CircleGeometry(this.arenaRadius, 64);
        const pos = geometry.attributes.position;
        const colors = [];

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i); 
            const dist = Math.sqrt(x*x + y*y);

            // 公式：越靠近边缘，盘子微微翘起
            const z = -(x*x + y*y) * 0.00015;
            pos.setZ(i, z);

            // 根据距离圆心的远近，手工涂刷“褐色”与“青色”拼色路面
            const color = new THREE.Color();
            if (dist < 25) {
                color.setStyle('#4A3525'); // 1. 最中央区域：深泥土褐色
            } else if (dist >= 25 && dist < 100) {
                color.setStyle('#00A88F'); // 2. 中间主要奔跑区：科技青绿色草地
            } else {
                color.setStyle('#C29B68'); // 3. 外围极速赛道：黄褐色沙路赛道 (Sandy Path)
            }
            colors.push(color.r, color.g, color.b);
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.arenaMesh = new THREE.Mesh(geometry, material);
        this.arenaMesh.rotation.x = -Math.PI / 2; // 平铺成大地
        this.arenaMesh.receiveShadow = true;
        this.scene.add(this.arenaMesh);

        // 大盘子最外圈的红霓虹警戒线
        const ringGeo = new THREE.RingGeometry(this.arenaRadius - 0.5, this.arenaRadius + 0.5, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: '#FF3366', side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        this.scene.add(ring);
    }

    createPlayerBall() {
        const geometry = new THREE.SphereGeometry(this.player.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            metalness: 0.9,
            roughness: 0.1
        });

        this.player.mesh = new THREE.Mesh(geometry, material);
        this.player.mesh.castShadow = true;
        this.player.mesh.receiveShadow = true;
        this.player.mesh.position.set(0, this.player.y, 0);
        this.scene.add(this.player.mesh);
    }

    /**
     * 🤖 创造 3 个巨型暗红 AI 敌军球
     */
    createEnemyBalls() {
        const geometry = new THREE.SphereGeometry(1, 32, 32); 
        const material = new THREE.MeshStandardMaterial({ color: '#CC2222', metalness: 0.7, roughness: 0.2 }); 

        this.enemies.forEach(enemy => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.setScalar(enemy.radius); // 缩放到巨型尺寸
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.set(enemy.x, enemy.y, enemy.z);
            this.scene.add(mesh);
            enemy.mesh = mesh;
        });
    }

    createGameOverUI() {
        this.gameOverEl = document.createElement('div');
        this.gameOverEl.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 0, 0, 0.85); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            display: none; flex-direction: column; align-items: center; justify-content: center;
            z-index: 9999; color: #FFFFFF; font-family: sans-serif;
        `;
        this.gameOverEl.innerHTML = `
            <h1 style="font-size: 50px; color: #FF3333; text-shadow: 0 0 20px rgba(255,0,0,0.6); margin-bottom: 10px; font-weight:900;">GAME OVER</h1>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; margin-bottom: 25px;">YOU FELL INTO THE ABYSS OF THE ARENA!</p>
            <button id="btn-respawn" style="
                padding: 12px 35px; font-size: 16px; font-weight: bold; background: #FF3333;
                border: none; border-radius: 8px; color: white; cursor: pointer; box-shadow: 0 5px 15px rgba(255,51,51,0.4);
            ">RESPAWN (RELOAD)</button>
        `;
        document.body.appendChild(this.gameOverEl);

        document.getElementById('btn-respawn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isGameOver) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const deltaTime = 1 / 60;

        // ==========================================================================
        // 1. 玩家物理与盲操矢量数据抽离
        // ==========================================================================
        let inputX = 0;
        let inputZ = 0;
        if (window.myGameUI) {
            const vector = window.myGameUI.getInputVector();
            inputX = vector.x;
            inputZ = vector.y; 
        }

        this.player.vx += inputX * this.player.speed * deltaTime;
        this.player.vz += inputZ * this.player.speed * deltaTime;
        this.player.vx *= this.player.friction;
        this.player.vz *= this.player.friction;
        this.player.x += this.player.vx * deltaTime;
        this.player.z += this.player.vz * deltaTime;

        // 玩家重力与大盘子弧度高度计算
        const playerDist = Math.sqrt(this.player.x * this.player.x + this.player.z * this.player.z);
        let playerSurfaceY = playerDist <= this.arenaRadius ? -(this.player.x * this.player.x + this.player.z * this.player.z) * 0.00015 + this.player.radius : -99999;
        
        if (this.player.y > playerSurfaceY) {
            this.player.vy -= 35 * deltaTime; 
        } else {
            this.player.y = playerSurfaceY;
            this.player.vy = 0; 
        }
        this.player.y += this.player.vy * deltaTime;

        if (this.player.mesh) {
            this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
            if (Math.abs(this.player.vx) > 0.1 || Math.abs(this.player.vz) > 0.1) {
                this.player.mesh.rotation.z -= this.player.vx * 0.05;
                this.player.mesh.rotation.x += this.player.vz * 0.05;
            }
        }

        // ==========================================================================
        // 2. 🤖 敌方 AI 猎杀算法与重力同步
        // ==========================================================================
        this.enemies.forEach(enemy => {
            const edist = Math.sqrt(enemy.x * enemy.x + enemy.z * enemy.z);
            
            if (edist <= this.arenaRadius) {
                // 计算玩家和 AI 之间的猎杀方向向量
                const dx = this.player.x - enemy.x;
                const dz = this.player.z - enemy.z;
                const targetDist = Math.sqrt(dx * dx + dz * dz);

                if (targetDist > 1) {
                    enemy.vx += (dx / targetDist) * enemy.speed * deltaTime;
                    enemy.vz += (dz / targetDist) * enemy.speed * deltaTime;
                }
            } else {
                enemy.vy -= 35 * deltaTime; // AI 掉出大操场同样坠落
            }

            enemy.vx *= 0.97;
            enemy.vz *= 0.97;
            enemy.x += enemy.vx * deltaTime;
            enemy.z += enemy.vz * deltaTime;

            let enemySurfaceY = edist <= this.arenaRadius ? -(enemy.x * enemy.x + enemy.z * enemy.z) * 0.00015 + enemy.radius : -99999;
            if (enemy.y > enemySurfaceY) {
                enemy.y += enemy.vy * deltaTime;
            } else {
                enemy.y = enemySurfaceY;
                enemy.vy = 0;
            }

            if (enemy.mesh) {
                enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
                enemy.mesh.rotation.z -= enemy.vx * 0.04;
                enemy.mesh.rotation.x += enemy.vz * 0.04;
            }

            // ==========================================================================
            // 3. 💥 巨球相撞超强动能回弹物理
            // ==========================================================================
            const p_dx = enemy.x - this.player.x;
            const p_dz = enemy.z - this.player.z;
            const p_dist = Math.sqrt(p_dx * p_dx + p_dz * p_dz);
            const minDist = this.player.radius + enemy.radius;

            if (p_dist < minDist) {
                const nx = p_dx / p_dist;
                const nz = p_dz / p_dist;

                const r_vx = this.player.vx - enemy.vx;
                const r_vz = this.player.vz - enemy.vz;
                const velAlongNormal = r_vx * nx + r_vz * nz;

                if (velAlongNormal > 0) {
                    const restitution = 1.4; // 极其凶残的震飞击退系数
                    const impulseScalar = (1 + restitution) * velAlongNormal / 2;

                    this.player.vx -= impulseScalar * nx * 1.6;
                    this.player.vz -= impulseScalar * nz * 1.6;
                    enemy.vx += impulseScalar * nx * 1.6;
                    enemy.vz += impulseScalar * nz * 1.6;
                }
            }
        });

        // 4. 💀 坠落深渊 Game Over 检查
        if (this.player.y < -20) {
            this.isGameOver = true;
            this.gameOverEl.style.display = 'flex';
        }

        // 5. 🎥 追尾相机追踪（完美保留 epicball 极其宏大的广阔视角）
        this.camera.position.set(this.player.x, this.player.y + 12, this.player.z + 28);
        this.camera.lookAt(this.player.x, this.player.y, this.player.z);

        // 渲染画面
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.myMainScene = new MainScene();
