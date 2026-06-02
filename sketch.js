/**
 * 🏹 sketch.js - 多物理场图形换装、正交分解受力渲染（并网扩展层版）
 */

let avatarImg = null;
let avatarLoaded = false;

// 🔗 向控制内核注入并网初始化
window.onChibiSetupExt = function() {
    avatarImg = null;
    avatarLoaded = false;
};

// 🔗 向控制内核注入多态组件物理装配
window.onChibiEquipExt = function(targetShip, p) {
    if (p.sail_idx === 0 && window.ThreeKingdomSail) {
        targetShip.equipSail(new window.ThreeKingdomSail("汉代编织篾席硬帆", p.sail_mass, p.sail_area, p.sail_eff));
    } else if (p.sail_idx === 1 && window.RomanSquareSail) {
        targetShip.equipSail(new window.RomanSquareSail("古典罗马多层方帆", p.sail_mass, p.sail_area, p.sail_eff));
    } else if (p.sail_idx === 2 && window.ArabLateenSail) {
        targetShip.equipSail(new window.ArabLateenSail("阿拉伯高气动三角帆", p.sail_mass, p.sail_area, p.sail_eff));
    }

    if (p.keel_idx === 0 && window.ThreeKingdomKeel) 
        targetShip.equipKeel(new window.ThreeKingdomKeel("平底无龙骨", p.keel_mass, p.keel_depth));
    else if (p.keel_idx === 1 && window.PersianKeel) 
        targetShip.equipKeel(new window.PersianKeel("波斯木质短龙骨", p.keel_mass, p.keel_depth));
    else if (p.keel_idx === 2 && window.TurkishKeel) 
        targetShip.equipKeel(new window.TurkishKeel("突厥硬木深龙骨", p.keel_mass, p.keel_depth));
};

// 🔗 向控制内核注入高级多物理场图形渲染大纲
window.onChibiRenderExt = function(p, shipInstance, currentSimTime, hasExplodedFlag, particlesArray) {
    if (p.avatar_data && !avatarLoaded) { avatarImg = loadImage(p.avatar_data); avatarLoaded = true; }

    background('#060d16'); 
    push();
    let riverPixelHeight = p.w_river * window.PHYSICS_SCALE; 
    let northBankY = window.RIVER_START_Y - riverPixelHeight;
    northBankY = constrain(northBankY, 60, 220); 

    let context = canvas.getContext('2d');
    let gradient = context.createLinearGradient(0, window.RIVER_START_Y, 0, northBankY);
    gradient.addColorStop(0, '#0a1c2a'); gradient.addColorStop(0.5, '#071624'); gradient.addColorStop(1, '#05101c');   
    context.fillStyle = gradient; context.fillRect(0, northBankY, width, window.RIVER_START_Y - northBankY);
    
    fill('#2b2015'); rect(0, window.RIVER_START_Y, width, 600 - window.RIVER_START_Y); 
    fill('#141d26'); rect(0, 0, width, northBankY); 
    stroke('rgba(163, 184, 204, 0.15)'); strokeWeight(1); line(0, window.RIVER_START_Y, width, window.RIVER_START_Y); line(0, northBankY, width, northBankY);
    
    noStroke(); fill(180, 140, 100); textSize(13); textStyle(BOLD); textAlign(RIGHT); 
    text("江南岸：东吴周瑜大寨 (赤壁枢纽) 🚩", width - 25, window.RIVER_START_Y + 25);
    textAlign(RIGHT); fill(130, 160, 180); 
    text("江北岸：曹魏水寨连环船 (乌林核心) 🏹", width - 25, northBankY - 15);

    particlesArray.forEach(pt => { pt.update(p.v_river, northBankY); pt.display(); });

    drawMicroShipInMacroWorld(p, northBankY, shipInstance); 
    if (hasExplodedFlag) { triggerExplosion(); }

    let nx = width - 60, ny = 60; stroke('rgba(130, 160, 180, 0.2)'); ellipse(nx, ny, 30, 30);
    stroke('#ff4422'); fill('#ff4422'); triangle(nx, ny - 20, nx - 5, ny, nx + 5, ny);
    fill('#ff4422'); noStroke(); textSize(12); textStyle(BOLD); textAlign(CENTER); text("北", nx, ny - 25); 
    
    drawDashboard(p.w_river, shipInstance, currentSimTime); pop(); 

    // 进入微观受力网格
    push(); stroke('rgba(29, 45, 61, 0.35)'); strokeWeight(1);
    for(let x = 0; x < width; x += 40) line(x, 600, x, 1600); for(let y = 600; y < 1600; y += 40) line(0, y, width, y);
    noStroke(); fill('#a3b8cc'); textSize(14); textStyle(BOLD); textAlign(LEFT); text("📊 斗舰先锋船体坐标系（微观动力学正交分解受力分析）", 20, 630);
    drawCanvasVirtualButtons();
    let cx = 450, cy = 1100;
    push(); translate(cx, cy); rotate(-shipInstance.heading + HALF_PI); 
    drawHugeAbstractShip(this, 0, 0, p.sail_raised, p.sail, p.rudder, p, shipInstance);
    drawForceVectors(this, 0, 0, 1.2, p); pop();
    drawLocalWindIndicator(this, cx + 180, cy - 260);
    stroke('#1d2d3d'); strokeWeight(3); line(0, 600, width, 600); pop(); 

    drawVisualKeyboardHUD();
    push(); stroke('#1d2d3d'); strokeWeight(2); line(0, 1600, width, 1600); drawPhysicsFormulas(); pop();
};

