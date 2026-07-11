/**
 * ==========================================================================
 * BallRanger.io - 3D 核心渲染、手搓刚体物理与 AI 乱斗引擎 (iPad 60FPS 满帧版)
 * ==========================================================================
 */

export class Game3D {
    constructor() {
        // --- 1. 3D 舞台三大件 ---
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // --- 2. 战场物理参数 ---
        this.arenaRadius = 15; // 圆形决斗场半径
        this.friction = 0.98;   // 模拟地面微弱摩擦阻力
        this.baseSpeed = 0.2;   // 基础推力速率

        // --- 3. 5 人大乱斗角色账本 (玩家 + 4个AI) ---
        // 随时可将 AI 逻辑平替为 Firebase 实时玩家同步数据
        this.actors = [];
        this.playerActor = null;

        // --- 4. 武器爆发状态标记 ---
        this.dashActive = false;
        this.dashTimer = 0;

        this.initEngine();
        this.buildArena();
        this.spawnActors();
        this.linkToControlEngine();
        this.loop();
    }

    /**
     * 初始化 Three.js 视口与抗锯齿硬件加速
     */
    initEngine() {
        const container = document.getElementById('three-canvas-container');
        if (!container) return;

        // 创建场景与斜45度上帝视角相机
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1d); // 深邃赛博夜空黑

