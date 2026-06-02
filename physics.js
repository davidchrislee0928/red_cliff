/**
 * 🏹 赤壁之战：黄盖火攻多物理场仿真 - 状态机物理引擎（流体相对运动闭合无损版）
 * 【相对流体力学物理重构】：
 * 1. 建立了真正的“相对流体参考系”，将流速与阻力合二为一：船慢于水时水是动力，船快于水时水是阻力。
 * 2. 严格校正了绝对大地坐标系（World）与船体局部坐标系（Ship）之间的旋转矩阵正交投影变换。
 * 3. 修复了风帆空气动力学升力分解中，由于变量名重叠导致的角度捕获死锁。
 */

// 1. 将物理常量与遥测缓存牢牢锁在 window 域
window.PHYSICS_SCALE = 0.25;         
window.RIVER_START_Y = 540;   
window.physicsTelemetry = {
    fLift: 0, 
    fLiftX_ship: 0, 
    fLiftY_ship: 0,
    fHuman: 0,
    fRiverX_ship: 0, 
    fRiverY_ship: 0,
    totalF_forward: 0, 
    totalF_lateral: 0
};

class WarShip {
    constructor(x, y) {
        this.pos = createVector(x, y);         
        this.vel = createVector(0, 0);         
        this.acc = createVector(0, 0);         
        this.heading = radians(135); // 初始航向：朝向西北连环水寨
        this.mass = 80000;           // 战船总质量 80 吨
        
        // 🛶 平底沙船流体动力学双轴交互系数
        // 平底沙船无吃水深龙骨，纵向劈波斩浪阻力极小，横向抵抗江水冲刷漂移的侧滑阻力极大
        this.K_water_long = 240;     // 纵向（船头中轴线）流体相互作用系数
        this.K_water_lat = 750;      // 横向（侧舷垂直面）流体冲刷拖拽系数
        
        this.oarSwing = 0; 
    }

    getSpeed() { 
        return this.vel.mag(); 
    }