function drawMicroShipInMacroWorld(p, northBankY, warShip) {
    let currentYRatio = warShip.pos.y / p.w_river;
    let screenX = warShip.pos.x * window.PHYSICS_SCALE;
    let screenY = lerp(window.RIVER_START_Y, northBankY, currentYRatio);

    push(); let fx = screenX + 50, fy = screenY - 50; stroke('rgba(255, 75, 75, 0.2)'); noFill(); ellipse(fx, fy, 32, 32); let dX = 11, dY = 11; line(fx + dX, fy + dY, fx - dX, fy - dY); stroke('#ff4422'); strokeWeight(2); line(fx - dX, fy - dY, fx - dX + 7, fy - dY + 1); line(fx - dX, fy - dY, fx - dX + 1, fy - dY + 7); noStroke(); fill('rgba(255, 68, 34, 0.85)'); textSize(9); textAlign(CENTER); text("东南风", fx, fy - 20); pop();
    if (avatarImg) { push(); let imgW = 57.5; let imgH = 40; let avatarX = screenX - 70; let avatarY = screenY - 50; stroke('rgba(163, 184, 204, 0.6)'); strokeWeight(1.5); fill('#060d16'); rect(avatarX - 2, avatarY - 2, imgW + 4, imgH + 4, 3); image(avatarImg, avatarX, avatarY, imgW, imgH); stroke('rgba(163, 184, 204, 0.3)'); line(avatarX + imgW / 2, avatarY + imgH, screenX, screenY); pop(); }
    push(); translate(screenX, screenY); rotate(-warShip.heading + HALF_PI); scale(0.62); stroke('#a3b8cc'); strokeWeight(2.5); noFill(); beginShape(); vertex(0, -63); vertex(17, -28); vertex(17, 49); vertex(10, 63); vertex(-10, 63); vertex(-17, 49); vertex(-17, -28); endShape(CLOSE); stroke('#a3b8cc'); strokeWeight(4); line(0, -63, 0, -75); let currentSwing = sin(warShip.oarSwing) * radians(18); stroke('#e1e8f0'); strokeWeight(1.5); for (let i = -14; i < 35; i += 8) { push(); translate(17, i); rotate(radians(75) + currentSwing); line(0, 0, 25, 0); rect(22, -2, 4, 4); pop(); push(); translate(-17, i); rotate(radians(105) - currentSwing); line(0, 0, -25, 0); rect(-26, -2, 4, 4); pop(); }
    push(); translate(0, 63); rotate(radians(p.rudder)); stroke('#f39c12'); strokeWeight(3.5); line(0, 0, 0, 20); pop();
    let sh = p.sail_height; if (p.sail_raised && sh > 0) { push(); translate(0, 7); rotate(radians(p.sail)); stroke('#ffffff'); strokeWeight(3.5); line(-30, 0, 30, 0); pop(); } pop();
}

