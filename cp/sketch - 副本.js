/**
 * 🏹 赤壁之战：黄盖火攻先锋船队 - 力线限幅平衡渲染内核 (力线视觉增强与稳定分解版)
 * 【本次微调点】：
 * 1. 力的尺度增强：合理放大 BASE_VISUAL_FACTOR 与 MAX_LEN 约束，让力线充分舒展，清晰易读。
 * 2. 稳定双向分解：直接提取物理场原始分量绝对值，重构风帆力、水阻力的正交投影，杜绝分力闪烁或单向缺失。
 * 3. 几何闭合增强：确保不论输入如何变化，平行四边形定则的直角矩形虚线永远完美闭合。
 */

window.localParams = null;
let ship = null; 
let riverParticles = [];
let fireParticles = [];
let isExploded = false;
let simTime = 0;

// 📸 头像图片对象及内存防刷锁
let avatarImg = null;
let avatarLoaded = false;

// 分层受力控制状态机
let showHumanForce = true;
let showSailForce = true;
let showWaterForce = true;

// 虚拟像素按钮
const BTN_Y = 675;
const BTN_W = 125;
const BTN_H = 22;
const BTN1_X = 25;
const BTN2_X = 165;
const BTN3_X = 305;

function preload() {
    console.log("【1. Preload】跳过静态路径加载，转由 Streamlit 数据网桥内存动态注入。");
}

function setup() {
    createCanvas(900, 1820);
    frameRate(60); 

    if (sessionStorage.getItem("chibi_show_human") !== null) {
        showHumanForce = sessionStorage.getItem("chibi_show_human") === "true";
    }
    if (sessionStorage.getItem("chibi_show_sail") !== null) {
        showSailForce = sessionStorage.getItem("chibi_show_sail") === "true";
    }
    if (sessionStorage.getItem("chibi_show_water") !== null) {
        showWaterForce = sessionStorage.getItem("chibi_show_water") === "true";
    }
}

