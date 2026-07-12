/**
 * ==========================================================================
 * BallRanger.io - MainScene 3D 核心物理大操场
 * 职责：渲染褐色沙路拼青色草地的超级大盘子、巨大体积球、相机追踪、跌落边缘 Game Over 结算
 * ==========================================================================
 */

class MainScene {
    constructor() {
        this.container = document.getElementById('game-container');
        this.isGameOver = false;

        // 1. 物理世界核心参数（epicball 巨型尺寸）
        this.arenaRadius = 150; // 超级大操场半径 150 米！
        this.player = {
            mesh: null,
            radius: 2,         // 4米直径的巨型球
            x: 0, z: 0,        // 盘面水平坐标
            vx: 0, vz: 0,      // 水平速度
            y: 0, vy: 0,       // 高度与重力速度
            speed: 45,         // 给足推力，在巨型操场里绝不当乌龟
            friction: 0.98     // 丝滑的冰面/沙地惯性滑行感
        };

        this.initThree();
        this.createEpicArena();
        this.createPlayerBall();
        this.createGameOverUI();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        console.log("🏟️ [MainScene] 3D 巨型拼色操场部署完毕！重力与边界杀手已锁定。");
    }

    initThree() {
        // 创建3D场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#0A0A0F'); // 极度深邃的星空太空底色
        this.scene.fog = new THREE.FogExp2('#0A0A0F', 0.003); // 远端迷雾，让操场边缘更神秘

        // 创建透视相机
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

        // 创建高级 WebGL 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // 注入高空战术双光源（主环境光 + 强力太阳聚光灯，照亮褐色沙路）
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
     * 🧱 核心美学：制作一个“中央泥土褐、中间科技青草、外围黄褐色沙路”的巨型大盘子操场
     */
    createEpicArena() {
        // 创建一个分段数极高、极其平滑的圆形巨型平面
        const geometry = new THREE.CircleGeometry(this.arenaRadius, 64);
        
        // 动态修改顶点，使其变成一个中间低、边缘微微翘起的浅“盘子”（防止球太容易滚出去）
        const pos = geometry.attributes.position;
        const colors = [];

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i); // 在 CircleGeometry 中，y 其实代表水平平面的另一轴
            const dist = Math.sqrt(x*x + y*y);

            // 公式：越靠近边缘，盘子微微翘起
            const z = -(x*x + y*y) * 0.00015;
            pos.setZ(i, z);

            // 🎨 重点：根据距离圆心的远近，手工涂刷“褐色”与“青色”拼色路面
            const color = new THREE.Color();
            if (dist < 25) {
                // 1. 最中央区域：深泥土褐色
                color.setStyle('#4A3525');
            } else if (dist >= 25 && dist < 100) {
                // 2. 中间主要奔跑区：科技青绿色草地
                color.setStyle('#00A88F');
            } else {
                // 3. 外围极速赛道：黄褐色沙路赛道 (Sandy Path)
                color.setStyle('#C29B68');
            }
            colors.push(color.r, color.g, color.b);
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        // 采用顶点着色材质（VertexColors），完美呈现褐色与青色相间的操场路面
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.arenaMesh = new THREE.Mesh(geometry, material);
        this.arenaMesh.rotation.x = -Math.PI / 2; // 把圆形立起来平铺成大地
        this.arenaMesh.receiveShadow = true;
        this.scene.add(this.arenaMesh);

        // 在大盘子最外圈的深空里加一圈微弱的发光霓虹警戒线，拉满 io 游戏的高科技感
        const ringGeo = new THREE.RingGeometry(this.arenaRadius - 0.5, this.arenaRadius + 0.5, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: #FF3366, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        this.scene.add(ring);
    }

    /**
     * 🔮 创造玩家巨大球
     */
    createPlayerBall() {
        const geometry = new THREE.SphereGeometry(this.player.radius, 32, 32);
        // 电镀白金发光核心材质
        const material = new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.0
        });

        this.player.mesh = new THREE.Mesh(geometry, material);
        this.player.mesh.castShadow = true;
        this.player.mesh.receiveShadow = true;
        
        // 初始降落高度：稍微悬空掉落到盘子上
        this.player.y = 10;
        this.player.mesh.position.set(0, this.player.y, 0);
        this.scene.add(this.player.mesh);
    }

    /**
     * 💀 动态创建 GAME OVER 战术清算弹窗
     */
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
            window.location.reload(); // 点击直接满血复活刷新网页
        });
    }

    /**
     * ⏱️ 3D 渲染与物理动力引擎核心死循环 (每秒 60 帧精准爆发)
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isGameOver) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const deltaTime = 1 / 60;

        // 1. 抽查并抽离全局 GameUI 的盲操矢量数据
        let inputX = 0;
        let inputZ = 0;
        if (window.myGameUI) {
            const vector = window.myGameUI.getInputVector();
            inputX = vector.x;
            inputZ = vector.y; // 摇杆的y对应3D世界的纵深Z
        }

        // 2. 注入水平移动加速度
        this.player.vx += inputX * this.player.speed * deltaTime;
        this.player.vz += inputZ * this.player.speed * deltaTime;

        // 应用惯性摩擦力
        this.player.vx *= this.player.friction;
        this.player.vz *= this.player.friction;

        // 更新水平位置
        this.player.x += this.player.vx * deltaTime;
        this.player.z += this.player.vz * deltaTime;

        // 3. 计算盘子表面的实时高度（模拟盘子的完美弧度面贴地滚行）
        const currentDist = Math.sqrt(this.player.x * this.player.x + this.player.z * this.player.z);
        let surfaceY = 0;
        
        if (currentDist <= this.arenaRadius) {
            // 球还在大操场内部，应用盘子的斜率高度
            surfaceY = -(this.player.x * this.player.x + this.player.z * this.player.z) * 0.00015 + this.player.radius;
        } else {
            // 🚨 球已经冲出了半径 150 米的大操场边界！凌空断崖！
            surfaceY = -99999;
        }

        // 4. 重力与坠落边缘判定
        if (this.player.y > surfaceY) {
            this.player.vy -= 35 * deltaTime; // 真实物理重力加速度
        } else {
            this.player.y = surfaceY;
            this.player.vy = 0; // 稳稳贴在盘子表面
        }
        this.player.y += this.player.vy * deltaTime;

        // 同步 3D 视觉网格
        if (this.player.mesh) {
            this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
            
            // 逼真细节：让巨大球根据移动速度方向产生滚动的视觉自转效果
            if (Math.abs(this.player.vx) > 0.1 || Math.abs(this.player.vz) > 0.1) {
                this.player.mesh.rotation.z -= this.player.vx * 0.05;
                this.player.mesh.rotation.x += this.player.vz * 0.05;
            }
        }

        // 5. 💀 终极无情审判：坠落深渊 Game Over 检查
        if (this.player.y < -20) {
            this.triggerGameOver();
        }

        // 6. 🎥 追尾相机追踪：营造 epicball 极其宏大的运动空间感
        this.camera.position.set(this.player.x, this.player.y + 12, this.player.z + 28);
        this.camera.lookAt(this.player.x, this.player.y, this.player.z);

        // 渲染当前帧画面
        this.renderer.render(this.scene, this.camera);
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.gameOverEl.style.display = 'flex'; // 瞬间弹出清算大招窗口
        console.log("💀 [Game Over] 司令，球已粉碎坠机，请重新整队再战！");
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 彻底初始化 3D 世界
window.myMainScene = new MainScene();
