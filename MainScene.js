/**
 * ==========================================================================
 * MainScene.js - 3D 巨碗乱斗物理动力学与联机排位核心
 * 备注：管理真实联机行为模拟、高自由度 AI 抢金币大战、击退弹飞及排行榜数据同步
 * ==========================================================================
 */
class MainScene {
    constructor() {
        this.container = document.getElementById('game-container');
        this.isActive = false;
        this.isGameOver = false;

        this.bowlRadius = 150; 
        
        // 玩家实体定义
        this.player = {
            name: "YOU (Ranger)", isPlayer: true,
            mesh: null, radius: 2.0, number: 2,
            x: 0, y: 50, z: 0, vx: 0, vy: 0, vz: 0,
            speed: 55, friction: 0.98
        };

        // 🤖 具备独立人格与拟真名字的群雄乱斗 AI / 真实玩家对抗阵列
        this.enemies = [
            { name: "Ranger_ProX", mesh: null, radius: 2.0, number: 2, x: -40, y: 5, z: -40, vx: 0, vy: 0, vz: 0, speed: 28, targetCoin: null },
            { name: "Alpha_Mega", mesh: null, radius: 2.8, number: 4, x: 50, y: 5, z: -30, vx: 0, vy: 0, vz: 0, speed: 24, targetCoin: null },
            { name: "Shadow_Runner", mesh: null, radius: 3.6, number: 8, x: -20, y: 5, z: -60, vx: 0, vy: 0, vz: 0, speed: 20, targetCoin: null },
            { name: "Omega_Strike", mesh: null, radius: 2.0, number: 2, x: 30, y: 5, z: 40, vx: 0, vy: 0, vz: 0, speed: 26, targetCoin: null }
        ];

        this.goldCoins = []; 

        this.initEngine();
        this.build3DBowl();     
        this.dropGoldCoins();   
        this.createGameOverUI();
        this.runLoop();
    }