    applyTruePhysics(p) {
        // 每帧物理迭代前清空绝对加速度
        this.acc.set(0, 0);
        
        // 舵效：通过船舵偏角微调战船的绝对航向（heading）
        this.heading += radians(p.rudder) * 0.0006; 
        
        // ========================================================
        // 🌬️ 1. 空气动力学核心：东南大风与自适应表观风解算
        // ========================================================
        let vWindX = p.v_wind * cos(radians(315)); // 东南风在标准坐标系中的分量
        let vWindY = p.v_wind * sin(radians(315));
        
        // 计算表观风矢量（相对风速 = 大风绝对速度 - 船只大地绝对速度）
        let vAppWindX = vWindX - this.vel.x;
        let vAppWindY = vWindY - this.vel.y;
        let vAppWind = sqrt(vAppWindX * vAppWindX + vAppWindY * vAppWindY);
        
        let fs_world_x = 0;
        let fs_world_y = 0;
        let fs_ship_x = 0;
        let fs_ship_y = 0;
        let fLiftMag = 0;

        if (p.sail_raised) {
            // 解算风帆在绝对世界坐标系下的绝对物理偏角
            let sailAbsRad = this.heading + radians(p.sail);
            let appWindDir = atan2(vAppWindY, vAppWindX);
            let alpha = appWindDir - sailAbsRad; // 表观风迎角
            
            // 依据伯努利效应与气动力学公式模拟流体升力与阻力系数
            let cL = 1.3 * sin(2 * alpha);
            let cD = 1.1 * (1.0 - cos(2 * alpha));
            
            fLiftMag = abs(0.5 * 1.225 * 120 * cL * (vAppWind * vAppWind));
            // 在风帆计算出理想 fLiftMag 后，注入工艺折损
            fLiftMag = fLiftMag * 0.45; // 还原汉代编织硬帆的漏风与气动损失
            // 🎯【重构校正点】：提取唯一的几何垂直投影角，彻底杜绝 X/Y 变量名覆盖冲突
            let targetLiftAngle = liftAngleLocalCorrection(p.sail);
            
            let local_fs_x = fLiftMag * cos(targetLiftAngle);
            let local_fs_y = fLiftMag * sin(targetLiftAngle); 
            
            // 利用旋转矩阵逆变换将船体局部受力映射回绝对世界坐标系
            fs_world_x = local_fs_x * cos(this.heading) - local_fs_y * sin(this.heading);
            fs_world_y = local_fs_x * sin(this.heading) + local_fs_y * cos(this.heading);
            
            // 累加空气动力学加速度分量
            this.acc.x += fs_world_x / this.mass;
            this.acc.y += fs_world_y / this.mass;

            // 缓存局部坐标受力数据，用于前端进行严谨的受力分析矩形渲染
            fs_ship_y = local_fs_y; // 纵向推进驱力
            fs_ship_x = local_fs_x; // 横向侧摇分力
        }
        
        // ========================================================
        // 💪 2. 人力推进动力学：橹桨排桨出力（始终笔直朝向正船头向前拉）
        // ========================================================
        let fHumanMag = p.u_human * 1000; // kN 转换为标准牛顿 N
        let fHumanX = fHumanMag * cos(this.heading);
        let fHumanY = fHumanMag * sin(this.heading);
        this.acc.x += fHumanX / this.mass;
        this.acc.y += fHumanY / this.mass;
        
        // ========================================================
        // 🌊 3. 流体力学终极建模：基于“相对运动”的水动力/水阻力闭合内核
        // ========================================================
        // 长江大江绝对水流速（西南→东北，大方向倾斜 45°）
        let vRiverX = p.v_river * cos(radians(45));
        let vRiverY = p.v_river * sin(radians(45));
        
        // 🎯 核心物理重构：解算船只在大地坐标系中，相对于江水的【相对速度矢量】
        let vRelWaterX = this.vel.x - vRiverX;
        let vRelWaterY = this.vel.y - vRiverY;
        
        // 🎯 矩阵正交变换：将相对速度投影到战船自身的局部轴向（纵中轴 Y 与横舷轴 X）
        // 在此处，我们必须精准解算战船相对水流推进或受阻的局部相对速度：
        let vRel_ship_y = vRelWaterX * cos(this.heading) + vRelWaterY * sin(this.heading);   // 船体纵向相对水速
        let vRel_ship_x = -vRelWaterX * sin(this.heading) + vRelWaterY * cos(this.heading);  // 船体横向相对水速
        
        // 🌊 在 applyTruePhysics(p) 中，动态修正纵向水阻系数
        let currentSpeed = this.getSpeed();
        // 引入动态惩罚系数：速度超过 4 m/s 后，阻力系数随速度高阶暴涨
        let dynamicKLong = this.K_water_long * (1.0 + pow(currentSpeed / 3.0, 2));

        // 使用修正后的动态阻力系数解算水阻
        let fw_ship_y = -dynamicKLong * vRel_ship_y * abs(vRel_ship_y);
        let fw_ship_x = -this.K_water_lat * vRel_ship_x * abs(vRel_ship_x);
        
        // 将解算完毕的局部水动力逆变换还原回大地绝对坐标系（叠加给物理运动加速度）
        let fw_world_x = fw_ship_y * cos(this.heading) - fw_ship_x * sin(this.heading);
        let fw_world_y = fw_ship_y * sin(this.heading) + fw_ship_x * cos(this.heading);
        
        this.acc.x += fw_world_x / this.mass;
        this.acc.y += fw_world_y / this.mass;

        // ========================================================
        // 📊 4. 物理遥测高速单向网桥数据发射（与前端渲染无缝互锁）
        // ========================================================
        window.physicsTelemetry.fLift = fLiftMag;
        window.physicsTelemetry.fLiftY_ship = fs_ship_y; 
        window.physicsTelemetry.fLiftX_ship = fs_ship_x;
        window.physicsTelemetry.fHuman = p.u_human;
        window.physicsTelemetry.fRiverY_ship = fw_ship_y; // 包含正负号的动态流体力
        window.physicsTelemetry.fRiverX_ship = fw_ship_x;
        window.physicsTelemetry.totalF_forward = (fs_ship_y + fHumanMag + fw_ship_y);
        window.physicsTelemetry.totalF_lateral = (fs_ship_x + fw_ship_x);
    }

    update(dt) {
        // 欧拉积分时序微分迭代
        this.vel.x += this.acc.x * dt;
        this.vel.y += this.acc.y * dt;
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        
        // 动态操桨频率与出力大小绑定
        if (window.localParams) {
            this.oarSwing += (window.localParams.u_human * 0.015);
        }
    }
}

// 辅助几何函数：判定风帆攻角正交升力局部的正确几何象限
function liftAngleLocalCorrection(sailDeg) {
    let sailRad = radians(sailDeg);
    return sailRad - HALF_PI;
}

// 全局注册
window.WarShip = WarShip;