function draw() {
    if (typeof window.PHYSICS_SCALE === 'undefined' || typeof window.WarShip === 'undefined' || typeof window.physicsTelemetry === 'undefined') {
        background('#060d16');
        fill('#a3b8cc'); textSize(14); textAlign(CENTER);
        text("⚡ 正在初始化多物理场战术沙盘，请稍候...", width/2, height/2);
        return;
    }

    let bridgeDiv = document.getElementById("py-bridge");
    if (bridgeDiv) { 
        window.localParams = JSON.parse(bridgeDiv.getAttribute("data-params")); 
    }
    if (!window.localParams) return; 
    let p = window.localParams;

    if (p.avatar_data && !avatarLoaded) {
        avatarImg = loadImage(p.avatar_data);
        avatarLoaded = true; 
    }

    if (!ship) {
        if (!sessionStorage.getItem("chibi_ship_x") || p.reset_trigger) {
            ship = new window.WarShip(2400, 0);
            simTime = 0; isExploded = false;
            sessionStorage.setItem("chibi_sim_time", 0);
            sessionStorage.setItem("chibi_exploded", "false");
            saveStateToStorage(2400, 0, 0, 0, radians(135));
        } else {
            ship = new window.WarShip(parseFloat(sessionStorage.getItem("chibi_ship_x")), parseFloat(sessionStorage.getItem("chibi_ship_y")));
            ship.vel.set(parseFloat(sessionStorage.getItem("session_ship_vx")) || 0, parseFloat(sessionStorage.getItem("session_ship_vy")) || 0);
            ship.heading = parseFloat(sessionStorage.getItem("chibi_ship_heading"));
            simTime = parseFloat(sessionStorage.getItem("chibi_sim_time")) || 0;
            isExploded = sessionStorage.getItem("chibi_exploded") === "true";
        }
        for(let i = 0; i < 150; i++) { riverParticles.push(new RiverParticle()); }
    }
    
    background('#060d16'); 

    // ========================================================
    // 🗺️ 【第一张图】：宏观长江战场推演 (Y: 0 ~ 600)
    // ========================================================
    push();
    let riverPixelHeight = p.w_river * window.PHYSICS_SCALE;
    let northBankY = window.RIVER_START_Y - riverPixelHeight;

    let context = canvas.getContext('2d');
    let gradient = context.createLinearGradient(0, window.RIVER_START_Y, 0, northBankY);
    gradient.addColorStop(0, '#0a1c2a'); gradient.addColorStop(0.5, '#071624'); gradient.addColorStop(1, '#05101c');   
    context.fillStyle = gradient; context.fillRect(0, northBankY, width, riverPixelHeight);
    
    fill('#2b2015'); rect(0, window.RIVER_START_Y, width, 600 - window.RIVER_START_Y); 
    fill('#141d26'); rect(0, 0, width, northBankY); 
    stroke('rgba(163, 184, 204, 0.15)'); strokeWeight(1); line(0, window.RIVER_START_Y, width, window.RIVER_START_Y); line(0, northBankY, width, northBankY);
    
    noStroke(); 
    fill(180, 140, 100); textSize(13); textStyle(BOLD); textAlign(RIGHT); 
    text("江南岸：东吴周瑜大寨 (赤壁枢纽)", width - 20, window.RIVER_START_Y + 25);
    
    textAlign(LEFT); fill(130, 160, 180); 
    text("江北岸：曹魏水寨连环船 (乌林核心)", 280, northBankY - 15);

    if (!isExploded) {
        simTime += 1 / 60;
        sessionStorage.setItem("chibi_sim_time", simTime);
    }

    riverParticles.forEach(pt => { pt.update(p.v_river, northBankY); pt.display(); });

    if (!isExploded) {
        ship.applyTruePhysics(p);
        ship.update(1 / 60); 
        drawMicroShipInMacroWorld(p); 
        saveStateToStorage(ship.pos.x, ship.pos.y, ship.vel.x, ship.vel.y, ship.heading);
        if (ship.pos.y >= p.w_river) isExploded = true;
    } else {
        triggerExplosion(ship.pos.x * window.PHYSICS_SCALE, northBankY);
    }

    let nx = width - 60, ny = 60; stroke('rgba(130, 160, 180, 0.2)'); ellipse(nx, ny, 30, 30);
    stroke('#ff4422'); fill('#ff4422'); triangle(nx, ny - 20, nx - 5, ny, nx + 5, ny);
    stroke('#ffffff'); fill('#a3b8cc'); triangle(nx, ny + 15, nx - 4, ny, nx + 4, ny);
    fill('#ff4422'); noStroke(); textSize(12); textStyle(BOLD); textAlign(CENTER); text("北", nx, ny - 25); 

    drawDashboard(p.w_river);
    pop(); 

    // ========================================================
    // 📊 【第二张图】：微观船体受力分析 (Y: 600 ~ 1600)
    // ========================================================
    push();
    stroke('rgba(29, 45, 61, 0.35)'); strokeWeight(1);
    for(let x = 0; x < width; x += 40) line(x, 600, x, 1600);
    for(let y = 600; y < 1600; y += 40) line(0, y, width, y);

    noStroke(); fill('#a3b8cc'); textSize(14); textStyle(BOLD); textAlign(LEFT); 
    text("📊 斗舰先锋船体坐标系（微观动力学受力分析 - 矢量力向绝对校准版）", 20, 630);

    drawCanvasVirtualButtons();

    let cx = 450, cy = 1100;
    
    push();
    translate(cx, cy);
    rotate(-ship.heading + HALF_PI); 
    
    drawHugeAbstractShip(this, 0, 0, p.sail_raised, p.sail, p.rudder);
    
    let TOTAL_F_SCALE = 1.2;
    drawForceVectors(this, 0, 0, TOTAL_F_SCALE, p);
    pop();

    drawLocalWindIndicator(this, cx + 180, cy - 260);
    
    stroke('#1d2d3d'); strokeWeight(3); line(0, 600, width, 600);
    pop(); 

    // ========================================================
    // 📜 【底部面板】：公式面板区 (Y: 1600 ~ 1820)
    // ========================================================
    push();
    stroke('#1d2d3d'); strokeWeight(2); line(0, 1600, width, 1600);
    drawPhysicsFormulas();
    pop();
}

