/**
 * BallRanger.io - MainScene.js
 * 职责：构建 3D 碗状竞技场、发光网格、动态相机追踪、以及移动端低帧率（FPS）降级反闪退机制
 */

 class MainScene {
    constructor() {
        this.container = document.getElementById('game-canvas-container');
        this.fpsRecords = [];
        this.lastFrameTime = performance.now();
        this.isLowPerformanceMode = false;

        // 核心 3D 数据状态
        this.arenaRadius = 50; 
        this.playerData = {
            mass: 2,
            radius: 1.0,
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0)
        };
        
        this.initEngine();
        this.createLighting();
        this.createArena();
        this.createPlayerMesh();
        
        // 初始化 UI 管理大管家，注入摇杆与技能的回调桥梁
        this.ui = new GameUI(
            (fx, fy) => this.handleJoystickInput(fx, fy),
            (weapon) => this.handleWeaponTrigger(weapon)
        );

        // 【核心修改】启动高频渲染循环，死锁 this 实例防止渲染循环断流
        this.animate.bind(this)();
        
        // 【核心修改】显式使用 .bind(this) 强行绑定当前类实例，彻底绝育移动端 window 的作用域污染
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    // ==========================================
    // 1. WebGL 引擎环境初始化
    initEngine() {
        this.scene = new THREE.Scene();
        // ✅ 改回深灰色星舰虚空背景
        this.scene.background = new THREE.Color(0x0F0F12); 
        this.scene.fog = new THREE.FogExp2(0x0F0F12, 0.015);
        
        // 【核心补全】补全你给的代码里漏掉的相机初始化声明
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // 【核心修改】给相机一个初始的高空后方坐标，防止它在 (0,0,0) 埋在球体内部导致画面全黑
        this.camera.position.set(0, 30, 40); 
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制双倍像素比，防止高分屏 iPad 烧显卡
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // 【核心强灌】直接用内联样式强行锁死 Canvas 的物理高宽，绝不给 Safari 留下一丝坍塌成 0px 的机会
        this.renderer.domElement.style.position = "absolute";
        this.renderer.domElement.style.top = "0";
        this.renderer.domElement.style.left = "0";
        this.renderer.domElement.style.width = "100vw";
        this.renderer.domElement.style.height = "100vh";
        this.renderer.domElement.style.zIndex = "1";
        
        this.container.appendChild(this.renderer.domElement);
    } // 【核心补全】补齐这里漏掉的 initEngine 闭合大括号

    createLighting() {
        // 极光金橘色调的主定向光
        this.dirLight = new THREE.DirectionalLight(0xFF6B00, 0.8);
        this.dirLight.position.set(20, 40, 20);
        this.scene.add(this.dirLight);

        // 顶层蓝紫色环境微光，增强极光玻璃质感
        const hemiLight = new THREE.HemisphereLight(0x4444ff, 0xffaa00, 0.4);
        this.scene.add(hemiLight);
    }

    // ==========================================
    // 2. 3D 碗状竞技场构建 (碗的数学曲面表达)
    // ==========================================
    createArena() {
        // 使用段数足够高的圆形平面模拟碗的底部
        const geometry = new THREE.ParametricGeometry((u, v, target) => {
            const r = u * this.arenaRadius;
            const theta = v * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            
            // 关键碗状数学方程：中心平坦（x^4），越靠近边缘陡峭度呈指数型上升，直接滑入虚空
            const y = Math.pow(r / this.arenaRadius, 4) * 8 - 1; 
            
            target.set(x, y, z);
        }, 40, 40);

        // 【核心修改-自发光测试材质】改成亮绿色自发光线框网格材质，不依赖光照，一渲染立马就能看见大碗
        const material = new THREE.MeshBasicMaterial({
            color: 0x00FF88, 
            wireframe: true
        });
        
        this.arenaMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.arenaMesh);

        // 叠加发光的线框层 (Glowing Gridlines) 增强科幻感
        const wireframeGeom = new THREE.WireframeGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ 
            color: 0xFF6B00, 
            transparent: true, 
            opacity: 0.25 
        });
        this.arenaLines = new THREE.LineSegments(wireframeGeom, lineMat);
        this.scene.add(this.arenaLines);
    }

    createPlayerMesh() {
        // 动态根据半径生成球体
        const geometry = new THREE.SphereGeometry(this.playerData.radius, 32, 32);
        
        // 【核心修改-自发光测试材质】改成不受灯光干扰的纯红色自发光球体，确保开局必亮
        const material = new THREE.MeshBasicMaterial({
            color: 0xFF0000
        });

        this.playerMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.playerMesh);
    }

    // ==========================================
    // 3. 摇杆控制器输入转力矩注入
    // ==========================================
    handleJoystickInput(fx, fy) {
        // 将摇杆的2D输入转换为对应 3D 平面的加速度力
        // 考虑到相机是俯视角度，摇杆的 Y 映射为 3D 的 Z 轴
        const accelerationFactor = 0.15;
        this.playerData.velocity.x += fx * accelerationFactor;
        this.playerData.velocity.z += fy * accelerationFactor;
    }

    handleWeaponTrigger(weaponName) {
        console.log(`[Weapon Callback] Instantiating system logic for: ${weaponName}`);
        // 具体的金币消费扣款与物理护盾渲染，将在接下来的物理/武器文件中处理
    }

    // ==========================================
    // 4. 高频渲染、智能相机缩放与性能安全降级
    // ==========================================
    animate() {
        // 【核心修改】死锁 requestAnimationFrame 的调用上下文，确保每一次循环循环不断流
        requestAnimationFrame(this.animate.bind(this));

        const now = performance.now();
        const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1); // 限制单帧最大时间阻断断层
        this.lastFrameTime = now;

        this.trackFPS(deltaTime);
        this.updatePhysicsSimulation(deltaTime);
        this.updateCameraDynamicZoom();

        // 执行 WebGL 图形渲染
        if (this.scene && this.camera && this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    updatePhysicsSimulation(dt) {
        // 临时的基础惯性衰减，具体的碰撞响应将交由 PhysicsEngine.js
        this.playerData.velocity.x *= 0.98;
        this.playerData.velocity.z *= 0.98;

        this.playerData.position.addScaledVector(this.playerData.velocity, dt * 60);

        // 获取当前位置在碗状竞技场表面的高度 y
        const r = Math.sqrt(this.playerData.position.x * this.playerData.position.x + this.playerData.position.z * this.playerData.position.z);
        if (r < this.arenaRadius) {
            // 根据碗的曲面公式计算物理惯性下滑重力
            const expectedY = Math.pow(r / this.arenaRadius, 4) * 8 - 1;
            this.playerData.position.y = expectedY;

            // 边缘陡峭惯性滑出物理体现
            if (r > this.arenaRadius * 0.7) {
                const slopeForce = Math.pow(r / this.arenaRadius, 3) * 0.2;
                this.playerData.velocity.x += (this.playerData.position.x / r) * slopeForce;
                this.playerData.velocity.z += (this.playerData.position.z / r) * slopeForce;
            }
        } else {
            // 掉出场外重力加速坠落虚空
            this.playerData.position.y -= 9.8 * dt;
        }

        // 同步 3D 网格位置
        if (this.playerMesh) {
            this.playerMesh.position.copy(this.playerData.position);
        }
    }

    updateCameraDynamicZoom() {
        // 相机缩放动态方程：玩家质量（Mass）越大，视角镜头拉得越远，提供完美的战场全局观
        const targetDistance = 25 + (this.playerData.mass * 2.5);
        const targetCameraY = 20 + (this.playerData.mass * 1.8);

        // 使用平滑插值（Lerp）防止相机突变导致眼睛疲劳
        const currentTargetPos = new THREE.Vector3(
            this.playerData.position.x,
            this.playerData.position.y + 2,
            this.playerData.position.z + targetDistance
        );
        
        // 【核心修改】如果相机离目标太近或者处于刚开局状态，直接强制切过去，避免第一帧数学矩阵失效
        if (this.camera.position.lengthSq() < 2000) {
            this.camera.position.copy(currentTargetPos);
            this.camera.position.y = this.playerData.position.y + targetCameraY;
        } else {
            this.camera.position.lerp(currentTargetPos, 0.05);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.playerData.position.y + targetCameraY, 0.05);
        }
        
        this.camera.lookAt(this.playerData.position);
    } // 【核心补全】补齐这里漏掉的 updateCameraDynamicZoom 闭合大括号

    // ==========================================
    // 5. 移动端低帧率自适应防护 (反闪退系统)
    // ==========================================
    trackFPS(dt) {
        const fps = 1 / dt;
        this.fpsRecords.push(fps);
        if (this.fpsRecords.length > 120) this.fpsRecords.shift(); // 仅留最近2秒数据

        // 每隔2秒触发一次健康度评估
        if (this.fpsRecords.length === 120 && !this.isLowPerformanceMode) {
            const avgFps = this.fpsRecords.reduce((a, b) => a + b) / 120;
            if (avgFps < 40) { // 发现移动端帧率低于 40 帧的安全红线
                this.isLowPerformanceMode = true;
                this.downgradeGraphicsEngine();
            }
        }
    }

    downgradeGraphicsEngine() {
        console.warn("[Performance Alert] Low FPS detected on mobile Webkit. Autodowngrading rendering settings to save hardware.");
        this.renderer.setPixelRatio(1); // 强行降低分辨率采样，释放像素填充率压力
        if (this.arenaLines) this.scene.remove(this.arenaLines); // 丢弃线框层渲染
        this.ui.showCenterAlert("PERFORMANCE AUTO-OPTIMIZED FOR FPS ✓");
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 挂载启动主实例（配合降级为标准引入，确保 100% 唤醒）
window.addEventListener('load', () => {
    if (!window.gameScene) {
        window.gameScene = new MainScene();
    }
});
