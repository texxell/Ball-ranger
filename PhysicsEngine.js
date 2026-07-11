/**
 * BallRanger.io - PhysicsEngine.js
 * 职责：处理独立于渲染的高频刚体物理碰撞、碗状动量守恒边界反弹及多人状态同步
 */
class PhysicsEngine {
    constructor() {
        console.log("PhysicsEngine: Core rigid-body physical pipeline initialized.");
        this.gravity = 9.8;
        this.restitution = 0.6; // 弹性碰撞系数
    }

    /**
     * 核心物理碰撞矩阵计算
     * @param {Object} player - 玩家数据对象
     * @param {Array} enemies - 敌对球体列表
     * @param {number} radius - 竞技场当前动态半径
     * @param {number} dt - 单帧时间步长
     */
    updatePhysics(player, enemies, radius, dt) {
        if (!player) return;

        // 1. 基础物理惯性衰减
        player.velocity.x *= 0.98;
        player.velocity.z *= 0.98;

        // 2. 位移积分叠加
        player.position.x += player.velocity.x * dt * 60;
        player.position.z += player.velocity.z * dt * 60;

        // 3. 竞技场碗状数学曲面高度计算与向心力约束
        const r = Math.sqrt(player.position.x * player.position.x + player.position.z * player.position.z);
        if (r < radius) {
            // 四次幂方程模拟碗状平滑下陷
            player.position.y = Math.pow(r / radius, 4) * 8 - 1;

            // 陡峭边缘滑落向心力产生
            if (r > radius * 0.6) {
                const slopeForce = Math.pow(r / radius, 3) * 0.25;
                player.velocity.x += (player.position.x / r) * slopeForce;
                player.velocity.z += (player.position.z / r) * slopeForce;
            }
        } else {
            // 滑出大碗，转为坠落虚空状态
            player.position.y -= this.gravity * dt;
        }

        // 4. 遍历处理与其他球体的刚体碰撞 (动量守恒公式)
        if (enemies && enemies.length > 0) {
            enemies.forEach(enemy => {
                const distVector = new THREE.Vector3().subVectors(enemy.position, player.position);
                const distance = distVector.length();
                const minDistance = player.radius + enemy.radius;

                if (distance < minDistance && distance > 0) {
                    // 产生重叠，执行位置修正（防止卡进模型）
                    const overlap = minDistance - distance;
                    const normal = distVector.clone().normalize();
                    player.position.addScaledVector(normal, -overlap * 0.5);
                    enemy.position.addScaledVector(normal, overlap * 0.5);

                    // 计算相对速度在法线方向的投影
                    const relativeVelocity = new THREE.Vector3().subVectors(player.velocity, enemy.velocity);
                    const velAlongNormal = relativeVelocity.dot(normal);

                    // 仅当物体相互靠近时才触发冲量计算
                    if (velAlongNormal > 0) {
                        const impulseScalar = (1 + this.restitution) * velAlongNormal / (1 / player.mass + 1 / enemy.mass);
                        
                        // 动量交换
                        player.velocity.addScaledVector(normal, -impulseScalar / player.mass);
                        enemy.velocity.addScaledVector(normal, impulseScalar / enemy.mass);
                    }
                }
            });
        }
    }
}

// 挂载全局，彻底抹平模块沙箱阻断
window.PhysicsEngine = PhysicsEngine;