function drawCanvasVirtualButtons() {
    textSize(10); textStyle(NORMAL); textAlign(CENTER);
    fill(showHumanForce ? 'rgba(46, 204, 113, 0.2)' : 'rgba(44, 62, 80, 0.4)');
    stroke(showHumanForce ? '#2ecc71' : '#34495e'); strokeWeight(1); rect(BTN1_X, BTN_Y, BTN_W, BTN_H, 4);
    noStroke(); fill(showHumanForce ? '#2ecc71' : '#7f8c8d'); text("💪 人力推进: " + (showHumanForce ? "显示" : "隐藏"), BTN1_X + BTN_W/2, BTN_Y + 15);

    fill(showSailForce ? 'rgba(231, 76, 60, 0.2)' : 'rgba(44, 62, 80, 0.4)');
    stroke(showSailForce ? '#e74c3c' : '#34495e'); rect(BTN2_X, BTN_Y, BTN_W, BTN_H, 4);
    noStroke(); fill(showSailForce ? '#ff6655' : '#7f8c8d'); text("💨 风帆气动力: " + (showSailForce ? "显示" : "隐藏"), BTN2_X + BTN_W/2, BTN_Y + 15);

    fill(showWaterForce ? 'rgba(52, 152, 219, 0.2)' : 'rgba(44, 62, 80, 0.4)');
    stroke(showWaterForce ? '#3498db' : '#34495e'); rect(BTN3_X, BTN_Y, BTN_W, BTN_H, 4);
    noStroke(); fill(showWaterForce ? '#3498db' : '#7f8c8d'); text("🌊 大江水阻力: " + (showWaterForce ? "显示" : "隐藏"), BTN3_X + BTN_W/2, BTN_Y + 15);
}

function mousePressed() {
    if (mouseY >= BTN_Y && mouseY <= BTN_Y + BTN_H) {
        if (mouseX >= BTN1_X && mouseX <= BTN1_X + BTN_W) {
            showHumanForce = !showHumanForce;
            sessionStorage.setItem("chibi_show_human", showHumanForce);
        }
        if (mouseX >= BTN2_X && mouseX <= BTN2_X + BTN_W) {
            showSailForce = !showSailForce;
            sessionStorage.setItem("chibi_show_sail", showSailForce);
        }
        if (mouseX >= BTN3_X && mouseX <= BTN3_X + BTN_W) {
            showWaterForce = !showWaterForce;
            sessionStorage.setItem("chibi_show_water", showWaterForce);
        }
    }
}

