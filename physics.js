/**
 * 🏹 physics.js - 纯净版流体力学计算引擎（带全链路 Debug 日志追踪版）
 */

window.PHYSICS_SCALE = 0.25;         
window.RIVER_START_Y = 540;   
window.physicsTelemetry = {
    fLift: 0, fLiftX_ship: 0, fLiftY_ship: 0, fHuman: 0,
    fRiverX_ship: 0, fRiverY_ship: 0, totalF_forward: 0, totalF_lateral: 0
};

class WarShip {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.heading = radians(135);
        this.oarSwing = 0;

        this.baseMass = 75000;       
        this.baseKLong = 240;        
        this.baseKLat = 750;         

        this.sailComponent = null;
        this.keelComponent = null;
        console.log("🛠️ [Debug Log] 物理引擎：WarShip 骨架底座成功在内存中初始化！");
    }

    getSpeed() { return this.vel.mag(); }
    equipSail(sailObj) { this.sailComponent = sailObj; }
    equipKeel(keelObj) { this.keelComponent = keelObj; }

    applyTruePhysics(p) {
        this.acc.set(0, 0);
        
        let currentRudder = (p.rudder !== undefined && !isNaN(p.rudder)) ? p.rudder : -20;
        
        // 1. 优化舵效动推：根据当前船速动态调整转弯速率（死水或静止时舵效衰减，高速时舵效显著）
        let speedFactor = constrain(this.getSpeed() / 5.0, 0.1, 1.5);
        this.heading += radians(currentRudder) * 0.0008 * speedFactor;

        let totalMass = this.baseMass;
        if (this.sailComponent) totalMass += this.sailComponent.mass;
        if (this.keelComponent) totalMass += this.keelComponent.mass;

        // 2. 解算多态龙骨的水动力抗性基底
        let hydroDrag = { kLong: this.baseKLong, kLat: this.baseKLat };
        if (this.keelComponent && typeof this.keelComponent.modifyHydroDrag === 'function') {
            hydroDrag = this.keelComponent.modifyHydroDrag(this.baseKLong, this.baseKLat);
        }

        let fs_ship_x = 0, fs_ship_y = 0;
        let fLiftMag = 0;

        // 3. 视风与风帆空气动力学解算
        let vWindX = p.v_wind * cos(radians(315));
        let vWindY = p.v_wind * sin(radians(315));
        let vAppWindX = vWindX - this.vel.x;
        let vAppWindY = vWindY - this.vel.y;
        let vAppWind = sqrt(vAppWindX * vAppWindX + vAppWindY * vAppWindY);

        let currentSailAngle = (p.sail !== undefined && !isNaN(p.sail)) ? p.sail : 25;
        let currentSailHeight = (p.sail_height !== undefined && !isNaN(p.sail_height)) ? p.sail_height : 1.0;

        if (this.sailComponent && typeof this.sailComponent.calculateAeroForces === 'function') {
            let res = this.sailComponent.calculateAeroForces(vAppWindX, vAppWindY, vAppWind, this.heading, currentSailAngle, currentSailHeight);
            if (res && res.fLiftMag > 0) {
                fLiftMag = res.fLiftMag;
                let fx_w = res.fLiftMag * cos(res.liftDir) + res.fDragAirMag * cos(res.appWindDir);
                let fy_w = res.fLiftMag * sin(res.liftDir) + res.fDragAirMag * sin(res.appWindDir);

                this.acc.x += fx_w / totalMass;
                this.acc.y += fy_w / totalMass;

                let cosH = cos(-this.heading); let sinH = sin(-this.heading);
                fs_ship_x = fx_w * cosH - fy_w * sinH;
                fs_ship_y = fx_w * sinH + fy_w * cosH;
            }
        }

        // 4. 纯人力桨排推进力解算
        let fHumanMag = p.u_human * 1000;
        this.acc.x += (fHumanMag * cos(this.heading)) / totalMass;
        this.acc.y += (fHumanMag * sin(this.heading)) / totalMass;

        // 5. 【核心修复】大江水动力学：流体相对运动与抗横移投影重构
        let vRiverX = p.v_river * cos(radians(45)); // 江水流向：西南 -> 东北
        let vRiverY = p.v_river * sin(radians(45));
        
        // 战船相对于江水的流体速度矢量
        let vRelWaterX = this.vel.x - vRiverX;
        let vRelWaterY = this.vel.y - vRiverY;

       // # 对齐标准二维旋转矩阵，解算船体坐标系下的相对速度分量
       // # vRel_ship_y: 船首纵向相对速度（正值为前行冲刷，负值为倒退摩擦）
       // # vRel_ship_x: 船身横向相对滑跑速度（正值为右舷受风横移，负值为左舷受风横移）
        let vRel_ship_y = vRelWaterX * cos(this.heading) + vRelWaterY * sin(this.heading);   
        let vRel_ship_x = -vRelWaterX * sin(this.heading) + vRelWaterY * cos(this.heading);  

        let currentSpeed = this.getSpeed();
        let dynamicKLong = hydroDrag.kLong * (1.0 + pow(currentSpeed / 3.0, 2));

        // 6. 产生方向精准相反的流体反作用抗力
        // 纵向切水水阻
        let fw_ship_y = -dynamicKLong * vRel_ship_y * abs(vRel_ship_y);
        // 横向龙骨抗滑位移阻力：必须严格反向抵抗侧滑分量
        let fw_ship_x = -hydroDrag.kLat * vRel_ship_x * abs(vRel_ship_x);

        // 7. 动态追加舵面产生的水流偏航纠偏纠正力 (Rudder Lift)
        // 当船与水有相对纵向速度且打舵时，舵面由于升力产生额外的横向抗侧滑纠偏额度
        if (abs(vRel_ship_y) > 0.1) {
            let fRudderLift = -0.15 * hydroDrag.kLat * vRel_ship_y * radians(currentRudder);
            fw_ship_x += fRudderLift;
        }

        // 8. 将船体受力坐标系下的流体合力反向映射回大地绝对坐标系 (X-Y)
        this.acc.x += (fw_ship_y * cos(this.heading) - fw_ship_x * sin(this.heading)) / totalMass;
        this.acc.y += (fw_ship_y * sin(this.heading) + fw_ship_x * cos(this.heading)) / totalMass;

        // 更新遥测面板
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
        this.vel.x += this.acc.x * dt; this.vel.y += this.acc.y * dt;
        this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt;
        if (window.localParams) this.oarSwing += (window.localParams.u_human * 0.015);
    }
}

window.WarShip = WarShip;