function drawHugeAbstractShip(g, cx, cy, sailRaised, sailDeg, rudderDeg, p, warShip) {
    g.push(); g.translate(cx, cy); g.stroke('rgba(163, 184, 204, 0.8)'); g.strokeWeight(2); g.noFill(); beginShape(); g.vertex(0, -90); g.vertex(22, -50); g.vertex(22, 70); g.vertex(14, 90); g.vertex(-14, 90); g.vertex(-22, 70); g.vertex(-22, -50); g.endShape(g.CLOSE); stroke('#a3b8cc'); g.strokeWeight(3.5); g.line(0, -90, 0, -104); let currentSwing = sin(warShip.oarSwing) * radians(18); g.stroke('#e1e8f0'); g.strokeWeight(1.2); for (let i = -20; i < 50; i += 12) { g.push(); g.translate(22, i); g.rotate(radians(75) + currentSwing); g.line(0, 0, 30, 0); g.rect(27, -2, 4, 4); g.pop(); g.push(); g.translate(-22, i); g.rotate(radians(105) - currentSwing); g.line(0, 0, -30, 0); g.rect(-31, -2, 4, 4); g.pop(); }
    g.push(); g.translate(0, 90); g.rotate(radians(rudderDeg)); g.stroke('#f39c12'); g.strokeWeight(3.5); g.line(0, 0, 0, 25); g.pop();
    let sh = p.sail_height; if (sailRaised && sh > 0) { g.push(); g.translate(0, -10); g.rotate(radians(sailDeg)); g.stroke('#ffffff'); g.strokeWeight(3.5); line(-42, 0, 42, 0); g.pop(); } g.pop();
}