// 🎯【重构受力矢量核】：微调视觉长度、锁定双向稳定分解分量
function drawForceVectors(g, cx, cy, fSc, p) {
    g.push(); g.translate(cx, cy); 
    if (!window.physicsTelemetry) { g.pop(); return; }

    // 🎯【微调：加长力线限幅上限】从 160 提升到 240，防止截断，充分舒展
    const MAX_LEN = 240;
    // 🎯【微调：提升视觉放大系数】从 0.0035 上调到 0.0055，让线条显著变长
    const BASE_VISUAL_FACTOR = fSc * 0.0055; 

    // 1. 人力推进（始终朝向船头正前方 Y 负轴，对应拉长系数）
    if (showHumanForce) {
        let fHuman = window.physicsTelemetry.fHuman || 0;
        let lenHuman = fHuman * fSc * 3.5; // 按比例加长
        lenHuman = constrain(lenHuman, 0, MAX_LEN);
        if (lenHuman > 0) drawGraphArrow(g, 0, 0, 0, -lenHuman, '#2ecc71', 4, "纯人力推进 F(human)", true);
    }

    // 2. 风帆空气动力学（双向正交分解焊死）
    if (showSailForce && p.sail_raised && (window.physicsTelemetry.fLift > 0)) {
        let fLift = window.physicsTelemetry.fLift || 0;
        let sailRad = radians(p.sail);
        let liftAngle = sailRad - HALF_PI; 
        
        // 计算总合力线终点坐标
        let lx = (fLift * BASE_VISUAL_FACTOR) * cos(liftAngle);
        let ly = (fLift * BASE_VISUAL_FACTOR) * sin(liftAngle);
        
        let magLift = sqrt(lx*lx + ly*ly);
        if(magLift > MAX_LEN) { lx = (lx/magLift)*MAX_LEN; ly = (ly/magLift)*MAX_LEN; }
        
        // 🎯【终极稳定微调】：直接通过合力的几何投影坐标，绝对镜像出纵横分力长度，100%杜绝单方向缺失或死锁
        let lenLiftForward = -ly; // 前向投影
        let lenLiftLateral = lx;  // 横向投影
        
        // 绘制总升力合力线
        drawGraphArrow(g, 0, 0, lx, ly, '#ff4422', 4, "席帆扬帆升力 F(lift)", false);
        
        // 稳定拉出前向驱动力箭头
        if (abs(lenLiftForward) > 0.1) {
            drawGraphArrow(g, 0, 0, 0, -lenLiftForward, 'rgba(255, 102, 85, 0.9)', 2.5, "风帆前向驱力", true);
        }
        
        // 稳定拉出侧向分力截面箭头
        if (abs(lenLiftLateral) > 0.1) {
            drawGraphArrow(g, 0, 0, lenLiftLateral, 0, 'rgba(255, 150, 50, 0.9)', 2.5, "风帆侧向力", true);
        }
        
        // 闭合几何平行四边形矩形虚线
        g.stroke('rgba(255, 68, 34, 0.4)'); g.strokeWeight(1.2); g.drawingContext.setLineDash([4, 4]); 
        g.line(0, -lenLiftForward, lx, ly); 
        g.line(lenLiftLateral, 0, lx, ly); 
        g.drawingContext.setLineDash([]); 
    }

    // 3. 流体阻力/动力耦合项（同样等比例拉长）
    if (showWaterForce) {
        let rawRiverY = window.physicsTelemetry.fRiverY_ship || 0;
        let rawRiverX = window.physicsTelemetry.fRiverX_ship || 0;

        // 统一缩放映射到视觉像素空间
        let fy_sub = (-rawRiverY) * BASE_VISUAL_FACTOR * 2.2; 
        let fx_sub = rawRiverX * BASE_VISUAL_FACTOR * 2.2; 
        
        fy_sub = constrain(fy_sub, -MAX_LEN, MAX_LEN);
        fx_sub = constrain(fx_sub, -MAX_LEN, MAX_LEN);
        
        let fx_water = fx_sub;
        let fy_water = fy_sub; 

        if (abs(fx_sub) > 0.1 || abs(fy_sub) > 0.1) {
            drawGraphArrow(g, 0, 0, fx_water, fy_water, '#3498db', 4, "大江流体合力 F(water)", false);
            
            drawGraphArrow(g, 0, 0, 0, fy_sub, 'rgba(52, 152, 219, 0.7)', 2.2, "纵向流体阻力", true); 
            drawGraphArrow(g, 0, 0, fx_sub, 0, 'rgba(52, 152, 219, 0.7)', 2.2, "横向横偏冲力", true);
            
            g.stroke('rgba(52, 152, 219, 0.35)'); g.strokeWeight(1); g.drawingContext.setLineDash([3, 3]);
            g.line(0, fy_sub, fx_water, fy_water);
            g.line(fx_sub, 0, fx_water, fy_water);
            g.drawingContext.setLineDash([]);
        }
    }
    g.pop();
}

