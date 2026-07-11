/**
 * 步骤三：全尺寸边界 + 刚体弹射物理版 PhysicsEngine.js
 * 职责：计算大碗边缘碰撞、3D刚体精确击退、黑洞中心引力
 */
class PhysicsEngine {
    constructor() {
        console.log("PhysicsEngine: 3D 乱斗物理核心已就位。");
    }

    /**
     * 更新单个球体的物理状态
     * @param {Object} entity 当前球体
     * @param {Array} others 战场上其他的球
     * @param {number} arenaRadius 大碗当前的实时半径
     * @param {number} dt 帧间隔时间
     */
    updatePhysics(entity, others, arenaRadius, dt) {
        if (!entity || isNaN(entity.position.x)) return;

        // 1. 基础位移公式 (S = v * t)
        entity.position.x += entity.velocity.x * dt;
        entity.position.z += entity.velocity.z * dt;

        // 2. 模拟黑洞中心吸积盘的微弱向心引力（把球往中心慢慢拉）
        const distToCenter = Math.sqrt(entity.position.x * entity.position.x + entity.position.z * entity.position.z);
        if (distToCenter > 2) {
            const pullForce = 0.8; // 磁场引力强度
            entity.velocity.x -= (entity.position.x / distToCenter) * pullForce * dt;
            entity.velocity.z -= (entity.position.z / distToCenter) * pullForce * dt;
        }

        // 3. 模拟地面摩擦阻力（让球冲刺后能缓缓停下，不至于无限滑行）
        const friction = 1.2;
        entity.velocity.x *= Math.max(0, 1 - friction * dt);
        entity.velocity.z *= Math.max(0, 1 - friction * dt);

        // 4. 球与球之间的 3D 刚体弹性碰撞 + 击退力 (Knockback)
        others.forEach(other => {
            if (!other || other.id === entity.id) return;

            // 计算两个球的圆心距
            const dx = other.position.x - entity.position.x;
            const dz = other.position.z - entity.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDist = entity.radius + other.radius;

            // 如果两个球重叠了，触发撞击
            if (distance < minDist && distance > 0) {
                // 弹开向量
                const nx = dx / distance;
                const nz = dz / distance;

                // 1. 强行把重叠的球推开，防止它们卡在一起产生无限大的排斥力导致飞天
                const overlap = minDist - distance;
                entity.position.x -= nx * overlap * 0.5;
                entity.position.z -= nz * overlap * 0.5;

                // 2. 计算相对速度
                const rvx = other.velocity.x - entity.velocity.x;
                const rvz = other.velocity.z - entity.velocity.z;

                // 3. 沿碰撞法线方向的相对速度
                const velAlongNormal = rvx * nx + rvz * nz;

                // 只在两个球互相接近时才计算击退，背对背离开时不重复计算
                if (velAlongNormal < 0) {
                    const restitution = 0.8; // 弹性系数
                    const baseKnockback = 4.5; // 基础击退威力

                    // 经典动量守恒击退力冲量
                    let impulseScalar = -(1 + restitution) * velAlongNormal;
                    impulseScalar /= (1 / entity.mass + 1 / other.mass);
                    impulseScalar += baseKnockback; // 强行加上乱斗游戏的爽快击退感

                    // 把击退速度反向加给两颗球
                    entity.velocity.x -= (1 / entity.mass) * impulseScalar * nx;
                    entity.velocity.z -= (1 / entity.mass) * impulseScalar * nz;
                    
                    other.velocity.x += (1 / other.mass) * impulseScalar * nx;
                    other.velocity.z += (1 / other.mass) * impulseScalar * nz;
                }
            }
        });

        // 5. 决定生死的大碗边缘滑落判定 (碗半径是真实的 arenaRadius)
        // 这个公式计算球是否已经滚出了青色大碗的内圈边缘
        const safeBorder = arenaRadius; 
        if (distToCenter > safeBorder) {
            // 一旦滚出大碗，球失去依托，重力爆发，Y轴开始疯狂下坠跌入深渊！
            entity.velocity.y = (entity.velocity.y || 0) - 28 * dt;
            entity.position.y += entity.velocity.y * dt;
        } else {
            // 如果在碗里，稳稳贴在水平面上
            entity.position.y = 0;
            entity.velocity.y = 0;
        }
    }
}

// 挂载全局，供 MainScene 调用
window.PhysicsEngine = PhysicsEngine;