function drawForceVectors(g, cx, cy, fSc, p) {
    g.push(); g.translate(cx, cy); 
    if (!window.physicsTelemetry) { g.pop(); return; }
    const MAX_LEN = 240; const BASE_VISUAL_FACTOR = fSc * 0.0055; 

    if (showHumanForce) { 
        let fHuman = (window.physicsTelemetry.fHuman || 0) * 1000; 
        let lenHuman = fHuman * BASE_VISUAL_FACTOR * 1.5; 
        lenHuman = constrain(lenHuman, 0, MAX_LEN); 
        if (lenHuman > 0) drawGraphArrow(g, 0, 0, 0, -lenHuman, '#2ecc71', 4, "纯人力推进 F(human)", true); 
    }

    if (showSailForce && p.sail_raised && (window.physicsTelemetry.fLift > 0)) {
        let fLift = window.physicsTelemetry.fLift || 0; let sailRad = radians(p.sail); let liftAngle = sailRad - HALF_PI; 
        let lx = (fLift * BASE_VISUAL_FACTOR) * cos(liftAngle); let ly = (fLift * BASE_VISUAL_FACTOR) * sin(liftAngle);
        let mag = sqrt(lx*lx + ly*ly); if (mag > MAX_LEN) { lx = (lx/mag)*MAX_LEN; ly = (ly/mag)*MAX_LEN; }
        drawGraphArrow(g, 0, 0, lx, ly, '#ff4422', 4, "帆具空气动力 F(lift)", false);
        g.push(); g.drawingContext.setLineDash([4, 4]); 
        drawGraphArrow(g, 0, 0, 0, ly, 'rgba(255, 102, 85, 0.75)', 2, "  ↳ 有效前向驱力", true);
        drawGraphArrow(g, 0, 0, lx, 0, 'rgba(230, 126, 34, 0.75)', 2, "  ↳ 无效倾覆侧向力", true);
        g.stroke('rgba(255,255,255,0.25)'); g.strokeWeight(1); g.line(0, ly, lx, ly); g.line(lx, 0, lx, ly); g.pop();
    }

    if (showWaterForce) {
        let rawRiverY = window.physicsTelemetry.fRiverY_ship || 0; let rawRiverX = window.physicsTelemetry.fRiverX_ship || 0;
        let fx_sub = rawRiverX * BASE_VISUAL_FACTOR * 1.8; let fy_sub = -rawRiverY * BASE_VISUAL_FACTOR * 1.8; 
        let magWater = sqrt(fx_sub*fx_sub + fy_sub*fy_sub); if (magWater > MAX_LEN) { fx_sub = (fx_sub/magWater)*MAX_LEN; fy_sub = (fy_sub/magWater)*MAX_LEN; }
        if (abs(fx_sub) > 0.1 || abs(fy_sub) > 0.1) {
            drawGraphArrow(g, 0, 0, fx_sub, fy_sub, '#3498db', 4, "大江流体合力 F(water)", false);
            g.push(); g.drawingContext.setLineDash([4, 4]);
            drawGraphArrow(g, 0, 0, 0, fy_sub, 'rgba(41, 128, 185, 0.85)', 2, "  ↳ 轴向切水阻力", true);
            drawGraphArrow(g, 0, 0, fx_sub, 0, 'rgba(155, 89, 182, 0.85)', 2, "  ↳ 舷侧横偏阻力", true);
            g.stroke('rgba(255,255,255,0.25)'); g.strokeWeight(1); g.line(0, fy_sub, fx_sub, fy_sub); g.line(fx_sub, 0, fx_sub, fy_sub); g.pop();
        }
    } g.pop();
}

function drawVisualKeyboardHUD() {
    push(); fill('rgba(11, 23, 38, 0.95)'); stroke('#1c2e42'); strokeWeight(2); rect(20, 285, 200, 265, 8);
    noStroke(); fill('#8ea2b9'); textSize(11); textStyle(BOLD); textAlign(CENTER); text("🎮 拟真战术操纵手柄 HUD", 120, 312);
    drawSingleKeyUI('w', keyIsDown(87) || keyIsDown(119)); drawSingleKeyUI('a', keyIsDown(65) || keyIsDown(97));
    drawSingleKeyUI('s', keyIsDown(83) || keyIsDown(115)); drawSingleKeyUI('d', keyIsDown(68) || keyIsDown(100));
    drawSingleKeyUI('left', keyIsDown(LEFT_ARROW)); drawSingleKeyUI('right', keyIsDown(RIGHT_ARROW));
    let barX = 40, barY = 520, barW = 160, barH = 10; fill('#121e2d'); stroke('#2c3e50'); rect(barX, barY, barW, barH, 2);
    noStroke(); fill('#2ecc71'); rect(barX, barY, barW * k_sailHeight, barH, 2);
    fill('#8ea2b9'); textSize(9); textStyle(BOLD); textAlign(LEFT, CENTER); text("⛵ 帆高受风额度: " + Math.round(k_sailHeight * 100) + "%", barX, barY - 8); pop();
}

function drawSingleKeyUI(keyName, isActiveK) {
    let btn = KEY_UI[keyName]; let isActive = isActiveK || (mouseIsPressed && checkMouseInRect(btn));
    if (isActive) { fill('rgba(46, 204, 113, 0.85)'); stroke('#2ecc71'); strokeWeight(2); } else { fill('#121e2d'); stroke('#2c3e50'); strokeWeight(1); }
    rect(btn.x, btn.y, btn.w, btn.h, 4); noStroke(); if (isActive) fill('#ffffff'); else fill('#70879e');
    textSize(10); textStyle(BOLD); textAlign(CENTER, CENTER); text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
}

