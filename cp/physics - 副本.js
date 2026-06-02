/**
 * 🏹 赤壁之战：黄盖火攻多物理场仿真 - 状态机物理引擎（风帆气动升阻力全互锁修复版）
 * 【空气动力学语法修复】：
 * 1. 彻底修复因 Python 注释符（#）混入 JavaScript 导致的 SyntaxError 挂起漏洞。
 * 2. 完美引入风帆气动阻力（Air Drag）：将垂直于表观风的升力与顺着表观风的阻力矢量合成。
 * 3. 闭合视风反馈环路：随着船速提升，表观风偏转，气动阻力自动增大并转化为向后的物理减速。
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
        this.K_water_long = 240;     // 纵向流体阻力系数
        this.K_water_lat = 750;      // 横向流体冲刷拖拽系数
        
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
        // 🌬️ 1. 空气动力学核心：升力与阻力双矢量全解算
        // ========================================================
        let vWindX = p.v_wind * cos(radians(315)); // 东南风绝对速度
        let vWindY = p.v_wind * sin(radians(315));
        
        // 【自适应表观风解算】：相对风速 = 大风绝对速度 - 船只大地绝对速度
        let vAppWindX = vWindX - this.vel.x;
        let vAppWindY = vWindY - this.vel.y;
        let vAppWind = sqrt(vAppWindX * vAppWindX + vAppWindY * vAppWindY);
        
        let fs_world_x = 0;
        let fs_world_y = 0;
        let fs_ship_x = 0;
        let fs_ship_y = 0;
        let fLiftMag = 0;

        if (p.sail_raised && vAppWind > 0.1) {
            // 计算视风方向（绝对大地坐标系下）
            let appWindDir = atan2(vAppWindY, vAppWindX);
            
            // 解算风帆在绝对世界坐标系下的绝对物理偏角
            let sailAbsRad = this.heading + radians(p.sail);
            let alpha = appWindDir - sailAbsRad; // 表观风迎角 (Angle of Attack)
            
            // 依据空气动力学公式计算升力系数 cL 与阻力系数 cD
            let cL = 1.3 * sin(2 * alpha);
            let cD = 1.1 * (1.0 - cos(2 * alpha));
            
            // 计算气动力绝对牛顿额度（注入 0.45 古代工艺折损）
            fLiftMag = abs(0.5 * 1.225 * 120 * cL * (vAppWind * vAppWind)) * 0.45;
            let fDragAirMag = abs(0.5 * 1.225 * 120 * cD * (vAppWind * vAppWind)) * 0.45;
            
            // 🎯【空气动力学核心重构】：建立升力与阻力的绝对世界矢量
            // 升力垂直于表观风向（根据迎角正负判定偏转方向）
            let liftDir = appWindDir + (alpha >= 0 ? -HALF_PI : HALF_PI);
            let fLiftX_world = fLiftMag * cos(liftDir);
            let fLiftY_world = fLiftMag * sin(liftDir);
            
            // 阻力严格顺着表观风向吹过来的方向（即表观风速矢量的正方向）
            let fDragX_world = fDragAirMag * cos(appWindDir);
            let fDragY_world = fDragAirMag * sin(appWindDir);
            
            // 矢量合成：空气动力学总合力（大地坐标系）
            fs_world_x = fLiftX_world + fDragX_world;
            fs_world_y = fLiftY_world + fDragY_world;
            
            // 累加风帆加速度
            this.acc.x += fs_world_x / this.mass;
            this.acc.y += fs_world_y / this.mass;

            // 🎯【正交逆矩阵变换】：将合成后的风帆总气动力投影回船体自身的纵/横轴
            let cosH = cos(-this.heading);
            let sinH = sin(-this.heading);
            fs_ship_x = fs_world_x * cosH - fs_world_y * sinH; // 船体横向侧摇分力
            fs_ship_y = fs_world_x * sinH + fs_world_y * cosH; // 船体纵向推进驱力
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
        // 🌊 3. 流体力学内核：基于“相对运动”的水动力/水阻力闭合内核
        // ========================================================
        let vRiverX = p.v_river * cos(radians(45));
        let vRiverY = p.v_river * sin(radians(45));
        
        // 解算船只相对于江水的【相对速度矢量】
        let vRelWaterX = this.vel.x - vRiverX;
        let vRelWaterY = this.vel.y - vRiverY;
        
        // 矩阵正交变换：将相对速度投影到战船自身的局部轴向
        let vRel_ship_y = vRelWaterX * cos(this.heading) + vRelWaterY * sin(this.heading);   // 船体纵向相对水速
        let vRel_ship_x = -vRelWaterX * sin(this.heading) + vRelWaterY * cos(this.heading);  // 船体横向相对水速
        
        // 动态修正纵向水阻系数（引入高阶兴波阻力惩罚，模拟大船高速段的物理踩刹车行为）
        let currentSpeed = this.getSpeed();
        let dynamicKLong = this.K_water_long * (1.0 + pow(currentSpeed / 3.0, 2));

        // 计算流体交互力
        let fw_ship_y = -dynamicKLong * vRel_ship_y * abs(vRel_ship_y);
        let fw_ship_x = -this.K_water_lat * vRel_ship_x * abs(vRel_ship_x);
        
        // 还原回大地绝对坐标系
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
        window.physicsTelemetry.fRiverY_ship = fw_ship_y; 
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
        
        if (window.localParams) {
            this.oarSwing += (window.localParams.u_human * 0.015);
        }
    }
}

// 全局注册
window.WarShip = WarShip;