function drawPhysicsFormulas() {
    noStroke(); fill('#e1e8f0'); textAlign(LEFT);
    let startY = 1635; 
    
    textSize(13); textStyle(BOLD); text("1. 席帆伯努利扬帆方程 & 人力冲刺", 30, startY); 
    textStyle(NORMAL); textSize(11); fill('#a3b8cc');
    text("风帆垂直总升力公式: F(lift) = 0.5 * ρ * S(帆) * C(L) * [V(表观风)]²", 30, startY + 22);
    fill('#ff4422'); text("  → 瞬时总升力 F(lift) = " + Math.round(window.physicsTelemetry.fLift || 0) + " 牛顿 (N)", 30, startY + 39);
    
    fill('#a3b8cc');
    let currentSailDeg = window.localParams ? window.localParams.sail : 0;
    let cosVal = cos(radians(currentSailDeg));
    let fSailForwardN = Math.round((window.physicsTelemetry.fLift || 0) * abs(cosVal));
    text("船体纵向推进分解: F(帆前向) = F(lift) * |cos(θ_帆)|", 30, startY + 62);
    fill('#ff6655'); text("  → 解算投影: " + Math.round(window.physicsTelemetry.fLift || 0) + " N * |cos(" + currentSailDeg + "°)| = " + fSailForwardN + " 牛顿 (N)", 30, startY + 79);
    
    fill('#a3b8cc'); text("纯人力排桨驱力 F(human) = " + Math.round((window.physicsTelemetry.fHuman || 0) * 1000) + " N", 30, startY + 100);
    text("纵向总推进驱力 ΣF(前向) = F(帆前向) + F(human) = " + Math.round(fSailForwardN + ((window.physicsTelemetry.fHuman || 0) * 1000)) + " N", 30, startY + 118);

    fill('#e1e8f0'); textSize(13); textStyle(BOLD); text("2. 平底沙船大江流体冲刷与微分迭代", 480, startY); 
    textStyle(NORMAL); textSize(11); fill('#a3b8cc'); text("流体绝对冲拉力公式: F(water) = -K(水) * [V(相对水)]²", 480, startY + 22);
    fill('#3498db');
    let fRiverY = Math.round(window.physicsTelemetry.fRiverY_ship || 0);
    let fRiverX = Math.round(window.physicsTelemetry.fRiverX_ship || 0);
    text("  → 船体坐标系横纵投影分解结果:", 480, startY + 39);
    text("    [纵向江水阻力]: " + fRiverY + " N  |  [侧向无龙骨漂移冲力]: " + fRiverX + " N", 480, startY + 56);
    
    fill('#a3b8cc'); text("牛顿第二定律积分状态机 (M_船 = 80 吨):", 480, startY + 79);
    text("  dv / dt = ΣF / M_船  |  隔欧拉积分迭代: V(t) = V(t-1) + a * Δt", 480, startY + 96);
    fill('#2ecc71'); textStyle(BOLD); text("📈 终极合速度解算: V(地) = sqrt(Vx² + Vy²) = " + nf(ship.getSpeed(), 0, 2) + " m/s", 480, startY + 118);
}

function drawGraphArrow(g, x1, y1, x2, y2, clr, weight, label, isSubComponent) {
    g.stroke(clr); g.strokeWeight(weight); g.fill(clr); g.line(x1, y1, x2, y2);
    let angle = atan2(y2 - y1, x2 - x1); g.push(); g.translate(x2, y2); g.rotate(angle);
    let arrowSize = 7; g.triangle(0, 0, -arrowSize, -arrowSize*0.4, -arrowSize, arrowSize*0.4); g.pop();
    
    if (label && dist(x1,y1,x2,y2) > 20) { 
        g.noStroke(); g.fill(clr); g.textSize(10); 
        if (isSubComponent) {
            g.textAlign(g.CENTER);
            g.text(label, x2 * 0.55, y2 * 0.55 + 12); 
        } else {
            g.textAlign(g.LEFT);
            g.text(label, x2 + 8 * cos(angle + HALF_PI), y2 + 8 * sin(angle + HALF_PI));
        }
    }
}