        this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 18, 14); // 悬空高处俯瞰
        this.camera.lookAt(0, 0, -2);

        // 初始化渲染器，开启 iPad Retina 屏幕视网膜抗锯齿
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // 部署环境光与高光直射灯，勾勒球体金属刚体质感
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 20, 5);
        this.scene.add(dirLight);

        // 监听 iPad 屏幕旋转横竖屏自适应
        window.addEventListener('resize', () => {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    /**
     * 建造圆形霓虹决斗场
     */
    buildArena() {
        // 地盘：圆形磨砂晶体格栅
        const floorGeo = new THREE.CircleGeometry(this.arenaRadius, 64);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0x111625, 
            roughness: 0.4, 
            metalness: 0.8,
            side: THREE.DoubleSide 
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = Math.PI / 2; // 放平
        this.scene.add(floor);

        // 边缘护栏：高亮霓虹电子墙
        const wallGeo = new THREE.RingGeometry(this.arenaRadius - 0.1, this.arenaRadius + 0.1, 64);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.rotation.x = Math.PI / 2;
        wall.position.y = 0.05; // 微微悬空防闪烁
        this.scene.add(wall);
    }

    /**
     * 生成 5 人大乱斗阵营 (1玩家 + 4智能机器人)
     */
    spawnActors() {
        const colors = [0xff3366, 0x3399ff, 0xffcc00, 0x99ff33, 0xcc33ff];
        const names = ["YOU (Ranger)", "AI_Alpha", "AI_Beta", "AI_Gamma", "AI_Omega"];

        for (let i = 0; i < 5; i++) {
            const isPlayer = (i === 0);
            const baseRadius = isPlayer ? 0.8 : 0.7; // 玩家初始体积略大一点点

            // 几何体与材质封装
            const geo = new THREE.SphereGeometry(baseRadius, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: colors[i],
                roughness: 0.1,
                metalness: 0.9 // 爆表金属反射质感
            });
            const mesh = new THREE.Mesh(geo, mat);

            // 随机星罗棋布散开在场内，绝不重叠
            const angle = (i / 5) * Math.PI * 2;
            const spawnDist = 6 + Math.random() * 3;
            mesh.position.set(Math.cos(angle) * spawnDist, baseRadius, Math.sin(angle) * spawnDist);
            this.scene.add(mesh);

            // 构建核心物理账本对象
            const actor = {
                id: i,
                name: names[i],
                isPlayer: isPlayer,
                mesh: mesh,
                radius: baseRadius,
                mass: baseRadius * baseRadius, // 质量与半径平方挂钩（体积越大，惯性越恐怖，撞人越飞）
                vx: 0, // X轴瞬时速度
                vz: 0, // Z轴瞬时速度
                inputX: 0, // 操控输入力
                inputZ: 0,
                score: 0,
                isDead: false
            };

            this.actors.push(actor);
            if (isPlayer) this.playerActor = actor;
        }
    }

    /**
     * 🔌 核心咬合齿轮：将第二层 GameUI.js 的触控力矩无缝接入 3D 动力学
     */
    linkToControlEngine() {
        if (!window.gameUI) {
            // 如果还没加载完，100ms 后再次尝试咬合
            setTimeout(() => this.linkToControlEngine(), 100);
            return;
        }

        const ui = window.gameUI;

        // A. 响应大厅 START 按钮：提取看广告翻倍后的终极体积，重塑玩家 3D 刚体！
        ui.onGameStartLaunchCallback = (multiplier) => {
            // 理论体积计算公式：根据广告倍率放大半径
            const scaleFactor = 1 + (multiplier - 1) * 0.15; // 10倍广告对应 2.35 倍巨型球
            this.playerActor.radius = 0.8 * scaleFactor;
            this.playerActor.mass = this.playerActor.radius * this.playerActor.radius;
            
            // 实体 3D 网格视觉放大
            this.playerActor.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
            this.playerActor.mesh.position.y = this.playerActor.radius; // 严防陷进地板
        };

        // B. 响应 iPad 左手虚拟摇杆：实时传送水平与纵深推力
        ui.onJoystickMoveCallback = (mx, mz) => {
            if (this.playerActor.isDead) return;
            this.playerActor.inputX = mx;
            this.playerActor.inputZ = mz;
        };

        // C. 响应局内 DASH 冲刺按钮
        ui.onDashTriggerCallback = () => {
            if (this.playerActor.isDead || this.dashActive) return;
            this.dashActive = true;
            this.dashTimer = 25; // 强力爆发持续 25 帧
            // 产生高阶屏幕震动提示 UI
            window.gameUI.triggerCenterAlert("DASH BURST!!!");
        };

        // D. 响应武器释放（此处预留高阶技能物理机制）
        ui.onWeaponTriggerCallback = (type) => {
            window.gameUI.triggerCenterAlert(`ACTIVATED: ${type.toUpperCase()}!`);
        };
    }

    /**
     * 🕹️ 60FPS 主循环：手搓纯向量刚体碰撞与边界摩擦物理引擎
     */
    loop() {
        requestAnimationFrame(() => this.loop());

        // 1. 驱策 4 个机器人 AI 追猎内卷逻辑
        this.runAIIntelligence();

        // 2. 积分力矩物理更新
        this.actors.forEach(actor => {
            if (actor.isDead) return;

            let currentSpeed = this.baseSpeed;
            // 如果是玩家且处于 DASH 冲刺状态，给予 3.5 倍疯狂喷射推力
            if (actor.isPlayer && this.dashActive) {
                currentSpeed *= 3.5;
                this.dashTimer--;
                if (this.dashTimer <= 0) this.dashActive = false;
            }

            // 施加推力，并融合地面摩擦力阻尼
            actor.vx += actor.inputX * currentSpeed;
            actor.vz += actor.inputZ * currentSpeed;
            actor.vx *= this.friction;
            actor.vz *= this.friction;

            // 位移叠加
            actor.mesh.position.x += actor.vx;
            actor.mesh.position.z += actor.vz;

            // 圆形决斗场边缘反弹与滑落死亡判定
            const distanceFromCenter = Math.sqrt(actor.mesh.position.x * actor.mesh.position.x + actor.mesh.position.z * actor.mesh.position.z);
            if (distanceFromCenter > this.arenaRadius - actor.radius) {
                if (distanceFromCenter > this.arenaRadius + 1) {
                    // 完全跌落深渊，执行死亡出局
                    actor.isDead = true;
                    this.scene.remove(actor.mesh);
                    if (actor.isPlayer) {
                        window.gameUI.triggerCenterAlert("GAME OVER! YOU FELL!");
                    } else {
                        window.gameUI.triggerCenterAlert(`${actor.name} WAS ELIMINATED!`);
                    }
                } else {
                    // 正在边缘挣扎，计算圆弧法线进行强力反弹
                    const nx = actor.mesh.position.x / distanceFromCenter;
                    const nz = actor.mesh.position.z / distanceFromCenter;
                    // 速度矢量沿法线方向取反
                    const dot = actor.vx * nx + actor.vz * nz;
                    if (dot > 0) {
                        actor.vx -= 1.4 * dot * nx;
                        actor.vz -= 1.4 * dot * nz;
                    }
                }
            }
        });

        // 3. 💥 双重循环手搓完美弹性碰撞 (Perfect Elastic Collision Resolution)
        for (let i = 0; i < this.actors.length; i++) {
            for (let j = i + 1; j < this.actors.length; j++) {
                const a = this.actors[i];
                const b = this.actors[j];
                if (a.isDead || b.isDead) continue;

                // 计算两球当前物理圆心距离
                const dx = b.mesh.position.x - a.mesh.position.x;
                const dz = b.mesh.position.z - a.mesh.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz) || 0.1;
                const minDist = a.radius + b.radius;

                // 如果距离小于半径之和，说明发生铁血对撞！
                if (distance < minDist) {
                    // A. 修正位置重叠，防止两个球卡死吸在一起（分离向量）
                    const overlap = minDist - distance;
                    const separateX = (dx / distance) * overlap * 0.5;
                    const separateZ = (dz / distance) * overlap * 0.5;
                    a.mesh.position.x -= separateX;
                    a.mesh.position.z -= separateZ;
                    b.mesh.position.x += separateX;
                    b.mesh.position.z += separateZ;

                    // B. 计算对撞法线向量与切线速度
                    const nx = dx / distance;
                    const nz = dz / distance;

                    // 相对速度在法线上的投影面
                    const kx = a.vx - b.vx;
                    const kz = a.vz - b.vz;
                    const p = 2 * (nx * kx + nz * kz) / (a.mass + b.mass);

                    // 依据质量差，瞬间交换动能矢量（大球撞小球，小球极速弹飞！）
                    a.vx -= p * b.mass * nx;
                    a.vz -= p * b.mass * nz;
                    b.vx += p * a.mass * nx;
                    b.vz += p * a.mass * nz;

                    // 激发碰撞特效弹窗
                    if (a.isPlayer || b.isPlayer) {
                        // 震动提示
                        if (navigator.vibrate) navigator.vibrate(20);
                    }
                }
            }
        }

        // 4. 相机平滑跟踪玩家球体
        if (this.playerActor && !this.playerActor.isDead) {
            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.playerActor.mesh.position.x, 0.05);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.playerActor.mesh.position.z + 14, 0.05);
        }

        // 渲染闭环
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 🤖 4路 AI 机器人追逐内卷猎杀逻辑
     */
    runAIIntelligence() {
        this.actors.forEach(actor => {
            if (actor.isPlayer || actor.isDead) return;

            // 寻找离自己最近的活着的球作为猎杀目标
            let closestTarget = null;
            let minDist = 999;

            this.actors.forEach(target => {
                if (target.id === actor.id || target.isDead) return;
                const dx = target.mesh.position.x - actor.mesh.position.x;
                const dz = target.mesh.position.z - actor.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDist) {
                    minDist = dist;
                    closestTarget = target;
                }
            });

            // 锁定目标，施加疯狂推力撞过去！
            if (closestTarget) {
                const dx = closestTarget.mesh.position.x - actor.mesh.position.x;
                const dz = closestTarget.mesh.position.z - actor.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                actor.inputX = dx / dist;
                actor.inputZ = dz / dist;
            } else {
                actor.inputX = 0;
                actor.inputZ = 0;
            }
        });
    }
}

// ==========================================================================
// 🚨 钉死常驻全局，杜绝 Safari 垃圾回收暗杀 3D 循环
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    window.game3D = new Game3D();
});
