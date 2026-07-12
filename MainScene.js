/**
 * ==========================================================================
 * BallRanger.io - MainScene 3D 核心世界
 * 职责：渲染真正的青褐双色陡峭大巨碗、吃金币(+5元)、2048融合、撞飞不流血、跌落死刑
 * ==========================================================================
 */

class MainScene {
    constructor() {
        this.container = document.getElementById('game-container');
        this.isGameOver = false;
        this.gameStarted = false;

        // 1. 3D 巨碗核心数据
        this.arenaRadius = 150; 
        
        // 玩家巨球
        this.player = {
            mesh: null, textMesh: null, radius: 2.0, number: 2,
            x: 0, z: 0, vx: 0, vz: 0, y: 50, vy: 0,
            speed: 50, friction: 0.98
        };

        // 🤖 3个疯狂 AI 敌方球
        this.enemies = [
            { id: 1, mesh: null, textMesh: null, radius: 2.0, number: 2, x: -35, z: -35, vx: 0, vz: 0, y: 5, vy: 0, speed: 28 },
            { id: 2, mesh: null, textMesh: null, radius: 2.8, number: 4, x: 45, z: -50, vx: 0, vz: 0, y: 5, vy: 0, speed: 24 },
            { id: 3, mesh: null, textMesh: null, radius: 3.6, number: 8, x: -10, z: -70, vx: 0, vz: 0, y: 5, vy: 0, speed: 20 }
        ];

        // 💰 散落的金币池
        this.coinsPool = [];

        this.initThree();
        this.createMegaBowl();      // 创造完美的青褐交织陡峭巨碗
        this.createCoinItems();     // 撒落发光金币
        this.createGameOverUI();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#06060A');
        this.scene.fog = new THREE.FogExp2('#06060A', 0.003);

        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // 高空环形战术照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffe0b2, 1.3);
        sunLight.position.set(100, 200, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        this.scene.add(sunLight);
    }

    /**
     * 🧱 绝美核心：利用同心圆划分，打造真正的“中央褐色平原、中间青色草场、边缘陡峭黄褐色碗壁”
     */
    createMegaBowl() {
        // 为了打破CircleGeometry平涂串色，我们通过多层分段，精雕细琢拼色高次幂巨碗
        const segments = 64;
        const bowlGeo = new THREE.Geometry();

        // 顶点生成：应用高次幂函数 Z = (Radius^4) * 展现陡峭的 U 型池碗壁
        for (let r = 0; r <= this.arenaRadius; r += 5) {
            for (let s = 0; s < segments; s++) {
                const theta = (s / segments) * Math.PI * 2;
                const x = r * Math.cos(theta);
                const y = r * Math.sin(theta);
                
                // 🔥 陡峭巨碗深度方程：靠近边缘呈指数级疯狂拉高！
                const z = Math.pow(r / this.arenaRadius, 4) * 35; 

                bowlGeo.vertices.push(new THREE.Vector3(x, y, z));
            }
        }

        // 面与色彩合成拼贴
        for (let r = 0; r < this.arenaRadius / 5; r++) {
            for (let s = 0; s < segments; s++) {
                const v1 = r * segments + s;
                const v2 = r * segments + ((s + 1) % segments);
                const v3 = (r + 1) * segments + s;
                const v4 = (r + 1) * segments + ((s + 1) % segments);

                const face1 = new THREE.Face3(v1, v2, v3);
                const face2 = new THREE.Face3(v2, v4, v3);

                // 🎨 核心拼色：双色交织，严禁任何串色
                const currentDist = r * 5;
                let zoneColor = new THREE.Color();
                if (currentDist < 30) {
                    zoneColor.setStyle('#4A3525'); // 1. 碗底中心：泥土褐色
                } else if (currentDist >= 30 && currentDist < 110) {
                    zoneColor.setStyle('#00A88F'); // 2. 碗身跨度：赛博高能青绿色
                } else {
                    zoneColor.setStyle('#C29B68'); // 3. 陡峭碗壁：黄褐色沙路赛道
                }

                face1.color = zoneColor;
                face2.color = zoneColor;

                bowlGeo.faces.push(face1, face2);
            }
        }

        bowlGeo.computeVertexNormals();
        const bowlMat = new THREE.MeshStandardMaterial({
            vertexColors: THREE.FaceColors, roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide
        });

        this.bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
        this.bowlMesh.rotation.x = -Math.PI / 2; // 放平
        this.bowlMesh.receiveShadow = true;
        this.scene.add(this.bowlMesh);

        // 碗口红色霓虹死刑警戒线
        const ringGeo = new THREE.RingGeometry(this.arenaRadius - 0.5, this.arenaRadius + 0.5, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: '#FF3366', side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 35.1; // 处于碗的最顶端
        this.scene.add(ring);
    }

    /**
     * 💰 洒下金币（吃一个拿5块钱）
     */
    createCoinItems() {
        const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16);
        const coinMat = new THREE.MeshStandardMaterial({ color: '#FFB300', metalness: 0.9, roughness: 0.1 });

        for (let i = 0; i < 40; i++) {
            const coin = new THREE.Mesh(coinGeo, coinMat);
            // 随机铺在青色草地和中心褐色平原上
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 85;
            const cx = dist * Math.cos(angle);
            const cz = dist * Math.sin(angle);
            
            // 基于碗底高度贴地放置
            const cy = Math.pow(dist / this.arenaRadius, 4) * 35 + 0.5;

            coin.position.set(cx, cy, cz);
            coin.rotation.x = Math.PI / 2;
            this.scene.add(coin);
            this.coinsPool.push(coin);
        }
    }

    /**
     * 🏰 激活并生成玩家白金巨球
     */
    spawnPlayer() {
        if (window.myGameUI) {
            this.player.number = window.myGameUI.playerNumber; // 同步大厅广告变大数字
        }
        this.player.radius = 1.4 + Math.log2(this.player.number) * 0.4; // 数字越大体积越臃肿

        const geometry = new THREE.SphereGeometry(this.player.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.85, roughness: 0.1 });
        
        this.player.mesh = new THREE.Mesh(geometry, material);
        this.player.mesh.castShadow = true;
        this.player.mesh.position.set(0, this.player.y, 0);
        this.scene.add(this.player.mesh);

        this.spawnEnemyBalls(); // 投放AI敌军
        this.gameStarted = true;
    }