function drawMicroShipInMacroWorld(p) {
    let screenX = ship.pos.x * window.PHYSICS_SCALE;
    let screenY = window.RIVER_START_Y - (ship.pos.y * window.PHYSICS_SCALE);
    
    push(); 
    let fx = screenX + 50, fy = screenY - 50; stroke('rgba(255, 75, 75, 0.2)'); noFill(); ellipse(fx, fy, 32, 32);
    let dX = 11, dY = 11; let startX = fx + dX, startY = fy + dY, endX = fx - dX, endY = fy - dY;
    stroke('#ff4422'); strokeWeight(2); line(startX, startY, endX, endY); line(endX, endY, endX + 7, endY + 1); line(endX, endY, endX + 1, endY + 7);
    noStroke(); fill('rgba(255, 68, 34, 0.85)'); textSize(9); textAlign(CENTER); text("东南风", fx, fy - 20); 
    pop();

    if (avatarImg) {
        push();
        let imgW = 57.5;
        let imgH = 40;
        let avatarX = screenX - 70;
        let avatarY = screenY - 50;
        
        stroke('rgba(163, 184, 204, 0.6)');
        strokeWeight(1.5);
        fill('#060d16');
        rect(avatarX - 2, avatarY - 2, imgW + 4, imgH + 4, 3);
        
        image(avatarImg, avatarX, avatarY, imgW, imgH);
        
        stroke('rgba(163, 184, 204, 0.3)');
        strokeWeight(1);
        drawingContext.setLineDash([2, 2]);
        line(avatarX + imgW / 2, avatarY + imgH, screenX, screenY);
        drawingContext.setLineDash([]);
        pop();
    }

    push(); 
    translate(screenX, screenY); rotate(-ship.heading + HALF_PI); scale(0.62); 
    stroke('#a3b8cc'); strokeWeight(2.5); noFill();
    beginShape(); vertex(0, -63); vertex(17, -28); vertex(17, 49); vertex(10, 63); vertex(-10, 63); vertex(-17, 49); vertex(-17, -28); endShape(CLOSE);
    stroke('rgba(163, 184, 204, 0.4)'); for(let i = -21; i < 49; i += 16) line(-15, i, 15, i);
    stroke('#a3b8cc'); strokeWeight(4); line(0, -63, 0, -75);
    let currentSwing = sin(ship.oarSwing) * radians(18); stroke('#e1e8f0'); strokeWeight(1.5); 
    for (let i = -14; i < 35; i += 8) { push(); translate(17, i); rotate(radians(75) + currentSwing); line(0, 0, 25, 0); rect(22, -2, 4, 4); pop(); push(); translate(-17, i); rotate(radians(105) - currentSwing); line(0, 0, -25, 0); rect(-26, -2, 4, 4); pop(); }
    let luSwing = cos(ship.oarSwing * 1.2) * radians(20); push(); translate(-11, 59); rotate(radians(150) + luSwing); stroke('#d1dbed'); strokeWeight(2); line(0, 0, 34, 0); pop();
    push(); translate(0, 63); rotate(radians(p.rudder)); stroke('#f39c12'); strokeWeight(3.5); line(0, 0, 0, 20); pop();
    if (p.sail_raised) { push(); translate(0, 7); rotate(radians(p.sail)); stroke('#ffffff'); strokeWeight(3.5); line(-30, 0, 30, 0); stroke('rgba(255,255,255,0.7)'); strokeWeight(1); for(let h = -18; h <= 18; h += 6) { if(h !== 0) line(-26 + abs(h)*0.3, h, 26 - abs(h)*0.3, h); } pop(); } 
    pop();
}

function drawHugeAbstractShip(g, cx, cy, sailRaised, sailDeg, rudderDeg) {
    g.push(); g.translate(cx, cy); g.stroke('rgba(163, 184, 204, 0.8)'); g.strokeWeight(2); g.noFill();
    g.beginShape(); g.vertex(0, -90); g.vertex(22, -50); g.vertex(22, 70); g.vertex(14, 90); g.vertex(-14, 90); g.vertex(-22, 70); g.vertex(-22, -50); g.endShape(g.CLOSE);
    g.stroke('rgba(163, 184, 204, 0.2)'); for(let i = -30; i <= 70; i += 20) g.line(-21, i, 21, i);
    g.stroke('#a3b8cc'); g.strokeWeight(3.5); g.line(0, -90, 0, -104);
    let currentSwing = sin(ship.oarSwing) * radians(18); g.stroke('#e1e8f0'); g.strokeWeight(1.2);
    for (let i = -20; i < 50; i += 12) { g.push(); g.translate(22, i); g.rotate(radians(75) + currentSwing); g.line(0, 0, 30, 0); g.rect(27, -2, 4, 4); g.pop(); g.push(); g.translate(-22, i); g.rotate(radians(105) - currentSwing); g.line(0, 0, -30, 0); g.rect(-31, -2, 4, 4); g.pop(); }
    let luSwing = cos(ship.oarSwing * 1.2) * radians(20); g.push(); g.translate(-14, 85); g.rotate(radians(150) + luSwing); g.stroke('#d1dbed'); g.strokeWeight(2); g.line(0, 0, 40, 0); g.strokeWeight(4); g.line(30, 0, 40, 0); g.pop();
    g.push(); g.translate(0, 90); g.rotate(radians(rudderDeg)); g.stroke('#f39c12'); g.strokeWeight(3.5); g.line(0, 0, 0, 25); g.pop();
    if (sailRaised) { g.push(); g.translate(0, -10); g.rotate(radians(sailDeg)); g.stroke('#ffffff'); g.strokeWeight(3.5); g.line(-42, 0, 42, 0); g.stroke('rgba(255,255,255,0.3)'); g.strokeWeight(1); for(let h = -10; h <= 10; h += 5) { if(h!==0) g.line(-37, h, 37, h); } g.pop(); } g.pop();
}