    initEngine() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#050508');
        
        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        dirLight.position.set(80, 180, 40);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    build3DBowl() {
        const segments = 64;
        const geometry = new THREE.Geometry();

        for (let r = 0; r <= this.bowlRadius; r += 5) {
            for (let s = 0; s < segments; s++) {
                const angle = (s / segments) * Math.PI * 2;
                const x = r * Math.cos(angle);
                const z = r * Math.sin(angle);
                const y = Math.pow(r / this.bowlRadius, 4) * 36; 
                geometry.vertices.push(new THREE.Vector3(x, y, z));
            }
        }

        for (let r = 0; r < this.bowlRadius / 5; r++) {
            for (let s = 0; s < segments; s++) {
                const i1 = r * segments + s;
                const i2 = r * segments + ((s + 1) % segments);
                const i3 = (r + 1) * segments + s;
                const i4 = (r + 1) * segments + ((s + 1) % segments);

                const face1 = new THREE.Face3(i1, i2, i3);
                const face2 = new THREE.Face3(i2, i4, i3);

                const currentRadius = r * 5;
                const faceColor = new THREE.Color();
                
                if (currentRadius < 30) {
                    faceColor.setStyle('#4A321A'); 
                } else if (currentRadius >= 30 && currentRadius < 110) {
                    faceColor.setStyle('#00B392'); 
                } else {
                    faceColor.setStyle('#CBB089'); 
                }

                face1.color = faceColor;
                face2.color = faceColor;
                geometry.faces.push(face1, face2);
            }
        }

        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
            vertexColors: THREE.FaceColors, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide
        });

        this.bowlMesh = new THREE.Mesh(geometry, material);
        this.bowlMesh.receiveShadow = true;
        this.scene.add(this.bowlMesh);

        const borderGeo = new THREE.RingGeometry(this.bowlRadius - 0.4, this.bowlRadius + 0.4, 64);
        const borderMat = new THREE.MeshBasicMaterial({ color: '#FF2A5F', side: THREE.DoubleSide });
        const borderRing = new THREE.Mesh(borderGeo, borderMat);
        borderRing.rotation.x = -Math.PI / 2;
        borderRing.position.y = 36.05;
        this.scene.add(borderRing);
    }

    dropGoldCoins() {
        const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16);
        const coinMat = new THREE.MeshStandardMaterial({ color: '#FFB300', metalness: 0.9, roughness: 0.1 });

        for (let i = 0; i < 50; i++) {
            const coin = new THREE.Mesh(coinGeo, coinMat);
            const ang = Math.random() * Math.PI * 2;
            const radiusDist = 10 + Math.random() * 95; 
            const cx = radiusDist * Math.cos(ang);
            const cz = radiusDist * Math.sin(ang);
            const cy = Math.pow(radiusDist / this.bowlRadius, 4) * 36 + 0.4; 

            coin.position.set(cx, cy, cz);
            coin.rotation.x = Math.PI / 2;
            this.scene.add(coin);
            this.goldCoins.push(coin);
        }
    }

    activateArena() {
        if (window.myGameUI) this.player.number = window.myGameUI.playerNumber;
        this.syncPlayerRadius();

        const geometry = new THREE.SphereGeometry(this.player.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.85, roughness: 0.15 });
        this.player.mesh = new THREE.Mesh(geometry, material);
        this.player.mesh.castShadow = true;
        this.player.mesh.position.set(0, this.player.y, 0);
        this.scene.add(this.player.mesh);

        const aiGeo = new THREE.SphereGeometry(1, 32, 32);
        const aiMat = new THREE.MeshStandardMaterial({ color: '#D62246', metalness: 0.7, roughness: 0.2 });
        this.enemies.forEach(enemy => {
            const mesh = new THREE.Mesh(aiGeo, aiMat);
            enemy.radius = 1.4 + Math.log2(enemy.number) * 0.4;
            mesh.scale.setScalar(enemy.radius);
            mesh.castShadow = true;
            mesh.position.set(enemy.x, 5, enemy.z);
            this.scene.add(mesh);
            enemy.mesh = mesh;
        });

        this.isActive = true;
    }

    syncPlayerRadius() {
        this.player.radius = 1.4 + Math.log2(this.player.number) * 0.4;
    }

    createGameOverUI() {
        this.overPanel = document.createElement('div');
        this.overPanel.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(20, 6, 12, 0.95); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 99999; color: #FFF;
        `;
        this.overPanel.innerHTML = `
            <h1 style="font-size: 55px; color: #FF3366; text-shadow: 0 0 25px rgba(255,51,102,0.5); font-weight:900; margin:0;">GAME OVER</h1>
            <p style="color: #888; font-size: 15px; margin: 10px 0 35px 0;">YOU FELL OUT OF THE BOWL ARENA BOUNDARY!</p>
            <button id="btn-respawn" style="
                padding: 15px 45px; font-size: 18px; font-weight: bold; background: #FF3366;
                border: none; border-radius: 12px; color: white; cursor: pointer; box-shadow: 0 6px 20px rgba(255,51,102,0.4);
            ">RESPAWN</button>
        `;
        document.body.appendChild(this.overPanel);
        document.getElementById('btn-respawn').addEventListener('click', () => window.location.reload());
    }

    runLoop() {
        requestAnimationFrame(() => this.runLoop());
        if (this.isGameOver) return;

        const dt = 1 / 60;

        this.goldCoins.forEach(coin => coin.rotation.z += 0.02);

        if (!this.isActive) {
            const time = Date.now() * 0.0003;
            this.camera.position.set(Math.cos(time) * 100, 50, Math.sin(time) * 100);
            this.camera.lookAt(0, 15, 0);
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // ==========================================================================
        // 1. 玩家物理引擎操控与吃金币
        // ==========================================================================
        let moveX = 0, moveZ = 0;
        if (window.myGameUI) {
            const v = window.myGameUI.getInputVector();
            moveX = v.x; moveZ = v.y;
        }
        this.player.vx += moveX * this.player.speed * dt;
        this.player.vz += moveZ * this.player.speed * dt;
        this.player.vx *= this.player.friction;
        this.player.vz *= this.player.friction;
        this.player.x += this.player.vx * dt;
        this.player.z += this.player.vz * dt;

        const pDist = Math.sqrt(this.player.x*this.player.x + this.player.z*this.player.z);
        let pBowlY = pDist <= this.bowlRadius ? Math.pow(pDist / this.bowlRadius, 4) * 36 + this.player.radius : -999;

        if (this.player.y > pBowlY) this.player.vy -= 42 * dt; 
        else { this.player.y = pBowlY; this.player.vy = 0; }
        this.player.y += this.player.vy * dt;

        if (this.player.mesh) {
            this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
            this.player.mesh.rotation.z -= this.player.vx * 0.03;
            this.player.mesh.rotation.x += this.player.vz * 0.03;
        }

        for (let i = this.goldCoins.length - 1; i >= 0; i--) {
            const coin = this.goldCoins[i];
            if (this.player.mesh.position.distanceTo(coin.position) < this.player.radius + 1.2) {
                this.scene.remove(coin);
                this.goldCoins.splice(i, 1);
                if (window.myGameUI) window.myGameUI.addCoin(); 
            }
        }

        // ==========================================================================
        // 2. 真实大乱斗模拟：AI 智能锁定并抢夺金币，实现自主进化
        // ==========================================================================
        this.enemies.forEach(enemy => {
            if (!enemy.mesh) return;
            const eDist = Math.sqrt(enemy.x*enemy.x + enemy.z*enemy.z);

            if (eDist <= this.bowlRadius) {
                // AI 战术核心：如果场上有金币，疯狂去抢最近的金币
                if (this.goldCoins.length > 0) {
                    let nearestCoin = null;
                    let minDist = 99999;
                    this.goldCoins.forEach(c => {
                        let d = c.position.distanceTo(enemy.mesh.position);
                        if (d < minDist) { minDist = d; nearestCoin = c; }
                    });
                    
                    if (nearestCoin) {
                        const tX = nearestCoin.position.x - enemy.x;
                        const tZ = nearestCoin.position.z - enemy.z;
                        const tLen = Math.sqrt(tX*tX + tZ*tZ);
                        if (tLen > 0.5) {
                            enemy.vx += (tX / tLen) * enemy.speed * dt;
                            enemy.vz += (tZ / tLen) * enemy.speed * dt;
                        }
                    }
                } else {
                    // 没有金币时，追赶玩家
                    const dx = this.player.x - enemy.x;
                    const dz = this.player.z - enemy.z;
                    const targetD = Math.sqrt(dx*dx + dz*dz);
                    if (targetD > 1) {
                        enemy.vx += (dx / targetD) * enemy.speed * dt;
                        enemy.vz += (dz / targetD) * enemy.speed * dt;
                    }
                }
            } else {
                enemy.vy -= 42 * dt;
            }

            enemy.vx *= 0.95; enemy.vz *= 0.95;
            enemy.x += enemy.vx * dt; enemy.z += enemy.vz * dt;

            let eBowlY = eDist <= this.bowlRadius ? Math.pow(eDist / this.bowlRadius, 4) * 36 + enemy.radius : -999;
            if (enemy.y > eBowlY) enemy.y += enemy.vy * dt;
            else { enemy.y = eBowlY; enemy.vy = 0; }
            enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);

            // AI 吞噬金币判定
            for (let i = this.goldCoins.length - 1; i >= 0; i--) {
                const coin = this.goldCoins[i];
                if (enemy.mesh.position.distanceTo(coin.position) < enemy.radius + 1.2) {
                    this.scene.remove(coin);
                    this.goldCoins.splice(i, 1);
                    // AI 累计积分触发升级机制
                    if (Math.random() < 0.25) { 
                        enemy.number *= 2; 
                        enemy.radius = 1.4 + Math.log2(enemy.number) * 0.4;
                        enemy.mesh.scale.setScalar(enemy.radius);
                    }
                }
            }

            // ==========================================================================
            // 3. 乱斗对撞物理：玩家撞飞弱者并吞噬，或被强者狠狠震飞弹射
            // ==========================================================================
            const p_e_dx = enemy.x - this.player.x;
            const p_e_dz = enemy.z - this.player.z;
            const p_e_dist = Math.sqrt(p_e_dx*p_e_dx + p_e_dz*p_e_dz);
            const combatDist = this.player.radius + enemy.radius;

            if (p_e_dist < combatDist) {
                const nx = p_e_dx / p_e_dist;
                const nz = p_e_dz / p_e_dist;
                const relVx = this.player.vx - enemy.vx;
                const relVz = this.player.vz - enemy.vz;
                const normalVel = relVx * nx + relVz * nz;

                if (normalVel > 0) {
                    if (this.player.number >= enemy.number) {
                        if (this.player.number === enemy.number) {
                            if (window.myGameUI) window.myGameUI.triggerMerge(); 
                            this.player.number *= 2;
                        }
                        if (window.myGameUI) { window.myGameUI.addCoin(); window.myGameUI.addCoin(); }
                        
                        // 被淘汰后，在中央安全区以初始状态复活（模拟新玩家连入）
                        enemy.x = (Math.random() - 0.5) * 40;
                        enemy.z = (Math.random() - 0.5) * 40;
                        enemy.vx = 0; enemy.vz = 0;
                        enemy.number = 2;
                        enemy.radius = 1.4 + Math.log2(enemy.number) * 0.4;
                        enemy.mesh.scale.setScalar(enemy.radius);
                        
                        this.syncPlayerRadius();
                        if (this.player.mesh) {
                            this.scene.remove(this.player.mesh);
                            this.player.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.player.radius, 32, 32), new THREE.MeshStandardMaterial({ color: '#FFFFFF', metalness: 0.85, roughness: 0.15 }));
                            this.scene.add(this.player.mesh);
                        }
                        if (window.myGameUI) window.myGameUI.showAlert("BOOM! ENEMY ELIMINATED!");
                    } else {
                        // 撞不过强敌，触发 1.4 倍物理震飞强力弹射！
                        const impulse = (1 + 1.4) * normalVel / 2;
                        this.player.vx -= impulse * nx * 2.5;
                        this.player.vz -= impulse * nz * 2.5;
                        enemy.vx += impulse * nx * 1.0;
                        enemy.vz += impulse * nz * 1.0;
                        
                        if (window.myGameUI) window.myGameUI.showAlert("WARNING! KNOCKED BACK!");
                    }
                }
            }
        });

        // AI 之间互相吞噬乱斗模拟
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                let e1 = this.enemies[i];
                let e2 = this.enemies[j];
                let dist = Math.sqrt(Math.pow(e1.x - e2.x, 2) + Math.pow(e1.z - e2.z, 2));
                if (dist < (e1.radius + e2.radius)) {
                    if (e1.number >= e2.number) {
                        e1.number *= 2; e1.radius = 1.4 + Math.log2(e1.number) * 0.4; e1.mesh.scale.setScalar(e1.radius);
                        e2.x = (Math.random() - 0.5) * 40; e2.z = (Math.random() - 0.5) * 40; e2.number = 2; e2.radius = 1.4; e2.mesh.scale.setScalar(1.4);
                    } else {
                        e2.number *= 2; e2.radius = 1.4 + Math.log2(e2.number) * 0.4; e2.mesh.scale.setScalar(e2.radius);
                        e1.x = (Math.random() - 0.5) * 40; e1.z = (Math.random() - 0.5) * 40; e1.number = 2; e1.radius = 1.4; e1.mesh.scale.setScalar(1.4);
                    }
                }
            }
        }

        // ==========================================================================
        // 4. 数据完全同步：打包所有线上战力，每帧强刷局内动态排行榜
        // ==========================================================================
        if (window.myGameUI) {
            const allEntities = [
                { name: this.player.name, number: this.player.number, isPlayer: true },
                ...this.enemies.map(e => ({ name: e.name, number: e.number, isPlayer: false }))
            ];
            window.myGameUI.updateLeaderboard(allEntities);
        }

        // 出界坠毁判定
        if (this.player.y < -15) {
            this.isGameOver = true;
            this.overPanel.style.display = 'flex';
        }

        this.camera.position.set(this.player.x, this.player.y + 15, this.player.z + 32);
        this.camera.lookAt(this.player.x, this.player.y, this.player.z);

        this.renderer.render(this.scene, this.camera);
    }
}

window.myMainScene = new MainScene();