    /**
     * 👑 同步大厅看广告带来的体积瞬间剧烈膨胀视觉
     */
    syncPlayerSizeByNumber() {
        if (!window.myGameUI) return;
        const num = window.myGameUI.playerNumber;
        this.player.number = num;
        this.player.radius = 1.4 + Math.log2(num) * 0.4;
    }

    spawnEnemyBalls() {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: '#CC2222', metalness: 0.7, roughness: 0.2 });

        this.enemies.forEach(enemy => {
            const mesh = new THREE.Mesh(geometry, material);
            enemy.radius = 1.4 + Math.log2(enemy.number) * 0.4;
            mesh.scale.setScalar(enemy.radius);
            mesh.castShadow = true;
            mesh.position.set(enemy.x, 5, enemy.z);
            this.scene.add(mesh);
            enemy.mesh = mesh;
        });
    }

    createGameOverUI() {
        this.gameOverEl = document.createElement('div');
        this.gameOverEl.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(18, 5, 10, 0.9); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            display: none; flex-direction: column; align-items: center; justify-content: center;
            z-index: 99999; color: #FFFFFF; font-family: sans-serif;
        `;
        this.gameOverEl.innerHTML = `
            <h1 style="font-size: 50px; color: #FF3366; text-shadow: 0 0 25px rgba(255,51,102,0.6); margin-bottom: 5px; font-weight:900;">GAME OVER</h1>
            <p style="color: rgba(255,255,255,0.6); font-size: 16px; margin-bottom: 30px;">YOU FELL INTO THE SPACE ABYSS!</p>
            <button id="btn-respawn" style="
                padding: 14px 40px; font-size: 18px; font-weight: bold; background: #FF3366;
                border: none; border-radius: 10px; color: white; cursor: pointer; box-shadow: 0 6px 20px rgba(255,51,102,0.4);
            ">RESPAWN</button>
        `;
        document.body.appendChild(this.gameOverEl);
        document.getElementById('btn-respawn').addEventListener('click', () => window.location.reload());
    }

    /**
     * ⏱️ 60帧物理与碰撞死刑引擎
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.isGameOver) return;

        const deltaTime = 1 / 60;

        // 金币华丽原地旋转视觉
        this.coinsPool.forEach(c => c.rotation.z += 0.02);

        if (!this.gameStarted) {
            // 开局前，相机绕场展示美轮美奂的巨碗全貌
            const timer = Date.now() * 0.0003;
            this.camera.position.set(Math.cos(timer) * 90, 45, Math.sin(timer) * 90);
            this.camera.lookAt(0, 10, 0);
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // ==========================================================================
        // 1. 玩家全屏盲操物理推进
        // ==========================================================================
        let inputX = 0, inputZ = 0;
        if (window.myGameUI) {
            const vector = window.myGameUI.getInputVector();
            inputX = vector.x; inputZ = vector.y;
        }
        this.player.vx += inputX * this.player.speed * deltaTime;
        this.player.vz += inputZ * this.player.speed * deltaTime;
        this.player.vx *= this.player.friction;
        this.player.vz *= this.player.friction;
        this.player.x += this.player.vx * deltaTime;
        this.player.z += this.player.vz * deltaTime;

        // 计算当前碗面的真实垂直高度
        const playerDist = Math.sqrt(this.player.x * this.player.x + this.player.z * this.player.z);
        let playerBowlY = playerDist <= this.arenaRadius ? Math.pow(playerDist / this.arenaRadius, 4) * 35 + this.player.radius : -999;

        if (this.player.y > playerBowlY) this.player.vy -= 40 * deltaTime; // 重力砸落
        else { this.player.y = playerBowlY; this.player.vy = 0; }
        this.player.y += this.player.vy * deltaTime;

        if (this.player.mesh) {
            this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
            this.player.mesh.rotation.z -= this.player.vx * 0.04;
            this.player.mesh.rotation.x += this.player.vz * 0.04;
        }

        // 🪙 局内吃金币判定 (吃一个拿5块钱)
        for (let i = this.coinsPool.length - 1; i >= 0; i--) {
            const coin = this.coinsPool[i];
            const p_c_dist = this.player.mesh.position.distanceTo(coin.position);
            if (p_c_dist < this.player.radius + 1.2) {
                this.scene.remove(coin);
                this.coinsPool.splice(i, 1);
                if (window.myGameUI) window.myGameUI.addCoin(); // 稳稳存入5块钱
            }
        }

        // ==========================================================================
        // 2. 🦾 AI 猎杀更新与重力控制
        // ==========================================================================
        this.enemies.forEach(enemy => {
            if (!enemy.mesh) return;
            const edist = Math.sqrt(enemy.x * enemy.x + enemy.z * enemy.z);

            if (edist <= this.arenaRadius) {
                const dx = this.player.x - enemy.x;
                const dz = this.player.z - enemy.z;
                const tDist = Math.sqrt(dx*dx + dz*dz);
                if (tDist > 1) {
                    enemy.vx += (dx / tDist) * enemy.speed * deltaTime;
                    enemy.vz += (dz / tDist) * enemy.speed * deltaTime;
                }
            } else {
                enemy.vy -= 40 * deltaTime; // 掉出碗也得死
            }

            enemy.vx *= 0.97; enemy.vz *= 0.97;
            enemy.x += enemy.vx * deltaTime; enemy.z += enemy.vz * deltaTime;

            let enemyBowlY = edist <= this.arenaRadius ? Math.pow(edist / this.arenaRadius, 4) * 35 + enemy.radius : -999;
            if (enemy.y > enemyBowlY) enemy.y += enemy.vy * deltaTime;
            else { enemy.y = enemyBowlY; enemy.vy = 0; }
            enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);

            // ==========================================================================
            // 3. 💥 核心：2048 弱肉强食碰撞机（玩家被撞绝对不死，只会被狠狠弹飞！）
            // ==========================================================================
            const p_e_dx = enemy.x - this.player.x;
            const p_e_dz = enemy.z - this.player.z;
            const p_e_dist = Math.sqrt(p_e_dx*p_e_dx + p_e_dz*p_e_dz);
            const minDist = this.player.radius + enemy.radius;

            if (p_e_dist < minDist) {
                const nx = p_e_dx / p_e_dist;
                const nz = p_e_dz / p_e_dist;
                const r_vx = this.player.vx - enemy.vx;
                const r_vz = this.player.vz - enemy.vz;
                const velNormal = r_vx * nx + r_vz * nz;

                if (velNormal > 0) {
                    // 情况 A & B：玩家大或相等 -> 毁灭吞噬/升级
                    if (this.player.number >= enemy.number) {
                        if (this.player.number === enemy.number) {
                            if (window.myGameUI) window.myGameUI.upgradeNumber(); // 2撞2融合变4
                            this.player.number *= 2;
                        }
                        // 掠夺AI金币
                        if (window.myGameUI) { window.myGameUI.addCoin(); window.myGameUI.addCoin(); }
                        
                        // 抹杀AI球，在碗底深处重新投胎
                        enemy.x = (Math.random() - 0.5) * 60;
                        enemy.z = (Math.random() - 0.5) * 60;
                        enemy.vx = 0; enemy.vz = 0;
                        
                        this.syncPlayerSizeByNumber(); // 升级后体积瞬间膨胀
                        if (this.player.mesh) {
                            this.scene.remove(this.player.mesh);
                            this.player.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.player.radius, 32, 32), new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.85, roughness: 0.1 }));
                            this.scene.add(this.player.mesh);
                        }
                        if (window.myGameUI) window.myGameUI.showAlert("BOOM! YOU CONSUMED THE ENEMY BALL!");
                    } 
                    // 情况 C：💥 玩家不比它大 -> 触发超强击退！玩家绝不掉血，只会被狂暴弹飞！
                    else {
                        const restitution = 1.4; // 1.4倍劲爆弹射
                        const impulse = (1 + restitution) * velNormal / 2;

                        // 瞬间把玩家像炮弹一样弹飞上黄褐色沙路碗壁
                        this.player.vx -= impulse * nx * 2.2;
                        this.player.vz -= impulse * nz * 2.2;
                        enemy.vx += impulse * nx * 1.2;
                        enemy.vz += impulse * nz * 1.2;
                        
                        if (window.myGameUI) window.myGameUI.showAlert("WARNING! YOU WERE KNOCKED BACK BY A MIGHTY ENEMY!");
                    }
                }
            }
        });

        // ==========================================================================
        // 4. 💀 死亡深渊绝情判定（只有彻底跌出巨碗高度小于 -15 米才判死刑！）
        // ==========================================================================
        if (this.player.y < -15) {
            this.isGameOver = true;
            this.gameOverEl.style.display = 'flex'; // 血红面板占领全屏
        }

        // 5. 相机平滑追尾
        this.camera.position.set(this.player.x, this.player.y + 14, this.player.z + 32);
        this.camera.lookAt(this.player.x, this.player.y, this.player.z);

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.myMainScene = new MainScene();