function drawCanvasVirtualButtons() {
    textSize(10); textAlign(CENTER); fill(showHumanForce ? 'rgba(46, 204, 113, 0.2)' : 'rgba(44, 62, 80, 0.4)'); stroke(showHumanForce ? '#2ecc71' : '#34495e'); rect(BTN1_X, BTN_Y, BTN_W, BTN_H, 4); noStroke(); fill(showHumanForce ? '#2ecc71' : '#7f8c8d'); text("💪 人力推进: " + (showHumanForce ? "显示" : "隐藏"), BTN1_X + BTN_W/2, BTN_Y + 15);
    fill(showSailForce ? 'rgba(231, 76, 60, 0.2)' : 'rgba(44, 62, 80, 0.4)'); stroke(showSailForce ? '#e74c3c' : '#34495e'); rect(BTN2_X, BTN_Y, BTN_W, BTN_H, 4); noStroke(); fill(showSailForce ? '#ff6655' : '#7f8c8d'); text("💨 风帆气动力: " + (showSailForce ? "显示" : "隐藏"), BTN2_X + BTN_W/2, BTN_Y + 15);
    fill(showWaterForce ? 'rgba(52, 152, 219, 0.2)' : 'rgba(44, 62, 80, 0.4)'); stroke(showWaterForce ? '#3498db' : '#34495e'); rect(BTN3_X, BTN_Y, BTN_W, BTN_H, 4); noStroke(); fill(showWaterForce ? '#3498db' : '#7f8c8d'); text("🌊 大江水阻力: " + (showWaterForce ? "显示" : "隐藏"), BTN3_X + BTN_W/2, BTN_Y + 15);
}