function drawLocalWindIndicator(g, fx, fy) {
    g.push(); g.stroke('rgba(255, 75, 75, 0.15)'); g.noFill(); g.ellipse(fx, fy, 36, 36);
    let dX = 12, dY = 12; g.stroke('#ff4422'); g.strokeWeight(2.5); g.line(fx + dX, fy + dY, fx - dX, fy - dY);
    g.line(fx - dX, fy - dY, fx - dX + 8, fy - dY + 1); g.line(fx - dX, fy - dY, fx - dX + 1, fy - dY + 8);
    g.noStroke(); g.fill('rgba(255, 68, 34, 0.85)'); g.textSize(10); g.textAlign(g.CENTER); g.text("东南风", fx, fy - 22); g.pop();
}

function drawDashboard(targetW) { 
    let dashX = 20;
    let dashY = 20;
    fill('rgba(11, 19, 30, 0.85)'); 
    rect(dashX, dashY, 250, 120, 6); 
    stroke('rgba(70, 130, 180, 0.35)'); 
    strokeWeight(1); 
    noFill(); 
    rect(dashX, dashY, 250, 120, 6); 
    noStroke(); 
    fill('#e1e8f0'); 
    textSize(12); 
    textStyle(NORMAL);
    textAlign(LEFT);
    text("⏱️ 战局时间: " + nf(simTime, 0, 1) + " 秒", dashX + 15, dashY + 25); 
    text("🚀 航行速度: " + nf(ship.getSpeed(), 0, 2) + " m/s", dashX + 15, dashY + 50); 
    text("📍 东西位置(X): " + Math.round(ship.pos.x) + " 米", dashX + 15, dashY + 75); 
    text("↕️ 离岸距离(Y): " + Math.round(ship.pos.y) + " / " + targetW + " 米", dashX + 15, dashY + 100); 
}

class RiverParticle { constructor() { this.pos = createVector(random(0, width), random(0, height)); this.len = random(20, 45); this.alpha = random(40, 120); } update(vRiver, northBankY) { let angle = radians(45); let speedPx = (vRiver * window.PHYSICS_SCALE); this.pos.x += speedPx * cos(angle) * 3; this.pos.y -= speedPx * sin(angle) * 3; if (this.pos.x > width) this.pos.x = 0; if (this.pos.y < northBankY) this.pos.y = window.RIVER_START_Y; } display() { stroke(100, 180, 220, this.alpha); strokeWeight(1); noFill(); beginShape(); vertex(this.pos.x, this.pos.y); vertex(this.pos.x + this.len * 0.4, this.pos.y - this.len * 0.15); vertex(this.pos.x + this.len * 0.8, this.pos.y - this.len * 0.25); endShape(); } }
function triggerExplosion(finishPx, northBankY) { fill(255, 60, 60); textSize(24); textStyle(BOLD); textAlign(CENTER); text("🔥 艨艟先锋突入成功！曹军连环水寨瞬间陷入火海！", width / 2, 300); }
function saveStateToStorage(x, y, vx, vy, heading) { sessionStorage.setItem("chibi_ship_x", x); sessionStorage.setItem("chibi_ship_y", y); sessionStorage.setItem("session_ship_vx", vx); sessionStorage.setItem("session_ship_vy", vy); sessionStorage.setItem("chibi_ship_heading", heading); }