function mousePressed() { if (mouseY >= BTN_Y && mouseY <= BTN_Y + BTN_H) { if (mouseX >= BTN1_X && mouseX <= BTN1_X + BTN_W) { showHumanForce = !showHumanForce; sessionStorage.setItem("chibi_show_human", showHumanForce); } if (mouseX >= BTN2_X && mouseX <= BTN2_X + BTN_W) { showSailForce = !showSailForce; sessionStorage.setItem("chibi_show_sail", showSailForce); } if (mouseX >= BTN3_X && mouseX <= BTN3_X + BTN_W) { showWaterForce = !showWaterForce; sessionStorage.setItem("chibi_show_water", showWaterForce); } } }
function drawGraphArrow(g, x1, y1, x2, y2, clr, weight, label, isSub) { g.stroke(clr); g.strokeWeight(weight); g.fill(clr); g.line(x1, y1, x2, y2); let angle = atan2(y2 - y1, x2 - x1); g.push(); g.translate(x2, y2); g.rotate(angle); let arrowSize = 7; g.triangle(0, 0, -arrowSize, -arrowSize*0.4, -arrowSize, arrowSize*0.4); g.pop(); if (label && dist(x1,y1,x2,y2) > 20) { g.noStroke(); g.fill(clr); g.textSize(10); if (isSub) { g.textAlign(g.CENTER); g.text(label, x2 * 0.55, y2 * 0.55 + 12); } else { g.textAlign(g.LEFT); g.text(label, x2 + 8 * cos(angle + HALF_PI), y2 + 8 * sin(angle + HALF_PI)); } } }
function drawLocalWindIndicator(g, fx, fy) { g.push(); g.stroke('rgba(255, 75, 75, 0.15)'); g.noFill(); g.ellipse(fx, fy, 36, 36); let dX = 12, dY = 12; g.stroke('#ff4422'); g.strokeWeight(2.5); g.line(fx + dX, fy + dY, fx - dX, fy - dY); noStroke(); fill('rgba(255, 68, 34, 0.85)'); textSize(10); textAlign(CENTER); text("东南风", fx, fy - 22); g.pop(); }
function drawDashboard(targetW, warShip, currentSimTime) { let dashX = 20; let dashY = 20; fill('rgba(11, 19, 30, 0.9)'); rect(dashX, dashY, 250, 120, 6); noStroke(); fill('#e1e8f0'); textSize(12); textAlign(LEFT); text("⏱️ 战局时间: " + nf(currentSimTime, 0, 1) + " 秒", dashX + 15, dashY + 25); text("🚀 航行速度: " + nf(warShip.getSpeed(), 0, 2) + " m/s", dashX + 15, dashY + 50); text("📍 东西位置(X): " + Math.round(warShip.pos.x) + " 米", dashX + 15, dashY + 75); text("↕️ 离岸距离(Y): " + Math.round(warShip.pos.y) + " / " + targetW + " 米", dashX + 15, dashY + 100); }
function triggerExplosion() { fill(255, 60, 60); textSize(22); textStyle(BOLD); textAlign(CENTER); text("🔥 艨艟先锋突入成功！曹军连连水寨瞬间陷入火海！", width / 2, 260); }
function drawPhysicsFormulas() {
    noStroke(); fill('#e1e8f0'); textAlign(LEFT); let startY = 1635; textSize(13); textStyle(BOLD); text("1. 风帆高阶动力学组件特征方程 & 人力驱力", 30, startY); textStyle(NORMAL); textSize(11); fill('#a3b8cc'); text("升力解算多态方程: F(lift) = 0.5 * ρ * S(组件) * C(L) * V(表观风)² * 气动转化率", 30, startY + 22); fill('#ff4422'); text("  → 瞬时气动总合力做功 F(lift) = " + Math.round(window.physicsTelemetry.fLift || 0) + " 牛顿 (N)", 30, startY + 39); fill('#a3b8cc'); let currentSailDeg = window.localParams ? window.localParams.sail : 0; let fSailForwardN = Math.round((window.physicsTelemetry.fLift || 0) * abs(cos(radians(currentSailDeg)))); text("船体自适应纵向驱动推进: F(轴向分力) = F(lift) * |cos(θ_帆)|", 30, startY + 62); fill('#ff6655'); text("  → 分解投影: " + Math.round(window.physicsTelemetry.fLift || 0) + " N * |cos(" + currentSailDeg + "°)| = " + fSailForwardN + " 牛顿 (N)", 30, startY + 79); text("纯人力桨排额定驱力 F(human) = " + Math.round((window.physicsTelemetry.fHuman || 0) * 1000) + " N", 30, startY + 100); text("前向复合拉力 ΣF = " + Math.round(fSailForwardN + ((window.physicsTelemetry.fHuman || 0) * 1000)) + " 牛顿 (N)", 30, startY + 118); fill('#e1e8f0'); textSize(13); textStyle(BOLD); text("2. 大江水动力学组件改性与微分迭代状态机", 480, startY); textStyle(NORMAL); textSize(11); fill('#a3b8cc'); text("组件多态流体抗性公式: F(water) = -[K(基准) + ΔK(龙骨)] * V(相对水)²", 480, startY + 22); fill('#3498db'); let fRiverY = Math.round(window.physicsTelemetry.fRiverY_ship || 0); let fRiverX = Math.round(window.physicsTelemetry.fRiverX_ship || 0); text("    [纵向切水水阻]: " + fRiverY + " N  |  [侧向龙骨抗滑位移力]: " + fRiverX + " N", 480, startY + 56); fill('#2ecc71'); textStyle(BOLD); text("📈 终极合速度解算: V(大地绝对) = " + nf(ship.getSpeed(), 0, 2) + " m/s", 480, startY + 118);
}